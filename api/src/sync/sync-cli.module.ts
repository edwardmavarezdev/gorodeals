import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '../config/configuration.js';
import { dataSourceOptions } from '../database/data-source.js';
import { SyncModule } from './sync.module.js';

/**
 * Modulo raiz para el script de CLI `scripts/sync-random-games.ts`.
 *
 * Levanta solo lo necesario (configuracion + conexion + `SyncModule`), sin
 * servidor HTTP ni tareas programadas: el script puede ejecutarse con la API
 * apagada.
 *
 * No se registra en `AppModule` a proposito: la API ya configura su propia
 * conexion y su propio `ConfigModule`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRoot(dataSourceOptions),
    SyncModule,
  ],
})
export class SyncCliModule {}
