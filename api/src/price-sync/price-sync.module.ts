import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IgdbModule } from '../igdb/igdb.module.js';
import { SteamModule } from '../steam/steam.module.js';
import { PriceHistory } from '../prices/entities/price-history.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { PriceHistoryService } from './history/price-history.service.js';
import { SteamPriceProvider } from './providers/steam-price.provider.js';
import { PriceSyncAdminGuard } from './price-sync-admin.guard.js';
import { PriceSyncController } from './price-sync.controller.js';
import { PriceSyncScheduler } from './price-sync.scheduler.js';
import { PriceSyncService } from './price-sync.service.js';

/**
 * Modulo de sincronizacion de precios (Fase 3.3).
 *
 * - `PriceSyncScheduler`: cron diario (UTC) que dispara la auditoria.
 * - `PriceSyncService`: orquestador, unaware del detalle de cada tienda.
 * - `SteamPriceProvider`: proveedor de precios de Steam.
 * - `PriceHistoryService`: escritura idempotente de `price_history` y
 *   actualizacion de `store_products`.
 *
 * El `ScheduleModule` se registra de forma global en `AppModule`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StoreProduct, PriceHistory]),
    SteamModule,
    IgdbModule,
  ],
  controllers: [PriceSyncController],
  providers: [
    PriceSyncService,
    PriceSyncScheduler,
    PriceSyncAdminGuard,
    PriceHistoryService,
    SteamPriceProvider,
  ],
  exports: [PriceSyncService, PriceHistoryService],
})
export class PriceSyncModule {}
