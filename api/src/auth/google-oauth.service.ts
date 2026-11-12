import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '../errors.js';
import { createLogger } from '../logger.js';
import type { AppConfig } from '../config.js';
import { createHash, randomBytes } from 'node:crypto';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Perfil de Google que devuelve el endpoint de userinfo. */
export interface GoogleProfile {
  /** Identificador estable de la cuenta en Google. La identidad es este valor. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Respuesta del intercambio del authorization code. */
export interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Cliente OAuth 2.0 de Google con PKCE (S256).
 *
 * Se implementa con un cliente HTTP propio en vez de Passport para no
 * depender de sesiones con cookie: el frontend es estatico (Astro) y el
 * callback necesita poder devolver un token opaco.
 */
export class GoogleOAuthService {
  private readonly logger = createLogger('GoogleOAuthService');

  constructor(private readonly config: AppConfig) {}

  /**
   * Indica si hay credenciales de Google configuradas. Si no, los endpoints
   * de login social devuelven 503 en vez de romperse.
   */
  isConfigured(): boolean {
    return (
      this.config.google.clientId !== '' &&
      this.config.google.clientSecret !== ''
    );
  }

  /**
   * Lanza 503 si Google no esta configurado. La app arranca igual: solo
   * fallan los endpoints de login social.
   */
  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'El login con Google no esta configurado en este entorno',
      );
    }
  }

  /** `redirect_uri` configurada, comprobada contra la allowlist. */
  getCallbackUri(): string {
    const uri = this.config.google.callbackUri;
    const allowlist = this.config.auth.googleRedirectAllowlist;
    if (!uri || !allowlist.includes(uri)) {
      this.logger.error(
        'GOOGLE_CALLBACK_URI no esta en GOOGLE_REDIRECT_ALLOWLIST: el login con Google queda deshabilitado',
      );
      throw new ServiceUnavailableException(
        'El login con Google no esta configurado en este entorno',
      );
    }
    return uri;
  }

  /** URL de autorizacion de Google con `state` y PKCE S256. */
  buildAuthorizeUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.google.clientId,
      redirect_uri: this.getCallbackUri(),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Intercambia el authorization code por tokens. `codeVerifier` es el
   * secret de PKCE y solo se usa aqui.
   */
  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.google.clientId,
      client_secret: this.config.google.clientSecret,
      redirect_uri: this.getCallbackUri(),
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.error(
        `Google rechazo el intercambio del authorization code: ${response.status}`,
      );
      throw new UnauthorizedException(
        'No se pudo completar el login con Google',
      );
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  /**
   * Perfil del usuario autenticado. La identidad es `sub`, no el email: el
   * email puede cambiar o no existir.
   */
  async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.error(
        `Google no devolvio el perfil del usuario: ${response.status}`,
      );
      throw new UnauthorizedException(
        'No se pudo completar el login con Google',
      );
    }

    const payload = (await response.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
    };

    if (!payload.sub) {
      throw new UnauthorizedException(
        'No se pudo completar el login con Google',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email ?? null,
      emailVerified:
        payload.email_verified === true || payload.email_verified === 'true',
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }
}

/**
 * Genera el par verifier/challenge de PKCE con S256.
 *
 * El verifier es un secreto aleatorio de 64 bytes; el challenge es su
 * SHA-256 en base64url. El verifier no sale del servidor.
 */
export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}
