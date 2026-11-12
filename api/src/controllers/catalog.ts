import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { CatalogQuery, CatalogResponse } from '../schemas/catalog.js';

/**
 * Catalogo de juegos.
 *
 * Sustituye a `CatalogController` de NestJS. La ruta es publica (la
 * consume el frontend Astro sin autenticar) y por eso declara
 * `config: { auth: 'disabled' }`.
 */
export const catalogController: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: Static<typeof CatalogQuery> }>(
    '/catalog',
    {
      schema: {
        tags: ['catalog'],
        summary: 'Catalogo de juegos paginado',
        description:
          'Pagina del catalogo con la mejor oferta de cada juego. Admite ' +
          'filtro por titulo (`q`), por tienda (`store`) y tres ' +
          'ordenaciones: `recent` (fecha de salida), `quality` (score de ' +
          'calidad) y `discount` (mejor descuento primero).',
        querystring: CatalogQuery,
        response: { 200: CatalogResponse },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.games.listCatalog(request.query);
    },
  );
  return Promise.resolve();
};
