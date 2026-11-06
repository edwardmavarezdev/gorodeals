import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'gorodeals',
  password: process.env.DB_PASSWORD ?? 'gorodeals',
  database: process.env.DB_NAME ?? 'gorodeals',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
  logging: ['error', 'warn'],
  /**
   * Pool de conexiones de pg, con los mismos valores por defecto que la
   * aplicacion (`DB_POOL_*`). El CLI de migraciones comparte el data source
   * con la app, de modo que ambos usan el mismo limite.
   */
  extra: {
    max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    idleTimeoutMillis: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000',
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? '5000',
      10,
    ),
  },
};

export default new DataSource(dataSourceOptions);
