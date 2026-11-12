import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { appConfig } from '../config.js';
import { requireAdminSecret } from '../hooks/admin.js';
import { StoreName } from '../store-products/entities/store-product.entity.js';
import {
  PriceHistoryList,
  PriceSyncHistoryQuery,
  PriceSyncRunBody,
  PriceSyncRunResult,
  PriceSyncStatus,
} from '../schemas/price-sync.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Modulo de sincronizacion de precios.
 *
 * Sustituye a `PriceSyncController` de NestJS. Las tres rutas son publicas
 * (en NestJS el controlador entero llevaba `@Public()`): la ejecucion manual
 * se protege por su cuenta con el secreto de administrador en la cabecera
 * `x-admin-secret`.
 */
export const priceSyncController: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/price-sync/status',
    {
      schema: {
        tags: ['price-sync'],
        summary: 'Estado del modulo de sincronizacion de precios',
        description:
          'Devuelve la configuracion efectiva (cron, zona horaria, tiendas, ' +
          'tamano de lote) y el resultado de la ultima ejecucion del sync.',
        response: { 200: PriceSyncStatus },
      },
      config: { auth: 'disabled' },
    },
    () => fastify.services.priceSync.getStatus(),
  );

  fastify.post<{ Body: Static<typeof PriceSyncRunBody> }>(
    '/price-sync/run',
    {
      schema: {
        tags: ['price-sync'],
        summary: 'Lanza manualmente un ciclo de sincronizacion de precios',
        description:
          'Recorre el catalogo de ofertas de forma paginada, consulta el ' +
          'precio actual en la tienda, actualiza `store_products` y registra ' +
          'las variaciones en `price_history`. Requiere el secreto de ' +
          'administrador en la cabecera `x-admin-secret`. La operacion es ' +
          'idempotente: repetirla el mismo dia no duplica el historico.',
        body: PriceSyncRunBody,
        response: {
          200: PriceSyncRunResult,
          400: errorResponse('Parametros invalidos'),
          403: errorResponse('Secreto de administrador invalido'),
        },
      },
      config: { auth: 'disabled' },
      preValidation: requireAdminSecret(
        appConfig.priceSync.adminSecret,
        'PRICE_SYNC_ADMIN_SECRET',
      ),
    },
    async (request) => {
      const body = request.body ?? {};
      const result = await fastify.services.priceSync.runSync({
        storeNames: body.storeNames as StoreName[] | undefined,
        batchSize: body.batchSize,
        catalogPages: body.catalogPages,
        maxProducts: body.maxProducts,
      });

      return {
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        skipped: result.skipped,
        skipReason: result.skipReason,
        stores: result.stores,
        totals: result.totals,
        catalog: result.catalog,
      };
    },
  );

  fastify.get<{
    Params: { storeProductId: string };
    Querystring: Static<typeof PriceSyncHistoryQuery>;
  }>(
    '/price-sync/history/:storeProductId',
    {
      schema: {
        tags: ['price-sync'],
        summary: 'Historico de precios de una oferta',
        description:
          'Devuelve la serie de precios registrada para una oferta dentro ' +
          'de la ventana temporal configurada (12 meses por defecto).',
        params: {
          type: 'object',
          properties: {
            storeProductId: { type: 'string', format: 'uuid' },
          },
          required: ['storeProductId'],
        },
        querystring: PriceSyncHistoryQuery,
        response: {
          200: PriceHistoryList,
          400: errorResponse('Parametros invalidos'),
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      const months = request.query.windowMonths ?? 12;
      const rows = await fastify.services.priceHistory.findHistory(
        request.params.storeProductId,
        months,
      );
      return rows.map((row) => ({
        id: row.id,
        storeProductId: row.storeProductId,
        price: row.price,
        regularPrice: row.regularPrice,
        discountPercent: row.discountPercent,
        source: row.source,
        recordedAt: row.recordedAt.toISOString(),
      }));
    },
  );

  return Promise.resolve();
};
