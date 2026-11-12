import type { Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { BadRequestException } from '../errors.js';
import { currentUser } from '../hooks/auth.js';
import { WishlistItem } from '../wishlist/entities/wishlist-item.entity.js';
import { toDto } from '../wishlist/wishlist.service.js';
import {
  AddWishlistItemBody,
  WishlistItem as WishlistItemSchema,
  WishlistQuery,
  WishlistResponse,
  WishlistSyncResponse,
} from '../schemas/wishlist.js';
import { errorResponse } from '../schemas/error.js';

/**
 * UUID version 4, el mismo formato que acepta `ParseUUIDPipe` de NestJS.
 */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lista de deseos del usuario autenticado.
 *
 * Sustituye a `WishlistController` de NestJS.
 *
 * Todas las rutas exigen access token: no hay ninguna ruta publica de este
 * dominio, asi que ninguna lleva `config: { auth: 'disabled' }` y el hook
 * deny-by-default las protege. El `userId` sale siempre del token, nunca
 * del cuerpo ni de los parametros.
 */
export const wishlistController: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: Static<typeof WishlistQuery> }>(
    '/wishlist',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Lista de deseos del usuario autenticado',
        description:
          'Pagina de los juegos que el usuario ha marcado, con los datos ' +
          'minimos del juego y la tienda asociada. Se puede filtrar por ' +
          'tienda.',
        querystring: WishlistQuery,
        response: { 200: WishlistResponse },
      },
    },
    async (request) => {
      const user = currentUser(request)!;
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;

      /**
       * Sin filtro de tienda se usa el servicio, que es la implementacion
       * de referencia. El filtro por tienda se resuelve aqui porque el
       * servicio no lo expone.
       */
      const store = request.query.store;
      if (!store) {
        return fastify.services.wishlist.list(user.id, page, limit);
      }

      const repo = fastify.db.getRepository(WishlistItem);
      const [rows, total] = await Promise.all([
        repo.find({
          where: { userId: user.id, store },
          relations: { game: true },
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        repo.count({ where: { userId: user.id, store } }),
      ]);

      return {
        page,
        limit,
        total,
        items: rows.map((row) => toDto(row)),
      };
    },
  );

  fastify.post<{ Body: Static<typeof AddWishlistItemBody> }>(
    '/wishlist',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Anade un juego a la lista de deseos',
        description:
          'El juego se identifica por `gameId` o por `slug`. Un juego no ' +
          'puede repetirse en la misma lista.',
        body: AddWishlistItemBody,
        response: {
          201: WishlistItemSchema,
          400: errorResponse('Falta identificar el juego'),
          404: errorResponse('El juego no existe'),
          409: errorResponse('El juego ya esta en la lista'),
        },
      },
    },
    async (request, reply) => {
      const user = currentUser(request)!;
      const body = request.body ?? {};

      /**
       * Si no se identifica el juego por ninguno de los dos campos, el
       * servicio responde 400 con el mismo mensaje que devolvia NestJS.
       * Si vienen los dos, manda `gameId`, tambien como en NestJS: es lo
       * que hace el frontend, que envia `gameId` y `slug` a la vez.
       */
      const item = await fastify.services.wishlist.add(user.id, body);
      return reply.status(201).send(item);
    },
  );

  fastify.delete<{ Params: { gameId: string } }>(
    '/wishlist/:gameId',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Quita un juego de la lista de deseos',
        description: 'El juego se identifica por su UUID.',
        params: {
          type: 'object',
          properties: { gameId: { type: 'string' } },
          required: ['gameId'],
        },
        response: {
          204: { type: 'null', description: 'Juego eliminado de la lista' },
          400: errorResponse('El identificador no es un UUID valido'),
        },
      },
    },
    async (request, reply) => {
      const user = currentUser(request)!;
      const gameId = request.params.gameId;

      /**
       * `ParseUUIDPipe` de NestJS devuelve 400 con este mismo mensaje
       * cuando el identificador no es un UUID valido.
       */
      if (!UUID_V4.test(gameId)) {
        throw new BadRequestException(
          'Validation failed (uuid v 4 is expected)',
        );
      }

      await fastify.services.wishlist.remove(user.id, gameId);
      return reply.status(204).send();
    },
  );

  fastify.delete<{ Params: { slug: string } }>(
    '/wishlist/slug/:slug',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Quita un juego de la lista de deseos por slug',
        description: 'El juego se identifica por su slug en el catalogo.',
        params: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
        },
        response: {
          204: { type: 'null', description: 'Juego eliminado de la lista' },
          404: errorResponse('El juego no existe'),
        },
      },
    },
    async (request, reply) => {
      const user = currentUser(request)!;
      await fastify.services.wishlist.remove(
        user.id,
        undefined,
        request.params.slug,
      );
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { store: string } }>(
    '/wishlist/sync/:store',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Sincroniza la lista con una tienda externa',
        description:
          'Sincronizacion bidireccional con GOG o Nintendo. Sin ' +
          'credenciales configuradas, el endpoint responde 200 con estado ' +
          '`not_configured` y el motivo, sin llamar a la tienda.',
        params: {
          type: 'object',
          properties: { store: { type: 'string' } },
          required: ['store'],
        },
        response: { 200: WishlistSyncResponse },
      },
    },
    async (request, reply) => {
      const user = currentUser(request)!;
      const items = await fastify.services.wishlist.listRaw(user.id);
      const result = fastify.services.storeSync.sync(
        request.params.store as never,
        items,
      );
      return reply.status(200).send(result);
    },
  );
  return Promise.resolve();
};
