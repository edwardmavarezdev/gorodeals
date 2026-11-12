import type { AppConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { SteamAppDetails, SteamAppDetailsResponse } from './steam.types.js';
import { TtlLruCache } from './steam-cache.js';
import {
  SteamAppNotFoundError,
  SteamInvalidResponseError,
  SteamUnavailableError,
} from './steam.errors.js';

/**
 * Cliente HTTP de la API publica de la tienda de Steam.
 *
 * Nota sobre el lote: la documentacion historicamente permitia `appids=1,2,3`
 * pero el endpoint publico actual responde SIEMPRE HTTP 400 con cuerpo
 * `null` a esa forma (verificado contra la API real). Por eso el cliente
 * descarta la via del lote por coma y descarga appid a appid, con concurrencia
 * acotada y pausas entre bloques. El limite es de la API de Steam, no del
 * cliente: no hay forma de pedir varios appids en una sola peticion.
 *
 * Politica de red:
 * - Timeout explicito por peticion (configurable, 12 s por defecto).
 * - Reintentos acotados (3 por defecto) con backoff exponencial ante 5xx,
 *   error de red o timeout.
 * - Respuestas HTML (Steam devuelve HTML cuando detecta abuso) se consideran
 *   fallo de disponibilidad, no un parseo valido.
 * - Cache en memoria por appid con TTL corto (15 min por defecto) y tope LRU
 *   de entradas (`STEAM_CACHE_MAX_ENTRIES`, 10000 por defecto): los precios
 *   cambian pocas veces al dia y el sync es diario, pero un `Map` sin tope
 *   acababa en OOM con catalogos grandes (~174 MB a 100k appids).
 */
export class SteamClient {
  private readonly logger = createLogger('SteamClient');
  private readonly cache: TtlLruCache<SteamAppDetails | null>;

  constructor(private readonly config: AppConfig) {
    this.cache = new TtlLruCache<SteamAppDetails | null>(
      this.config.steam.cacheTtlMs,
      this.config.steam.cacheMaxEntries,
    );
  }

  private get baseUrl(): string {
    return this.config.steam.baseUrl;
  }

  private get countryCode(): string {
    return this.config.steam.countryCode;
  }

  private get language(): string {
    return this.config.steam.language;
  }

  private get timeoutMs(): number {
    return this.config.steam.timeoutMs;
  }

  private get maxRetries(): number {
    return this.config.steam.maxRetries;
  }

  private get batchSize(): number {
    return this.config.steam.batchSize;
  }

  private get concurrency(): number {
    return this.config.steam.concurrency;
  }

  private get interBatchDelayMs(): number {
    return this.config.steam.interBatchDelayMs;
  }

  private cacheKey(appId: number): string {
    return `${this.countryCode}:${this.language}:${appId}`;
  }

  /** URL canonica de la ficha del juego en la tienda. */
  buildStoreUrl(appId: number): string {
    return `https://store.steampowered.com/app/${appId}`;
  }

  /**
   * Descarga el detalle de un appid. Devuelve `null` cuando Steam responde
   * `success: false` (appid inexistente o sin datos publicados).
   */
  async fetchAppDetails(appId: number): Promise<SteamAppDetails | null> {
    const cacheKey = this.cacheKey(appId);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = `${this.baseUrl}/appdetails?appids=${appId}&cc=${this.countryCode}&l=${this.language}`;
    const payload = await this.requestWithRetry(url);

    const envelope = (payload ?? {})[String(appId)] as
      SteamAppDetailsResponse | undefined;
    const details =
      envelope && envelope.success === true ? (envelope.data ?? null) : null;

    this.cache.set(cacheKey, details);
    return details;
  }

  /** Igual que `fetchAppDetails` pero lanza `SteamAppNotFoundError`. */
  async fetchAppDetailsOrFail(appId: number): Promise<SteamAppDetails> {
    const details = await this.fetchAppDetails(appId);
    if (!details) {
      throw new SteamAppNotFoundError(appId);
    }
    return details;
  }

  /**
   * Descarga el detalle de varios appids, appid a appid, con concurrencia
   * acotada y pausas entre bloques. Los appids sin datos se omiten del
   * resultado.
   *
   * Limitacion de la API de Steam: la forma `?appids=1,2,3` devuelve siempre
   * HTTP 400 con cuerpo `null`, por lo que no existe una via de lote real.
   */
  async fetchAppDetailsBatch(
    appIds: number[],
  ): Promise<Map<number, SteamAppDetails>> {
    const result = new Map<number, SteamAppDetails>();
    const unique = [...new Set(appIds)].filter((id) => Number.isInteger(id));

    for (let offset = 0; offset < unique.length; offset += this.batchSize) {
      const chunk = unique.slice(offset, offset + this.batchSize);
      const fetched = await this.fetchChunk(chunk);
      for (const [appId, details] of fetched) {
        result.set(appId, details);
      }
      if (offset + this.batchSize < unique.length) {
        await this.delay(this.interBatchDelayMs);
      }
    }
    return result;
  }

  private async fetchChunk(
    appIds: number[],
  ): Promise<Map<number, SteamAppDetails>> {
    const out = new Map<number, SteamAppDetails>();
    const pending = appIds.filter((appId) => {
      const cached = this.cache.get(this.cacheKey(appId));
      if (cached !== undefined) {
        if (cached) {
          out.set(appId, cached);
        }
        return false;
      }
      return true;
    });

    if (pending.length === 0) {
      return out;
    }

    for (const details of await this.fetchParallel(pending)) {
      out.set(details.appId, details.details);
    }
    return out;
  }

  /** Peticiones por appid con pool de concurrencia acotado. */
  private async fetchParallel(
    appIds: number[],
  ): Promise<{ appId: number; details: SteamAppDetails }[]> {
    const out: { appId: number; details: SteamAppDetails }[] = [];
    let cursor = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor++;
        if (index >= appIds.length) {
          return;
        }
        const appId = appIds[index];
        try {
          const details = await this.fetchAppDetails(appId);
          if (details) {
            out.push({ appId, details });
          }
        } catch (error) {
          this.logger.warn(
            `Fallo consultando appid ${appId}: ${
              error instanceof Error ? error.message : 'error desconocido'
            }`,
          );
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(this.concurrency, appIds.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return out;
  }

  private async requestWithRetry(
    url: string,
  ): Promise<Record<string, unknown> | null> {
    let lastError = 'sin detalle';

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'accept-language': this.language,
            'user-agent': 'gorodeals-api/1.0 (+https://gorodeals.local)',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === 429 || response.status === 403) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '0');
          await response.text();
          lastError = `HTTP ${response.status}`;
          await this.delay(
            retryAfter > 0 ? retryAfter * 1000 : this.backoffMs(attempt),
          );
          continue;
        }

        if (!response.ok) {
          await response.text();
          lastError = `HTTP ${response.status}`;
          await this.delay(this.backoffMs(attempt));
          continue;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          await response.text();
          lastError = 'respuesta HTML (posible limitacion de Steam)';
          await this.delay(this.backoffMs(attempt) * 2);
          continue;
        }

        const text = await response.text();
        if (text.trim() === '' || text.trim() === 'null') {
          return null;
        }
        // El parseo va aparte: un cuerpo que no es JSON es un fallo de
        // CONTRATO con la API, no un fallo de red. Reintentar no lo arregla
        // (y antes consumia los 3 reintentos del cliente).
        return this.parsePayload(text);
      } catch (error) {
        if (error instanceof SteamInvalidResponseError) {
          throw error;
        }
        lastError =
          error instanceof Error ? error.message : 'error de red desconocido';
        if (attempt < this.maxRetries) {
          await this.delay(this.backoffMs(attempt));
        }
      }
    }

    throw new SteamUnavailableError(lastError);
  }

  /**
   * Parsea el cuerpo de la respuesta de Steam.
   * Un cuerpo que no es JSON se traduce a `SteamInvalidResponseError`.
   */
  private parsePayload(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : 'error de parseo desconocido';
      throw new SteamInvalidResponseError(detalle);
    }
  }

  private backoffMs(attempt: number): number {
    return Math.min(500 * 2 ** (attempt - 1), 8000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
