import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { PricesModule } from '../prices/prices.module.js';
import { FranchisesModule } from '../franchises/franchises.module.js';
import { DealsModule } from '../deals/deals.module.js';
import { GamesService } from './games.service.js';
import { GamesController } from './games.controller.js';
import { CatalogController } from './catalog.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, StoreProduct]),
    PricesModule,
    FranchisesModule,
    DealsModule,
  ],
  controllers: [GamesController, CatalogController],
  providers: [GamesService],
  exports: [GamesService, TypeOrmModule],
})
export class GamesModule {}
