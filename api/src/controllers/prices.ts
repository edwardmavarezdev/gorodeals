import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { PriceHistoryQuery, PriceHistoryResponse } from '../schemas/prices.js';
import { DEFAULT_SERIES_MONTHS } from '../prices/prices.service.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Serie temporal de precios de un juego.
 *
 * Sustituye a `PricesController` de NestJS. El `id` del path es un UUID
 * (en NestJS lo comprobaba un `ParseUUIDPipe`).
 */
export const pricesController: FastifyPluginAsync = (fastify) => {
  fastify.get<{
    Params: { id: string };
    Querystring: Static<typeof PriceHistoryQuery>;
  }>(
    '/games/:id/price-history',
    {
      schema: {
        tags: ['prices'],
        summary: 'Serie temporal de precios de un juego',
        description:
          'Devuelve la serie de precios de la mejor oferta del juego (o de ' +
          'la oferta indicada en `storeProductId`) con el granularity de un ' +
          'dia. El historico se limita a los ultimos `months` meses (1-60).',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        querystring: PriceHistoryQuery,
        response: {
          200: PriceHistoryResponse,
          404: errorResponse(
            'El juego no existe o no tiene ofertas registradas',
          ),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      const months = request.query.months ?? DEFAULT_SERIES_MONTHS;
      return fastify.services.prices.findSeriesForGame(
        request.params.id,
        months,
        request.query.storeProductId,
      );
    },
  );
  return Promise.resolve();
};
