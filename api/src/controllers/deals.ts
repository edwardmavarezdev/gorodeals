import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { HottestDealsQuery, HottestDealsResponse } from '../schemas/deals.js';

/**
 * Top de ofertas por Deal Score.
 *
 * Sustituye a `DealsController` de NestJS.
 */
export const dealsController: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: Static<typeof HottestDealsQuery> }>(
    '/deals/hottest',
    {
      schema: {
        tags: ['deals'],
        summary: 'Top de ofertas por Deal Score',
        description:
          'Ofertas disponibles con descuento, ordenadas por Deal Score. ' +
          'Cuando la oferta aun no tiene `deal_score` persistido, el score ' +
          'se calcula en memoria con el servicio de Deal Score.',
        querystring: HottestDealsQuery,
        response: { 200: HottestDealsResponse },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.deals.hottest(request.query.limit ?? 20);
    },
  );
  return Promise.resolve();
};
