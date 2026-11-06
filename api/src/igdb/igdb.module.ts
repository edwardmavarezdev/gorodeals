import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../games/entities/game.entity.js';
import { IgdbAdminGuard } from './igdb-admin.guard.js';
import { IgdbClient } from './igdb.client.js';
import { IgdbController } from './igdb.controller.js';
import { IgdbService } from './igdb.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  controllers: [IgdbController],
  providers: [IgdbClient, IgdbService, IgdbAdminGuard],
  exports: [IgdbService, IgdbClient],
})
export class IgdbModule {}
