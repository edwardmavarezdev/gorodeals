import { UnauthorizedException } from '../errors.js';
import * as argon2 from 'argon2';
import type { HashOptions as Argon2Options } from 'argon2';

/**
 * Hash de contrasenas con argon2id.
 *
 * Parametros: memoria 19456 KiB (19 MiB), iteraciones 2 y paralelismo 1.
 * Son los valores minimos recomendados por OWASP para argon2id y los que
 * recomienda la propia libreria; no se bajan "para ahorrar tiempo".
 */
const ARGON2_OPTIONS: Argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Contrasena usada para generar el hash "dummy" que iguala el tiempo de
 * respuesta del login cuando el email no existe.
 */
const DUMMY_PASSWORD = 'gorodeals-timing-equalizer-placeholder';

/**
 * Contrasenas demasiado comunes o triviales. Es una lista corta y
 * orientativa: el objetivo es rechazar las 20 contrasenas mas usadas sin
 * البنcostes de memoria (no un dictionary completo).
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'admin123',
  'administrator',
  'welcome1',
  'letmein1',
  'changeme',
  'gorodeals',
  'steam123',
  'abc12345',
]);

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Servicio de hashing y verificacion de contrasenas.
 *
 * Es la unica pieza que toca la libreria de hash: el resto del modulo de
 * autenticacion solo usa `hash` y `verify`.
 */
export class PasswordService {
  /**
   * Hash de una contrasena ficticia, generado una sola vez y cacheado.
   *
   * Se verifica contra el para que el login con un email inexistente tarde
   * lo mismo que el login con una contrasena incorrecta, y asi no se pueda
   * enumerar que emails estan registrados.
   */
  private dummyHash: Promise<string> | null = null;

  /**
   * Ejecuta la verificacion contra el hash dummy y siempre devuelve
   * `false`. Es lo que se llama cuando el usuario no existe.
   */
  async verifyDummy(password: string): Promise<boolean> {
    if (!this.dummyHash) {
      this.dummyHash = this.hash(DUMMY_PASSWORD);
    }
    const hash = await this.dummyHash;
    return this.verify(hash, password);
  }

  /**
   * Hash de una contrasena con argon2id. Nunca se registra ni se devuelve
   * el resultado en logs.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verifica una contrasena contra su hash. Devuelve `false` en lugar de
   * lanzar para que el llamante no distinga entre hash corrupto y
   * contrasena incorrecta.
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Valida la fortaleza de una contrasena antes de guardarla. Lanza
   * `WeakPasswordError` (400) con el motivo.
   */
  validateStrength(password: string): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new WeakPasswordError(
        `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      );
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new WeakPasswordError(
        `La contrasena no puede superar ${PASSWORD_MAX_LENGTH} caracteres`,
      );
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new WeakPasswordError(
        'Esa contrasena es demasiado comun: elige otra',
      );
    }
    if (/^(.)\1+$/.test(password)) {
      throw new WeakPasswordError(
        'Esa contrasena es demasiado trivial: elige otra',
      );
    }
    const hasLetter = /[A-Za-z]/.test(password);
    const hasOther = /[^A-Za-z]/.test(password);
    if (!hasLetter || !hasOther) {
      throw new WeakPasswordError(
        'La contrasena debe combinar letras con numeros o simbolos',
      );
    }
  }
}

/**
 * Contrasena demasiado debil. 400 porque el problema es la entrada, no la
 * credencial.
 */
export class WeakPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
  }
}

/**
 * Credenciales invalidas. 401 con mensaje generico: nunca distingue entre
 * "el email no existe" y "la contrasena no coincide".
 */
export class InvalidCredentialsError extends UnauthorizedException {
  constructor() {
    super('Credenciales invalidas');
  }
}
