import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Franchise } from './entities/franchise.entity.js';
import { FranchisePlayOrder } from './entities/franchise-play-order.entity.js';
import { FranchisesService } from './franchises.service.js';
import { FranchisesController } from './franchises.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Franchise, FranchisePlayOrder])],
  controllers: [FranchisesController],
  providers: [FranchisesService],
  exports: [FranchisesService, TypeOrmModule],
})
export class FranchisesModule {}
