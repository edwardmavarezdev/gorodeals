import type { FastifyPluginAsync } from 'fastify';
import { FranchiseRoute, FranchiseSummaryList } from '../schemas/franchises.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Sagas y rutas de juego.
 *
 * Sustituye a `FranchisesController` de NestJS.
 */
export const franchisesController: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/franchises',
    {
      schema: {
        tags: ['franchises'],
        summary: 'Listado de sagas',
        description:
          'Devuelve las sagas registradas con el numero de juegos de cada ' +
          'una, para poder abrir su ruta de juego recomendada.',
        response: { 200: FranchiseSummaryList },
      },
      config: { auth: 'disabled' },
    },
    async () => {
      return fastify.services.franchises.findAll();
    },
  );

  fastify.get<{ Params: { slug: string } }>(
    '/franchises/:slug/route',
    {
      schema: {
        tags: ['franchises'],
        summary: 'Ruta de juego recomendada de una saga',
        description:
          'Devuelve los juegos de la saga ordenados por posicion, con una ' +
          'nota del editor en cada entrada y los metadatos minimos de cada ' +
          'juego.',
        params: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
        },
        response: {
          200: FranchiseRoute,
          404: errorResponse('La saga no existe'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.franchises.findRouteBySlug(request.params.slug);
    },
  );
  return Promise.resolve();
};
