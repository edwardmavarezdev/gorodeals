import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IgdbAuthError,
  IgdbBadQueryError,
  IgdbConfigurationError,
  IgdbRateLimitError,
  IgdbUnavailableError,
} from './igdb.errors.js';
import type { IgdbRawGame, IgdbTokenResponse } from './igdb.types.js';

/** IGDB permite 4 peticiones por segundo y por Client ID. */
const REQUESTS_PER_SECOND = 4;
const MIN_INTERVAL_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);

/** Maximo de reintentos por peticion (ademas del intento original). */
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

/** Margen de seguridad para renovar el token antes de que expire. */
const TOKEN_RENEWAL_MARGIN_MS = 60_000;

/**
 * Cliente HTTP de IGDB con:
 * - OAuth de Twitch con cache del token en memoria (renovacion bajo demanda).
 * - Throttle global de 4 req/s compartido por todas las llamadas.
 * - Reintentos con backoff exponencial y jitter ante 429/5xx.
 */
@Injectable()
export class IgdbClient {
  private readonly logger = new Logger(IgdbClient.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;
  private readonly apiUrl: string;
  /**
   * Timeout de cada peticion (token, API y renovacion). Sin el, un socket
   * colgado bloquea la cola entera de peticiones.
   */
  private readonly timeoutMs: number;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private pendingToken: Promise<string> | null = null;

  /** Timestamp (ms) del inicio de la ultima peticion enviada a IGDB. */
  private lastRequestAt = 0;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('igdb.clientId') ?? '';
    this.clientSecret = this.config.get<string>('igdb.clientSecret') ?? '';
    this.tokenUrl =
      this.config.get<string>('igdb.tokenUrl') ??
      'https://id.twitch.tv/oauth2/token';
    this.apiUrl =
      this.config.get<string>('igdb.apiUrl') ?? 'https://api.igdb.com/v4/games';
    this.timeoutMs = this.config.get<number>('igdb.timeoutMs') ?? 10_000;
  }

  /** Espera asincrona; se sobreescribe en pruebas para eliminar el retardo real. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Verifica que las credenciales esten configuradas. Lanza un error tipado
   * en lugar de fallar en silencio o arrancar el modulo con error.
   */
  assertConfigured(): void {
    if (!this.clientId || !this.clientSecret) {
      throw new IgdbConfigurationError(
        'Credenciales de IGDB no configuradas: se requieren IGDB_CLIENT_ID e IGDB_CLIENT_SECRET',
      );
    }
  }

  /** Indica si el modulo puede operar contra IGDB. */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Ejecuta una query Apicalypse contra IGDB y devuelve los juegos crudos.
   */
  async query<T extends IgdbRawGame = IgdbRawGame>(
    apicalypse: string,
  ): Promise<T[]> {
    this.assertConfigured();
    const token = await this.getAccessToken();

    const response = await this.requestWithRetries(token, apicalypse);

    if (!Array.isArray(response)) {
      return [];
    }
    return response as T[];
  }

