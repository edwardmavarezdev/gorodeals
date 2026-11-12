import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { appConfig } from '../config.js';
import { InternalServerErrorException } from '../errors.js';
import { requireAdminSecret } from '../hooks/admin.js';
import { parseSyncPlatforms } from '../sync/sync.types.js';
import {
  SyncRandomGamesQuery,
  SyncRandomGamesResult,
} from '../schemas/admin-sync.js';
import { errorResponse } from '../schemas/error.js';

/**
 * Endpoint de administracion para cargar juegos de prueba en el catalogo.
 *
 * Es una herramienta de carga de datos, no parte de la API publica: la
 * autorizacion la aporta el secreto de administracion, no el access token
 * de usuario, asi que la ruta queda fuera del hook global de autenticacion.
 *
 * Sustituye a `AdminSyncController` de NestJS.
 */
export const adminSyncController: FastifyPluginAsync = (fastify) => {
  fastify.post<{ Querystring: Static<typeof SyncRandomGamesQuery> }>(
    '/admin/sync/random',
    {
      schema: {
        tags: ['admin'],
        summary: 'Sincroniza juegos de prueba de Steam y/o Nintendo Switch',
        description:
          'Trae juegos aleatorios de las APIs publicas de las tiendas, crea ' +
          'el juego y su oferta en el catalogo y genera 30 dias de historico ' +
          'de precios. Es idempotente: repetir la llamada no duplica nada.',
        querystring: SyncRandomGamesQuery,
        headers: Type.Object(
          {
            // Opcional en el esquema: si falta, responde el hook de
            // administracion con 403, igual que en NestJS.
            'x-admin-secret': Type.Optional(
              Type.String({
                description: 'Secreto de administracion (ADMIN_SYNC_SECRET).',
              }),
            ),
          },
          { additionalProperties: true },
        ),
        response: {
          200: SyncRandomGamesResult,
          403: errorResponse('El secreto de administracion no es valido'),
          500: errorResponse('La sincronizacion fallo en alguna tienda'),
        },
      },
      config: { auth: 'disabled' },
      preValidation: requireAdminSecret(
        appConfig.adminSync.secret,
        'ADMIN_SYNC_SECRET',
        'Secreto de administracion invalido',
      ),
    },
    async (request) => {
      const query = request.query;
      const count = query.count ?? appConfig.adminSync.count;
      const platforms = parseSyncPlatforms(
        query.platforms ?? appConfig.adminSync.platforms,
      );

      const result = await fastify.services.syncRandomGames.run({
        count,
        platforms,
        ...(query.seed !== undefined ? { seed: query.seed } : {}),
        ...(query.onlyNew !== undefined ? { onlyNew: query.onlyNew } : {}),
      });

      const failed = Object.entries(result.sources)
        .filter(([, source]) => source === 'error')
        .map(([platform]) => platform);
      if (failed.length > 0) {
        throw new InternalServerErrorException(
          `Sincronizacion fallida para ${failed.join(', ')} tras ` +
            `${result.offers} ofertas sincronizadas`,
        );
      }

      return result;
    },
  );
  return Promise.resolve();
};
