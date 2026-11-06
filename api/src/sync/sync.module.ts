import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../games/entities/game.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { PriceHistory } from '../prices/entities/price-history.entity.js';
import { AdminSyncController } from './admin-sync.controller.js';
import { SyncRandomGamesService } from './sync-random-games.service.js';

/**
 * Modulo de sincronizacion de juegos de prueba.
 *
 * Expone `POST /admin/sync/random` (protegido con `x-admin-secret`) y el
 * servicio que reutiliza el script de CLI `scripts/sync-random-games.ts`.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Game, StoreProduct, PriceHistory]),
  ],
  controllers: [AdminSyncController],
  providers: [SyncRandomGamesService],
  exports: [SyncRandomGamesService],
})
export class SyncModule {}
