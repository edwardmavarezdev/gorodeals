import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceHistory } from './entities/price-history.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { PricesService } from './prices.service.js';
import { PricesController } from './prices.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([PriceHistory, StoreProduct])],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService, TypeOrmModule],
})
export class PricesModule {}
