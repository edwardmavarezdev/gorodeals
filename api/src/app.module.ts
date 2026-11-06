import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { validationSchema } from './config/validation.js';
import { GamesModule } from './games/games.module.js';
import { StoreProductsModule } from './store-products/store-products.module.js';
import { PricesModule } from './prices/prices.module.js';
import { FranchisesModule } from './franchises/franchises.module.js';
import { SteamModule } from './steam/steam.module.js';
import { IgdbModule } from './igdb/igdb.module.js';
import { PriceSyncModule } from './price-sync/price-sync.module.js';
import { SyncModule } from './sync/sync.module.js';
import { DealsModule } from './deals/deals.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        ssl: config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        namingStrategy: new SnakeNamingStrategy(),
        /**
         * Pool de conexiones de pg. El servidor PostgreSQL admite 100
         * conexiones en desarrollo, asi que un maximo de 20 deja margen para
         * el CLI de migraciones y las sesiones de psql.
         */
        extra: {
          max: config.get<number>('database.poolMax') ?? 20,
          idleTimeoutMillis:
            config.get<number>('database.poolIdleTimeoutMs') ?? 30_000,
          connectionTimeoutMillis:
            config.get<number>('database.poolConnectionTimeoutMs') ?? 5_000,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    GamesModule,
    StoreProductsModule,
    PricesModule,
    FranchisesModule,
    IgdbModule,
    SteamModule,
    PriceSyncModule,
    SyncModule,
    DealsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
