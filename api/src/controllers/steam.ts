import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { appConfig } from '../config.js';
import { BadRequestException } from '../errors.js';
import { requireAdminSecret } from '../hooks/admin.js';
import {
  SteamAppIdParams,
  SteamBatchBody,
  SteamBatchResponse,
  SteamErrorResponse,
  SteamPriceSnapshot,
  SteamProduct,
  SteamSyncBody,
  SteamSyncSummary,
} from '../schemas/steam.js';

/**
 * Convierte el appid de la ruta en numero.
 *
 * Sustituye a `ParseIntPipe` de NestJS, que aceptaba cualquier entero con
 * signo (`/^-?\d+$/`) y respondia 400 con un mensaje de texto plano. Se
 * replica el mismo criterio y el mismo mensaje para que el cliente reciba
 * exactamente el mismo cuerpo.
 */
const APP_ID_PATTERN = /^-?\d+$/;

function parseAppId(raw: string): number {
  if (!APP_ID_PATTERN.test(raw)) {
    throw new BadRequestException(
      'Validation failed (numeric string is expected)',
    );
  }
  return Number(raw);
}

/**
 * Rutas de Steam.
 *
 * Sustituye a `SteamController` de NestJS.
 *
 * En NestJS el controlador entero llevaba `@Public()`, asi que ninguna de
 * estas rutas exige access token: la autorizacion de las de escritura la
 * aporta el secreto de administrador (`x-admin-secret`). Aqui se mantiene esa
 * misma division: las cuatro rutas son publicas y las dos de escritura
 * comprueban ademas el secreto de administracion.
 */
export const steamController: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Params: Static<typeof SteamAppIdParams> }>(
    '/steam/app/:appId',
    {
      schema: {
        tags: ['steam'],
        summary: 'Precio y metadatos actuales de un appid de Steam',
        description:
          'Consulta la API publica de la tienda de Steam y devuelve el precio ' +
          'actual, el precio regular, el descuento, la moneda y la valoracion ' +
          'de usuarios. No persiste nada.',
        params: SteamAppIdParams,
        response: {
          200: SteamPriceSnapshot,
          400: SteamErrorResponse,
          404: SteamErrorResponse,
          422: SteamErrorResponse,
          502: SteamErrorResponse,
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      return fastify.services.steam.getPricedSnapshot(
        parseAppId(request.params.appId),
      );
    },
  );

  fastify.post<{ Body: Static<typeof SteamBatchBody> }>(
    '/steam/batch',
    {
      schema: {
        tags: ['steam'],
        summary: 'Precios de un lote de appids de Steam',
        description:
          'Consulta hasta 100 appids en un solo lote. Los appids sin datos ' +
          'publicados por Steam se omiten del resultado. Requiere el secreto ' +
          'de administrador en la cabecera `x-admin-secret`: sin el, el ' +
          'endpoint podria usarse como proxy amplificador contra la API de la ' +
          'tienda (100 peticiones salientes por llamada).',
        body: SteamBatchBody,
        response: {
          200: SteamBatchResponse,
          400: SteamErrorResponse,
          403: SteamErrorResponse,
          502: SteamErrorResponse,
        },
      },
      config: { auth: 'disabled' },
      preValidation: requireAdminSecret(
        appConfig.steam.adminSecret,
        'STEAM_ADMIN_SECRET',
      ),
    },
    async (request) => {
      const snapshots = await fastify.services.steam.getPriceSnapshots(
        request.body.appIds,
      );

      // El servicio devuelve un mapa indexado por appid; la respuesta lo
      // expone como objeto con las claves como cadenas.
      const result: Record<string, unknown> = {};
      for (const [appId, snapshot] of snapshots) {
        result[String(appId)] = snapshot;
      }
      return result;
    },
  );

  fastify.post<{ Body: Static<typeof SteamSyncBody> }>(
    '/steam/sync',
    {
      schema: {
        tags: ['steam'],
        summary: 'Sincroniza precios de Steam contra un juego del catalogo',
        description:
          'Descarga el precio actual de cada appid y hace upsert idempotente ' +
          'en store_products sobre (store_name, store_product_id). Repetir la ' +
          'llamada nunca duplica filas. Requiere el secreto de administrador ' +
          'en la cabecera `x-admin-secret` (STEAM_ADMIN_SECRET, con fallback a ' +
          'IGDB_ADMIN_SECRET).',
        body: SteamSyncBody,
        response: {
          200: SteamSyncSummary,
          400: SteamErrorResponse,
          403: SteamErrorResponse,
          404: SteamErrorResponse,
          502: SteamErrorResponse,
        },
      },
      config: { auth: 'disabled' },
      preValidation: requireAdminSecret(
        appConfig.steam.adminSecret,
        'STEAM_ADMIN_SECRET',
      ),
    },
    async (request) => {
      return fastify.services.steam.syncGame(
        request.body.gameId,
        request.body.appIds,
      );
    },
  );

  fastify.get<{ Params: Static<typeof SteamAppIdParams> }>(
    '/steam/product/:appId',
    {
      schema: {
        tags: ['steam'],
        summary: 'Oferta de Steam persistida en el catalogo',
        description:
          'Devuelve la fila de store_products asociada al appid, con el ' +
          'precio vigente en la ultima comprobacion.',
        params: SteamAppIdParams,
        response: {
          200: SteamProduct,
          400: SteamErrorResponse,
          404: SteamErrorResponse,
        },
      },
      config: { auth: 'disabled' },
    },
    async (request) => {
      const product = await fastify.services.steam.getStoreProductOrFail(
        parseAppId(request.params.appId),
      );

      // Se devuelven explicitamente los mismos campos que en NestJS: la
      // entidad `StoreProduct` tiene mas columnas de las que forman parte
      // del contrato publico.
      return {
        id: product.id,
        gameId: product.gameId,
        storeName: product.storeName,
        storeProductId: product.storeProductId,
        currentPrice: product.currentPrice,
        regularPrice: product.regularPrice,
        discountPercent: product.discountPercent,
        currency: product.currency,
        url: product.url,
        isAvailable: product.isAvailable,
        lastCheckedAt: product.lastCheckedAt.toISOString(),
        historicalLowPrice: product.historicalLowPrice,
      };
    },
  );
  return Promise.resolve();
};