  /** Obtiene (y cachea) el token OAuth de Twitch. */
  async getAccessToken(): Promise<string> {
    this.assertConfigured();

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Renovacion bajo demanda: si ya hay una renovacion en curso, se comparte.
    if (!this.pendingToken) {
      this.pendingToken = this.requestToken().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  private async requestToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    let response: Response;
    try {
      response = await this.fetchWithPacing(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error) {
      throw new IgdbUnavailableError(
        `No se pudo contactar con el endpoint de token de Twitch: ${this.describe(error)}`,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new IgdbAuthError(
        'Credenciales de Twitch Developer invalidas o sin permisos sobre IGDB',
      );
    }

    if (!response.ok) {
      throw new IgdbUnavailableError(
        `El endpoint de token de Twitch respondio ${response.status}`,
      );
    }

    const payload = (await response.json()) as IgdbTokenResponse;
    if (!payload.access_token) {
      throw new IgdbAuthError(
        'El endpoint de token de Twitch no devolvio access_token',
      );
    }

    const expiresInMs = (payload.expires_in ?? 3600) * 1000;
    this.accessToken = payload.access_token;
    this.tokenExpiresAt =
      Date.now() + Math.max(0, expiresInMs - TOKEN_RENEWAL_MARGIN_MS);

    this.logger.log(
      `Token de IGDB obtenido correctamente (vigencia ${Math.round(expiresInMs / 1000)}s)`,
    );
    return this.accessToken;
  }

  /**
   * UNICO punto de salida de red del cliente.
   *
   * Toda peticion (token, consulta a la API, renovacion de token y reintentos)
   * pasa por aqui. Antes, el espaciado de 250 ms se aplicaba una sola vez por
   * tarea: un reintento o una renovacion de token se emitian de inmediato y
   * el limite real de IGDB (4 req/s) podia superarse con creces.
   *
   * Aqui la plaza se reserva ANTES de cada `fetch`: el intervalo minimo se
   * cumple entre peticiones consecutivas, sea cual sea quien las emita.
   */
  private async fetchWithPacing(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    await this.reserveSlot();
    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  /**
   * Reserva la siguiente plaza del limite de peticiones. La reserva es
   * atomica dentro del tick: varios emisores concurrentes se turnan el
   * intervalo configurado.
   */
  private async reserveSlot(): Promise<void> {
    const now = Date.now();
    const wait = this.lastRequestAt + MIN_INTERVAL_MS - now;
    this.lastRequestAt = now + Math.max(0, wait);
    if (wait > 0) {
      await this.sleep(wait);
    }
  }

  private async requestWithRetries(
    token: string,
    apicalypse: string,
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        await this.sleep(this.backoffDelay(attempt, lastError));
      }

      let response: Response;
      try {
        response = await this.fetchWithPacing(this.apiUrl, {
          method: 'POST',
          headers: {
            'Client-ID': this.clientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
            Accept: 'application/json',
          },
          body: apicalypse,
        });
      } catch (error) {
        lastError = new IgdbUnavailableError(
          `Error de red consultando IGDB: ${this.describe(error)}`,
        );
        continue;
      }

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 401) {
        // Token expirado o invalido: se fuerza renovacion y se reintenta una vez.
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        try {
          const freshToken = await this.getAccessToken();
          response = await this.fetchWithPacing(this.apiUrl, {
            method: 'POST',
            headers: {
              'Client-ID': this.clientId,
              Authorization: `Bearer ${freshToken}`,
              'Content-Type': 'text/plain',
              Accept: 'application/json',
            },
            body: apicalypse,
          });
        } catch (error) {
          throw error instanceof Error
            ? error
            : new IgdbUnavailableError('Fallo al renovar el token de IGDB');
        }
        if (response.ok) {
          return await response.json();
        }
      }

      if (response.status === 429) {
        lastError = new IgdbRateLimitError(
          'IGDB ha limitado la peticion (429) y se agotaron los reintentos',
        );
        // El `Retry-After` se guarda para que `backoffDelay` lo consuma en el
        // siguiente intento. Antes se esperaba aqui Y ademas en el backoff:
        // la misma espera se aplicaba dos veces por reintento.
        this.parseRetryAfter(response);
        continue;
      }

      if (response.status === 400) {
        // El cuerpo crudo del proveedor puede contener detalle interno de
        // IGDB: se registra en el log y al cliente solo se le da un mensaje
        // cerrado y estable.
        const detail = await this.readBody(response);
        this.logger.error(
          `IGDB rechazo la query Apicalypse con estado 400: ${detail}`,
        );
        throw new IgdbBadQueryError(
          'IGDB rechazo la query Apicalypse enviada (400)',
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new IgdbAuthError(
          `IGDB rechazo las credenciales (${response.status})`,
        );
      }

      lastError = new IgdbUnavailableError(
        `IGDB respondio con estado ${response.status}`,
      );
    }

    throw (
      lastError ?? new IgdbUnavailableError('IGDB no respondio tras reintentos')
    );
  }

  /** Backoff exponencial con jitter completo. */
  private backoffDelay(attempt: number, lastError: Error | null): number {
    if (lastError instanceof IgdbRateLimitError) {
      const retryAfter = this.lastRetryAfterMs;
      if (retryAfter !== null) {
        this.lastRetryAfterMs = null;
        return retryAfter;
      }
    }
    const exponential = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * 2 ** (attempt - 1),
    );
    return exponential + Math.floor(Math.random() * 250);
  }

  private lastRetryAfterMs: number | null = null;

  private parseRetryAfter(response: Response): number | null {
    const header = response.headers.get('retry-after');
    if (!header) {
      return null;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      this.lastRetryAfterMs = Math.min(MAX_BACKOFF_MS, seconds * 1000);
      return this.lastRetryAfterMs;
    }
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      this.lastRetryAfterMs = Math.min(
        MAX_BACKOFF_MS,
        Math.max(0, date - Date.now()),
      );
      return this.lastRetryAfterMs;
    }
    return null;
  }

  private async readBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text.slice(0, 500);
    } catch {
      return 'sin detalle';
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
