import { pino, type Logger } from 'pino';
import { appConfig } from './config.js';

/**
 * Logger de la aplicacion.
 *
 * En NestJS cada servicio tenia su propio `Logger`, que escribia por
 * `console` con el nombre de la clase como contexto. Ahora hay un unico
 * logger (pino, el mismo motor que usa Fastify) del que cada servicio saca
 * una instancia con su contexto, de modo que la salida sigue identificando
 * de donde viene cada linea.
 *
 * `log()` se conserva por compatibilidad con el `Logger` de NestJS y escribe
 * en el nivel `info`.
 */
export interface AppLogger {
  /** Mensaje informativo. */
  log(message: string): void;
  /** Aviso: algo raro pero no rompe el flujo. */
  warn(message: string): void;
  /** Error. */
  error(message: string): void;
  /** Detalle para depurar. */
  debug(message: string): void;
}

/**
 * Logger raiz.
 *
 * El nivel depende del entorno: `debug` en desarrollo, `info` en produccion y
 * `error` en los tests, donde el ruido de los sincronizadores taparia el
 * resultado de las pruebas.
 */
const raiz: Logger = pino({
  level:
    appConfig.nodeEnv === 'production'
      ? 'info'
      : appConfig.nodeEnv === 'test'
        ? 'error'
        : 'debug',
});

/**
 * Crea el logger de un servicio.
 *
 * @param context Nombre del servicio o del modulo, el mismo que usaba el
 * `Logger` de NestJS.
 */
export function createLogger(context: string): AppLogger {
  const log = raiz.child({ context });
  return {
    log: (message: string) => log.info(message),
    warn: (message: string) => log.warn(message),
    error: (message: string) => log.error(message),
    debug: (message: string) => log.debug(message),
  };
}
