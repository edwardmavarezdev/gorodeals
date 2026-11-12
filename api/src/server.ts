import Fastify, { LogController } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { appConfig, assertValidEnvironment } from './config.js';
import { databasePlugin } from './plugins/database.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { corePlugin } from './plugins/core.js';
import { schedulerPlugin } from './plugins/scheduler.js';
import { healthController } from './controllers/health.js';
import { catalogController } from './controllers/catalog.js';
import { gamesController } from './controllers/games.js';
import { pricesController } from './controllers/prices.js';
import { franchisesController } from './controllers/franchises.js';
import { dealsController } from './controllers/deals.js';
import { publicationsController } from './controllers/publications.js';
import { authController } from './controllers/auth.js';
import { adminSyncController } from './controllers/admin-sync.js';
import { priceSyncController } from './controllers/price-sync.js';
import { wishlistController } from './controllers/wishlist.js';
import { steamController } from './controllers/steam.js';
import { igdbController } from './controllers/igdb.js';

/**
 * Construye la aplicacion Fastify.
 *
 * Es una funcion **pura**: no abre ningun puerto. Devuelve la instancia con
 * los plugins, los hooks y las rutas ya registradas, lista para
 * `listen()` en produccion y para `inject()` en los tests.
 *
 * Los tests usan exactamente la misma instancia que se despliega, asi que no
 * puede haber una diferencia entre "lo que se prueba" y "lo que corre".
 */
export async function buildServer() {
  assertValidEnvironment();

  const fastify = Fastify({
    logger: {
      level: appConfig.nodeEnv === 'production' ? 'info' : 'debug',
    },
    // Fastify registra cada peticion por su cuenta; el hook de trazabilidad
    // ya lo hace con el id de peticion y la duracion.
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
    ajv: {
      customOptions: {
        // Los `numeric` de PostgreSQL llegan como `string`: sin esta
        // opcion Ajv los rechazaria al validar la respuesta.
        coerceTypes: 'array',
        useDefaults: true,
        removeAdditional: false,
        // NestJS devolvia una lista con todos los errores de validacion,
        // no solo el primero: `allErrors` mantiene esa forma.
        allErrors: true,
        // Las anotaciones de OpenAPI (`example`, `examples`) no son
        // palabras clave de JSON Schema: Ajv en modo estricto las
        // rechazaria al construir el esquema de la ruta.
        strictSchema: false,
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  /**
   * Fastify rechaza con 400 un cuerpo vacio cuando la cabecera dice
   * `application/json`. Express (y por tanto NestJS) lo aceptaba, asi que
   * un `DELETE` sin cuerpo pero con la cabecera de JSON fallaba en la
   * version de Fastify. Se acepta el cuerpo vacio como `{}`.
   */
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      if (!body) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  // El orden importa: la base de datos primero (el nucleo construye el
  // grafo de servicios a partir de ella), despues el middleware, y por
  // ultimo los controladores.
  fastify.register(databasePlugin);
  fastify.register(corsPlugin);
  fastify.register(rateLimitPlugin);
  fastify.register(swaggerPlugin);
  fastify.register(corePlugin);
  fastify.register(schedulerPlugin);

  fastify.register(healthController);
  fastify.register(catalogController);
  fastify.register(gamesController);
  fastify.register(pricesController);
  fastify.register(franchisesController);
  fastify.register(dealsController);
  fastify.register(publicationsController);
  fastify.register(authController);
  fastify.register(adminSyncController);
  fastify.register(priceSyncController);
  fastify.register(wishlistController);
  fastify.register(steamController);
  fastify.register(igdbController);

  await fastify.ready();
  return fastify;
}
