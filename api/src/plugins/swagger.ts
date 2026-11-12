import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * Documentacion OpenAPI.
 *
 * El documento se genera a partir de los mismos esquemas TypeBox que
 * validan las entradas y las respuestas: no hay una segunda descripcion
 * del API que pueda quedarse obsoleta.
 *
 * En NestJS lo montaba `@nestjs/swagger` con los decoradores
 * `@ApiOperation` y `@ApiResponse`. Aqui la equivalencia es:
 *
 * - `schema.description` -> `@ApiOperation.summary` / `.description`
 * - `schema.response`    -> `@ApiOkResponse` / `@ApiNotFoundResponse`, ...
 */
export const swaggerPlugin = fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'GoRoDeals API',
        description:
          'API de seguimiento de precios de videojuegos y rutas de sagas',
        version: '0.1.0',
      },
      tags: [
        { name: 'deals', description: 'Ofertas destacadas' },
        { name: 'games', description: 'Ficha de un juego' },
        { name: 'catalog', description: 'Catalogo paginado' },
        { name: 'prices', description: 'Historico de precios' },
        { name: 'franchises', description: 'Sagas y rutas de juego' },
        { name: 'publications', description: 'Contenido editorial' },
        { name: 'auth', description: 'Cuentas de usuario' },
        { name: 'wishlist', description: 'Lista de deseos' },
        { name: 'igdb', description: 'Ingesta desde IGDB' },
        { name: 'steam', description: 'Ingesta desde Steam' },
        { name: 'price-sync', description: 'Sincronizacion de precios' },
        { name: 'health', description: 'Estado del servicio' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });
});
