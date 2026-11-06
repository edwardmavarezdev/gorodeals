import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreProduct } from './entities/store-product.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([StoreProduct])],
  exports: [TypeOrmModule],
})
export class StoreProductsModule {}
