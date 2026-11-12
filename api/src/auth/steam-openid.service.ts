import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '../errors.js';
import { createLogger } from '../logger.js';
import type { AppConfig } from '../config.js';
import { createVerify } from 'node:crypto';

/** Respuesta de Steam al callback de OpenID 2.0. */
export interface SteamOpenIdParams {
  'openid.ns'?: string;
  'openid.mode'?: string;
  'openid.op_endpoint'?: string;
  'openid.claimed_id'?: string;
  'openid.identity'?: string;
  'openid.return_to'?: string;
  'openid.response_nonce'?: string;
  'openid.assoc_handle'?: string;
  'openid.signed'?: string;
  'openid.sig'?: string;
  state?: string;
}

export interface SteamIdentity {
  /** SteamID64, en texto (nunca `number`: excede los 53 bits seguros). */
  steamId64: string;
  /** URL del avatar, derivable sin API key. */
  avatarUrl: string;
}

/** Identidad de OpenID 2.0 que Steam acepta. */
const STEAM_OPENID_NS = 'http://specs.openid.net/auth/2.0';
const STEAM_IDENTITY_PREFIX = 'https://steamcommunity.com/openid/id/';

/**
 * Cliente OpenID 2.0 de Steam.
 *
 * El flujo es el estandar: redireccion con `openid.mode=checkid_setup` y
 * respuesta firmada con `openid.mode=id_res`. La validacion de la firma RSA
 * es la que garantiza que la respuesta viene de Steam y no de un atacante
 * que haya construido la query a mano.
 */
export class SteamOpenIdService {
  private readonly logger = createLogger('SteamOpenIdService');

  /** Clave publica de Steam cacheada en memoria. */
  private cachedPublicKey: string | null = null;

  constructor(private readonly config: AppConfig) {}

  /**
   * Steam OpenID no necesita credenciales de cliente, pero si necesita el
   * realm configurado (el dominio que devuelve el callback) para que Steam
   * acepte el `return_to`.
   */
  isConfigured(): boolean {
    return this.config.auth.steamRealm !== '';
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'El login con Steam no esta configurado en este entorno',
      );
    }
  }

  /** Callback absoluto de Steam OpenID. */
  getCallbackUri(): string {
    const realm = this.config.auth.steamRealm.replace(/\/+$/, '');
    return `${realm}/auth/steam/callback`;
  }

  /**
   * URL a la que se redirige al usuario para autenticarse en Steam.
   *
   * `openid.return_to` incluye el `state` como query param: OpenID 2.0 no
   * tiene un campo `state` propio, asi que el nonce de CSRF viaja dentro
   * del `return_to` y se comprueba en el callback.
   */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      'openid.ns': STEAM_OPENID_NS,
      'openid.mode': 'checkid_setup',
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.return_to': `${this.getCallbackUri()}?state=${encodeURIComponent(state)}`,
    });
    const base = this.config.auth.steamOpenIdUrl;
    return `${base}?${params.toString()}`;
  }

  /**
   * Valida la respuesta de Steam y extrae el SteamID64.
   *
   * Pasos: comprobar el modo y el namespace, validar que el `return_to`
   * sea el esperado (incluye el `state`), verificar la firma RSA-SHA1 sobre
   * los campos firmados y, por ultimo, extraer el SteamID64 de la
   * identidad.
   */
  async validate(params: SteamOpenIdParams): Promise<SteamIdentity> {
    if (params['openid.mode'] !== 'id_res') {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }
    if (params['openid.ns'] !== STEAM_OPENID_NS) {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }
    if (!params['openid.identity']?.startsWith(STEAM_IDENTITY_PREFIX)) {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }

    const expectedReturnTo = `${this.getCallbackUri()}?state=${encodeURIComponent(params.state ?? '')}`;
    if (params['openid.return_to'] !== expectedReturnTo) {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }

    await this.verifySignature(params);

    const steamId64 = params['openid.identity']?.slice(
      STEAM_IDENTITY_PREFIX.length,
    );
    if (!steamId64 || !/^\d{17}$/.test(steamId64)) {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }

    return {
      steamId64,
      avatarUrl: `https://avatars.steamstatic.com/${steamId64}.jpg`,
    };
  }

  /**
   * Verifica la firma `openid.sig` con la clave publica de Steam.
   *
   * La firma cubre los campos listados en `openid.signed`, en ese orden y
   * con el formato `clave=valor` separado por `&`, tal y como define OpenID
   * 2.0. Steam firma con RSA-SHA1.
   */
  private async verifySignature(params: SteamOpenIdParams): Promise<void> {
    const signed = params['openid.signed'];
    const signature = params['openid.sig'];
    if (!signed || !signature) {
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }

    const fields = signed.split(',').map((field) => field.trim());
    const baseString = fields
      .map(
        (field) => `${field}=${params[field as keyof SteamOpenIdParams] ?? ''}`,
      )
      .join('&');

    const publicKey = await this.getPublicKey();
    const verifier = createVerify('RSA-SHA1');
    verifier.update(baseString, 'utf8');

    const valid = verifier.verify(publicKey, Buffer.from(signature, 'base64'));
    if (!valid) {
      this.logger.warn('Firma de Steam invalida en el callback de OpenID');
      throw new UnauthorizedException('Respuesta de Steam invalida');
    }
  }

  /**
   * Descarga (y cachea) la clave publica RSA de Steam. Es una clave publica:
   * no es un secreto y no se configura en el entorno.
   */
  private async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }
    const url = this.config.auth.steamOpenIdKeyUrl;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.cachedPublicKey = await response.text();
      return this.cachedPublicKey;
    } catch (error) {
      this.logger.error(
        `No se pudo obtener la clave publica de Steam: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'El login con Steam no esta disponible temporalmente',
      );
    }
  }
}
