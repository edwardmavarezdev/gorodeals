import type { FastifyPluginAsync } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { GameDetailQuery, GameDetailResponse } from '../schemas/games.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Ficha de un juego.
 *
 * Sustituye a `GamesController` de NestJS.
 */
export const gamesController: FastifyPluginAsync = (fastify) => {
  fastify.get<{
    Params: { slug: string };
    Querystring: Static<typeof GameDetailQuery>;
  }>(
    '/games/:slug',
    {
      schema: {
        tags: ['games'],
        summary: 'Ficha completa de un juego',
        description:
          'Metadatos del juego, ofertas vigentes en cada tienda, historico de ' +
          'precios de los ultimos `months` meses (90 dias por defecto) y la ' +
          'saga a la que pertenece con su ruta de juego.',
        params: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
        },
        querystring: GameDetailQuery,
        response: {
          200: GameDetailResponse,
          404: errorResponse('El juego no existe'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.games.findBySlug(
        request.params.slug,
        request.query.months,
      );
    },
  );
  return Promise.resolve();
};
