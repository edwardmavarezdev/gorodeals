import { randomBytes } from 'node:crypto';
import type { Static } from '@sinclair/typebox';
import { AuthResponse } from '../schemas/auth.js';

/**
 * Traspaso de una sesion social al frontend.
 *
 * El callback de Google o de Steam lo invoca el navegador, no el frontend:
 * al terminar, el navegador acaba en la URL de la API, no en la del sitio.
 * Poner los tokens en la query de redireccion los dejaria en el historial del
 * navegador, en los logs del servidor y en la cabecera `Referer`.
 *
 * En su lugar, el callback guarda la sesion aqui bajo un codigo opaco de un
 * solo uso y redirige al frontend con ese codigo. El frontend canjea el
 * codigo por la sesion con `POST /auth/social/exchange`, que es una peticion
 * sin tokens en la URL.
 *
 * Implementacion en memoria, como `OAuthStateService`: con varias instancias
 * hay que moverla a Redis o a una tabla.
 */
export class SocialHandoffService {
  /** Vida del codigo: 2 minutos. Es tiempo de sobra para el canje. */
  private static readonly TTL_MS = 2 * 60 * 1000;

  private readonly entries = new Map<
    string,
    { response: Static<typeof AuthResponse>; expiresAt: number }
  >();

  /** Registra la sesion y devuelve el codigo de un solo uso. */
  create(response: Static<typeof AuthResponse>): string {
    const code = randomBytes(32).toString('base64url');
    this.entries.set(code, {
      response,
      expiresAt: Date.now() + SocialHandoffService.TTL_MS,
    });
    return code;
  }

  /**
   * Consume el codigo: se devuelve una sola vez y se elimina. Si no existe
   * o ha expirado devuelve `null`.
   */
  consume(code: string): Static<typeof AuthResponse> | null {
    const entry = this.entries.get(code);
    if (!entry) {
      return null;
    }
    this.entries.delete(code);
    if (entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.response;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [code, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(code);
      }
    }
  }
}
