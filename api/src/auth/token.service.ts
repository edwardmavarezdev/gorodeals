import { UnauthorizedException } from '../errors.js';
import { createSigner, createVerifier } from 'fast-jwt';
import { randomUUID } from 'node:crypto';
import { appConfig } from '../config.js';

/**
 * Payload del access token. Minimo a proposito: identificador de usuario,
 * email y `jti` unico por token. Nunca incluye el hash de la contrasena ni
 * datos de terceros.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  jti: string;
}

/**
 * Emision y verificacion de access tokens JWT.
 *
 * El algoritmo esta fijado a HS256 tanto al firmar como al verificar: un
 * token firmado con otro algoritmo (o con `alg: none`) se rechaza.
 *
 * Se usa `fast-jwt` (la base de `@fastify/jwt`) directamente: no hace falta
 * una instancia de Fastify para firmar y verificar, asi que el mismo
 * servicio sirve tanto al hook de autenticacion como a los scripts de CLI.
 */
export class TokenService {
  /**
   * `fast-jwt` expone sobrecargas (con y sin callback) que TypeScript no
   * unifica: aqui se guarda la forma simple, la que devuelve el valor.
   */
  private readonly signer: (payload: unknown) => string | Promise<string>;
  private readonly verifier: (token: string) => unknown;

  constructor(secret: string) {
    this.signer = createSigner({
      key: secret,
      algorithm: 'HS256',
      // `fast-jwt` interpreta un `expiresIn` numerico en MILISEGUNDOS, no en
      // segundos: pasar `900` a mano expiria el token al cabo de un segundo.
      // La duracion se pasa en milisegundos, calculada aqui con el mismo
      // parser que usa `jsonwebtoken` (el de NestJS).
      expiresIn:
        parseDurationToSeconds(appConfig.auth.accessTtl || '15m') * 1000,
    });
    this.verifier = createVerifier({
      key: secret,
      algorithms: ['HS256'],
    });
  }

  /** Firmar un access token de corta duracion. */
  async signAccessToken(userId: string, email: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      jti: randomUUID(),
    };
    return await this.signer(payload);
  }

  /**
   * Verificar un access token. Lanza `UnauthorizedException` si el token es
   * invalido, ha expirado o no esta firmado con HS256.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return (await this.verifier(token)) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Credenciales invalidas');
    }
  }

  /** Vida del access token en segundos (para la respuesta de la API). */
  get accessTokenTtlSeconds(): number {
    const ttl = appConfig.auth.accessTtl || '15m';
    return parseDurationToSeconds(ttl);
  }

  /** Vida del refresh token en segundos. */
  get refreshTokenTtlSeconds(): number {
    const ttl = appConfig.auth.refreshTtl || '30d';
    return parseDurationToSeconds(ttl);
  }
}

/**
 * Convierte una duracion en notacion abreviada (`15m`, `1h`, `30d`,
 * `900`) a segundos. Formato compatible con el que usa `jsonwebtoken`.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d|w)?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Duracion invalida: ${value}`);
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return amount * (multipliers[unit] ?? 1);
}
