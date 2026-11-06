import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SteamController } from './steam.controller.js';
import { SteamAdminGuard } from './steam-admin.guard.js';
import { SteamService } from './steam.service.js';
import { SteamClient } from './steam.client.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { Game } from '../games/entities/game.entity.js';

/**
 * Modulo de la tienda de Steam. Expone el cliente HTTP y el servicio para
 * que el modulo de sincronizacion de precios (Fase 3.3) pueda consumir el
 * precio actual de un producto ya persistido.
 */
@Module({
  imports: [TypeOrmModule.forFeature([StoreProduct, Game])],
  controllers: [SteamController],
  providers: [SteamClient, SteamService, SteamAdminGuard],
  exports: [SteamClient, SteamService],
})
export class SteamModule {}
