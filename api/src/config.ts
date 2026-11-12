import { randomBytes } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import configuration, { type AppConfig } from './config/configuration.js';

/**
 * Configuracion de la aplicacion.
 *
 * En NestJS la cargaba `ConfigModule` y se leia siempre a traves de
 * `ConfigService`. Aqui se construye una vez al arrancar el proceso y se
 * expone como un objeto plano: `appConfig.steam.timeoutMs` en lugar de
 * `configService.get('steam.timeoutMs')`.
 *
 * La forma del objeto y los nombres de las variables de entorno **no
 * cambian**: el `.env` de desarrollo y el de produccion siguen valiendo.
 */
loadDotenv();

/** Configuracion ya resuelta y validada. */
export const appConfig: AppConfig = configuration();

/**
 * Secreto de firma de los access tokens, resuelto una sola vez por proceso.
 *
 * Si `JWT_SECRET` esta configurado y tiene 32 caracteres o mas, se usa. En
 * produccion es obligatorio: un secreto por defecto en el codigo seria peor
 * que no arrancar. En desarrollo, si falta, se genera uno efimero (los
 * tokens no sobreviven a un reinicio, pero la app se puede levantar sin
 * tocar el `.env`).
 */
let ephemeralJwtSecret: string | null = null;

export function resolveJwtSecret(): string {
  const secret = appConfig.auth.jwtSecret;
  if (secret.length >= 32) {
    return secret;
  }
  if (appConfig.nodeEnv === 'production') {
    throw new Error(
      'JWT_SECRET no esta configurado o es demasiado corto (minimo 32 ' +
        'caracteres). Es obligatorio en produccion.',
    );
  }
  // El secreto efimero se memoiza: dentro del mismo proceso, el servidor y
  // los scripts tienen que firmar y verificar con la misma clave.
  ephemeralJwtSecret ??= randomBytes(48).toString('hex');
  return ephemeralJwtSecret;
}

/**
 * Variables obligatorias, con el motivo por el que hacen falta. Si falta
 * alguna, el proceso no arranca: es preferible fallar de forma explicita
 * que descubrir a mitad de una peticion que la base de datos no existe.
 */
const REQUIRED_ENV: { name: string; reason: string }[] = [
  { name: 'DB_HOST', reason: 'conexion a PostgreSQL' },
  { name: 'DB_USER', reason: 'conexion a PostgreSQL' },
  { name: 'DB_PASSWORD', reason: 'conexion a PostgreSQL' },
  { name: 'DB_NAME', reason: 'conexion a PostgreSQL' },
];

/**
 * Valida el entorno y devuelve la lista de problemas encontrados.
 *
 * Sustituye al esquema Joi de NestJS: las mismas reglas, pero escritas a
 * mano y con un mensaje que dice exactamente que variable falta y por que.
 */
export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];

  for (const { name, reason } of REQUIRED_ENV) {
    if (!env[name]) {
      problems.push(`Falta la variable de entorno ${name} (${reason}).`);
    }
  }

  const nodeEnv = env.NODE_ENV ?? 'development';
  const jwtSecret = env.JWT_SECRET ?? '';
  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    problems.push(
      'JWT_SECRET no esta configurado o es demasiado corto (minimo 32 ' +
        'caracteres). Es obligatorio en produccion.',
    );
  }

  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT no es un puerto valido: ${env.PORT}`);
  }

  return problems;
}

/**
 * Arranca el proceso si el entorno es invalido. El mensaje enumera todos
 * los problemas, no solo el primero, para no arreglar los errores de uno en
 * uno.
 */
export function assertValidEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const problems = validateEnvironment(env);
  if (problems.length > 0) {
    throw new Error(`Configuracion invalida:\n  - ${problems.join('\n  - ')}`);
  }
}

export type { AppConfig };
