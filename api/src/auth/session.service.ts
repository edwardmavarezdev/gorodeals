import { UnauthorizedException } from '../errors.js';
import { DataSource, IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { TokenService } from './token.service.js';

/**
 * SHA-256 en hexadecimal. El refresh token es una credencial de portadora:
 * en la base de datos solo se guarda su hash, de modo que una filtracion de
 * la base de datos no permite autenticarse.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Genera un refresh token opaco de 48 bytes aleatorios en base64url. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Metadatos del cliente que se guardan con la sesion. */
export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * Emision, rotacion y revocacion de sesiones (refresh tokens).
 *
 * La rotacion es estricta: cada uso de un refresh token genera uno nuevo y
 * revoca el anterior. Si un token ya revocado se vuelve a presentar, se
 * trata como posible robo y se revocan todas las sesiones del usuario.
 */
export class SessionService {
  constructor(
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea una sesion nueva para el usuario. Devuelve el token opaco en claro
   * (unica vez: el cliente lo guarda) y la fila persistida.
   */
  async issue(
    userId: string,
    context: SessionContext = {},
  ): Promise<{ token: string; session: RefreshToken }> {
    const token = generateRefreshToken();
    const expiresAt = new Date(
      Date.now() + this.tokenService.refreshTokenTtlSeconds * 1000,
    );
    const session = await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        revokedAt: null,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
      }),
    );
    return { token, session };
  }

  /**
   * Rota un refresh token: valida la sesion, la revoca y emite una nueva.
   *
   * La revocacion es condicional (`revoked_at IS NULL`) dentro de la misma
   * sentencia: dos peticiones concurrentes con el mismo token hacen que solo
   * una gane la fila y la otra falle con `InvalidRefreshTokenError`, sin
   * relajar la revocacion.
   */
  async rotate(
    token: string,
    context: SessionContext = {},
  ): Promise<{ token: string; session: RefreshToken; userId: string }> {
    const tokenHash = hashToken(token);

    // Ojo: en un UPDATE, `dataSource.query()` devuelve `[filas, afectadas]`,
    // no las filas directamente. Hay que desempaquetar el primer elemento.
    const [claimed] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE "refresh_tokens"
         SET "revoked_at" = now(), "updated_at" = now()
       WHERE "token_hash" = $1
         AND "revoked_at" IS NULL
         AND "expires_at" > now()
       RETURNING "id"`,
      [tokenHash],
    );

    if (!claimed || claimed.length === 0) {
      // No se pudo reclamar el token: puede estar expirado, nunca existio
      // o ya estaba revocado. En el ultimo caso es una reutilizacion.
      const existing = await this.refreshTokenRepo.findOne({
        where: { tokenHash },
      });
      if (existing && existing.revokedAt !== null) {
        await this.revokeAllForUser(existing.userId);
        throw new RefreshTokenReuseDetectedError();
      }
      throw new InvalidRefreshTokenError();
    }

    // El propietario se lee de la entidad y no del `RETURNING` de la
    // sentencia cruda: el nombre de la columna devuelto por el driver no
    // tiene por que coincidir con el del atributo de la entidad.
    const claimedSession = await this.refreshTokenRepo.findOne({
      where: { id: claimed[0].id },
    });
    if (!claimedSession) {
      throw new InvalidRefreshTokenError();
    }

    const issued = await this.issue(claimedSession.userId, context);
    return { ...issued, userId: claimedSession.userId };
  }

  /** Revoca la sesion de un refresh token concreto. Idempotente. */
  async revoke(token: string): Promise<boolean> {
    const result = await this.refreshTokenRepo.update(
      { tokenHash: hashToken(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /** Revoca todas las sesiones vivas de un usuario. */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Sesiones vivas de un usuario (para el perfil y el listado). */
  async listActiveForUser(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }
}

/** Refresh token invalido, expirado o desconocido. 401. */
export class InvalidRefreshTokenError extends UnauthorizedException {
  constructor() {
    super('Refresh token invalido');
  }
}

/**
 * Se ha presentado un refresh token ya revocado: posible robo de token.
 * El servicio ya revoco todas las sesiones del usuario.
 */
export class RefreshTokenReuseDetectedError extends UnauthorizedException {
  constructor() {
    super('Refresh token invalido');
  }
}
