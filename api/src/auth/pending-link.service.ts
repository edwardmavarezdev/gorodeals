import { randomBytes } from 'node:crypto';

/**
 * Identidad social pendiente de vincular a un usuario local.
 *
 * Cuando un login social trae un email que ya existe en `users`, NO se
 * vincula automaticamente: la coincidencia de email no prueba que las dos
 * cuentas sean la misma. En su lugar se emite un `linkToken` de un solo uso
 * que el cliente debera canjear tras autenticarse con email y contrasena.
 */
export interface PendingLink {
  token: string;
  provider: string;
  providerAccountId: string;
  nickname: string | null;
  avatarUrl: string | null;
  email: string | null;
  createdAt: number;
  expiresAt: number;
}

/**
 * Almacen de vinculaciones pendientes, en memoria y con expiracion corta
 * (10 minutos). Misma limitacion que `OAuthStateService`: con varias
 * instancias hay que moverlo a Redis o a una tabla.
 */
export class PendingLinkService {
  private readonly entries = new Map<string, PendingLink>();

  private static readonly TTL_MS = 10 * 60 * 1000;

  create(
    data: Omit<PendingLink, 'token' | 'createdAt' | 'expiresAt'>,
  ): PendingLink {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    const entry: PendingLink = {
      ...data,
      token,
      createdAt: now,
      expiresAt: now + PendingLinkService.TTL_MS,
    };
    this.entries.set(token, entry);
    return entry;
  }

  /** Consume el token: un solo uso. Devuelve `null` si no existe o caduca. */
  consume(token: string): PendingLink | null {
    const entry = this.entries.get(token);
    if (!entry) {
      return null;
    }
    this.entries.delete(token);
    if (entry.expiresAt < Date.now()) {
      return null;
    }
    return entry;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }
}
