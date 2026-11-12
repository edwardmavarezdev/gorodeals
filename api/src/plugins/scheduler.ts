import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { CronJob } from 'cron';
import { appConfig } from '../config.js';

/** Nombre del job en el registro de tareas programadas. */
export const PRICE_SYNC_CRON_NAME = 'price-sync.daily';

/**
 * Tarea programada de auditoria diaria de precios.
 *
 * Sustituye a `PriceSyncScheduler` de NestJS. El job se registra de forma
 * dinamica (no con el decorador `@Cron`) para que la expresion cron y la
 * decision de activarlo provengan de la configuracion, y no de variables de
 * entorno leidas al cargar el modulo.
 *
 * La zona horaria es siempre UTC: el historico se trunca al dia en UTC y el
 * dia debe ser el mismo en el job y en la base de datos.
 */
export const schedulerPlugin = fp((fastify) => {
  let job: CronJob | null = null;

  fastify.addHook('onReady', () => {
    const enabled = appConfig.priceSync.enabled ?? true;
    const expression = appConfig.priceSync.cron ?? '0 6 * * *';

    if (!enabled) {
      fastify.log.warn(
        'Sincronizacion de precios desactivada (PRICE_SYNC_ENABLED=false)',
      );
      return;
    }

    try {
      job = new CronJob(
        expression,
        () => {
          void runScheduledSync(fastify);
        },
        null,
        false,
        'UTC',
      );

      job.start();

      fastify.log.info(
        `Cron de sincronizacion de precios registrado: "${expression}" (UTC), ` +
          `nombre=${PRICE_SYNC_CRON_NAME}, proxima ejecucion=${job
            .nextDate()
            .toJSDate()
            .toISOString()}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      fastify.log.error(
        `No se pudo registrar el cron de sincronizacion "${expression}": ${message}`,
      );
    }
  });

  fastify.addHook('onClose', async () => {
    if (job) {
      try {
        void job.stop();
      } catch {
        // El job puede haberse parado ya durante el apagado.
      }
      job = null;
    }

    // Se libera el lock de sincronizacion: en NestJS lo hacia el hook
    // `onModuleDestroy()` del servicio. Fastify no invoca ese metodo por su
    // cuenta, asi que el apagado ordenado lo llama aqui. Este hook se
    // ejecuta antes que el de la base de datos (los hooks `onClose` corren
    // en orden inverso al de registro), de modo que la conexion sigue viva.
    try {
      await fastify.services?.priceSync?.onDestroy();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      fastify.log.warn(
        `No se pudo liberar el lock de sincronizacion al apagar: ${message}`,
      );
    }
  });

  return Promise.resolve();
});

/**
 * Ejecuta el ciclo programado. Los errores se registran, no propagan.
 */
async function runScheduledSync(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('Comienza el ciclo programado de sincronizacion de precios');
  try {
    const result = await fastify.services.priceSync.runSync();
    if (result.skipped) {
      fastify.log.warn(`Ciclo omitido: ${result.skipReason ?? 'sin motivo'}`);
      return;
    }
    fastify.log.info(
      `Ciclo programado completado: ${result.totals.processed} productos, ` +
        `${result.totals.historyInserted} altas de historico`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'error desconocido';
    fastify.log.error(
      `Fallo el ciclo programado de sincronizacion: ${message}`,
    );
  }
}
