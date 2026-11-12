import { randomBytes } from 'node:crypto';

/**
 * Datos que se guardan mientras dura un flujo OAuth.
 *
 * `state` es el valor opaco que viaja en la redireccion y sirve de defensa
 * contra CSRF. `codeVerifier` es el secret de PKCE (S256): nunca sale del
 * servidor y solo se usa en el intercambio del authorization code.
 */
export interface OAuthStateEntry {
  state: string;
  codeVerifier?: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Almacen de `state` de OAuth con expiracion corta.
 *
 * Implementacion en memoria: es suficiente para una unica instancia de la
 * API. Con varias instancias (o para sobrevivir a un reinicio) hay que
 * moverlo a Redis o a una tabla de tokens de un solo uso; la interfaz
 * (`create`, `consume`) no cambia.
 */
export class OAuthStateService {
  private readonly entries = new Map<string, OAuthStateEntry>();

  /** Vida del `state`: 10 minutos. */
  private static readonly TTL_MS = 10 * 60 * 1000;

  /**
   * Crea un `state` aleatorio y registra su `codeVerifier` (opcional).
   * Devuelve el valor que debe ir en la query de autorizacion.
   */
  create(codeVerifier?: string): string {
    const state = randomBytes(32).toString('base64url');
    const now = Date.now();
    this.entries.set(state, {
      state,
      codeVerifier,
      createdAt: now,
      expiresAt: now + OAuthStateService.TTL_MS,
    });
    return state;
  }

  /**
   * Consume un `state`: lo devuelve una sola vez y lo elimina. Si no existe
   * o ha expirado, devuelve `null` (el flujo se rechaza).
   */
  consume(state: string): OAuthStateEntry | null {
    const entry = this.entries.get(state);
    if (!entry) {
      return null;
    }
    this.entries.delete(state);
    if (entry.expiresAt < Date.now()) {
      return null;
    }
    return entry;
  }

  /** Elimina las entradas caducadas. */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }
}
