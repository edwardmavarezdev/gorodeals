import { Module } from '@nestjs/common';
import { DealScoreService } from './deal-score.service.js';
import { DealsService } from './deals.service.js';
import { DealsController } from './deals.controller.js';

/**
 * Modulo de ofertas. No necesita repositorios propios: el catalogo de
 * ofertas se consulta con SQL sobre `store_products` y `games` desde el
 * servicio de deals.
 */
@Module({
  controllers: [DealsController],
  providers: [DealsService, DealScoreService],
  exports: [DealsService, DealScoreService],
})
export class DealsModule {}
