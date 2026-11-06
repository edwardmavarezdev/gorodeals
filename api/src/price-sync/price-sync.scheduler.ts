import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PriceSyncService } from './price-sync.service.js';

/** Nombre del job en el registro de tareas programadas. */
export const PRICE_SYNC_CRON_NAME = 'price-sync.daily';

/**
 * Tarea programada de auditoria diaria de precios.
 *
 * El job se registra dinamicamente (en lugar de usar el decorador `@Cron`)
 * para que la expresion cron y la decision de activarlo provengan de la
 * configuracion (`ConfigService`), y no de variables de entorno leidas al
 * cargar el modulo. La zona horaria es siempre UTC: el historico se
 * trunca al dia en UTC y el dia debe ser el mismo en el job y en la base de
 * datos.
 */
@Injectable()
export class PriceSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceSyncScheduler.name);
  private job: CronJob | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly priceSyncService: PriceSyncService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<boolean>('priceSync.enabled') ?? true;
    const expression = this.config.get<string>('priceSync.cron') ?? '0 6 * * *';

    if (!enabled) {
      this.logger.warn(
        'Sincronizacion de precios desactivada (PRICE_SYNC_ENABLED=false)',
      );
      return;
    }

    try {
      this.job = new CronJob(
        expression,
        () => {
          void this.runScheduledSync();
        },
        null,
        false,
        'UTC',
      );

      this.schedulerRegistry.addCronJob(PRICE_SYNC_CRON_NAME, this.job);
      this.job.start();

      this.logger.log(
        `Cron de sincronizacion de precios registrado: "${expression}" (UTC), ` +
          `nombre=${PRICE_SYNC_CRON_NAME}, proxima ejecucion=${this.job
            .nextDate()
            .toJSDate()
            .toISOString()}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(
        `No se pudo registrar el cron de sincronizacion "${expression}": ${message}`,
      );
    }
  }

  onModuleDestroy(): void {
    if (this.job) {
      try {
        void this.job.stop();
        this.schedulerRegistry.deleteCronJob(PRICE_SYNC_CRON_NAME);
      } catch {
        // El registro puede haberse limpiado ya durante el apagado.
      }
      this.job = null;
    }
  }

  /** Ejecuta el ciclo programado. Los errores se registran, no propagan. */
  private async runScheduledSync(): Promise<void> {
    this.logger.log(
      'Comienza el ciclo programado de sincronizacion de precios',
    );
    try {
      const result = await this.priceSyncService.runSync();
      if (result.skipped) {
        this.logger.warn(`Ciclo omitido: ${result.skipReason ?? 'sin motivo'}`);
        return;
      }
      this.logger.log(
        `Ciclo programado completado: ${result.totals.processed} productos, ` +
          `${result.totals.historyInserted} altas de historico`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(
        `Fallo el ciclo programado de sincronizacion: ${message}`,
      );
    }
  }
}
