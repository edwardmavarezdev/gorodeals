import fp from 'fastify-plugin';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { appConfig } from '../config.js';

/**
 * Plugin de base de datos.
 *
 * Crea el `DataSource` de TypeORM, lo inicializa y lo decora en la
 * instancia de Fastify como `fastify.db`. No hay contenedor de inyeccion de
 * dependencias: los servicios reciben lo que necesitan por parametro, y el
 * repositorio se pide aqui a `fastify.db`.
 *
 * TypeORM se mantiene tal cual: `synchronize: false`, `SnakeNamingStrategy`
 * y las mismas migraciones. La capa de datos no cambia con el framework.
 */
export const databasePlugin = fp(async (fastify) => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: appConfig.database.host,
    port: appConfig.database.port,
    username: appConfig.database.username,
    password: appConfig.database.password,
    database: appConfig.database.database,
    ssl: appConfig.database.ssl ? { rejectUnauthorized: false } : false,
    namingStrategy: new SnakeNamingStrategy(),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
    extra: {
      max: appConfig.database.poolMax,
      idleTimeoutMillis: appConfig.database.poolIdleTimeoutMs,
      connectionTimeoutMillis: appConfig.database.poolConnectionTimeoutMs,
    },
  });

  await dataSource.initialize();
  fastify.decorate('db', dataSource);

  fastify.addHook('onClose', async () => {
    await dataSource.destroy();
  });
});
