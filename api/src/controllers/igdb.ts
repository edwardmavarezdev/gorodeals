import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { appConfig } from '../config.js';
import { NotFoundException } from '../errors.js';
import { requireAdminSecret } from '../hooks/admin.js';
import {
  IgdbAuthError,
  IgdbBadQueryError,
  IgdbConfigurationError,
  IgdbError,
  IgdbRateLimitError,
  IgdbUnavailableError,
} from '../igdb/igdb.errors.js';
import {
  IgdbErrorResponse,
  IgdbGame,
  IgdbIdParams,
  IgdbSearchQuery,
  IgdbSyncBody,
  IgdbSyncResult,
} from '../schemas/igdb.js';

/**
 * Rutas de IGDB.
 *
 * Sustituye a `IgdbController` de NestJS.
 *
 * En NestJS el controlador entero llevaba `@Public()`, asi que ninguna de
 * estas rutas exige access token: la autorizacion de la sincronizacion la
 * aporta el secreto de administrador (`x-admin-secret`). Aqui se mantiene esa
 * misma division.
 */

/**
 * Traduce un error tipado de IGDB a su codigo HTTP y a un mensaje CERRADO.
 *
 * Es la misma tabla que usaba `IgdbExceptionFilter` de NestJS: el detalle
 * tecnico del proveedor (cuerpo de la respuesta de IGDB, estado interno, etc.)
 * no sale del servidor, se registra en el log y al cliente se le devuelve un
 * mensaje estable.
 */
function resolveIgdbError(exception: IgdbError): {
  status: number;
  message: string;
} {
  if (exception instanceof IgdbBadQueryError) {
    return { status: 400, message: 'La consulta enviada a IGDB no es valida' };
  }
  if (exception instanceof IgdbAuthError) {
    return {
      status: 401,
      message: 'Credenciales de IGDB invalidas o sin permisos',
    };
  }
  if (exception instanceof IgdbRateLimitError) {
    return {
      status: 429,
      message: 'IGDB ha limitado la peticiones: intentelo de nuevo mas tarde',
    };
  }
  if (exception instanceof IgdbConfigurationError) {
    return { status: 500, message: 'IGDB no esta configurado en el servidor' };
  }
  if (exception instanceof IgdbUnavailableError) {
    return { status: 503, message: 'IGDB no esta disponible en este momento' };
  }
  return { status: 500, message: exception.message };
}

/**
 * Ejecuta la operacion de IGDB traduciendo sus errores tipados.
 *
 * El filtro `IgdbExceptionFilter` de NestJS respondia con
 * `{ statusCode, error, message, path, timestamp }`, donde `error` es el
 * nombre de la excepcion (`IgdbBadQueryError`, `IgdbAuthError`, ...). El
 * manejador global de Fastify produce `{ statusCode, message, error }` con la
 * razon textual del estado, asi que aqui se reproduce el cuerpo del filtro
 * de IGDB para no cambiar lo que ve el cliente.
 */
async function withIgdbErrors<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof IgdbError)) {
      throw error;
    }

    const { status, message } = resolveIgdbError(error);
    const detail = error.message;
    if (status >= 500) {
      request.log.error(`${request.method} ${request.url}: ${detail}`);
    } else {
      request.log.warn(`${request.method} ${request.url}: ${detail}`);
    }

    return reply.status(status).send({
      statusCode: status,
      error: error.name,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

export const igdbController: FastifyPluginAsync = (fastify) => {
  const searchSchema = {
    tags: ['igdb'],
    summary: 'Busca juegos por nombre en IGDB',
    description:
      'Consulta el catalogo de IGDB por nombre y devuelve metadatos ' +
      'normalizados sin persistirlos.',
    querystring: IgdbSearchQuery,
    response: {
      200: Type.Array(IgdbGame),
      400: IgdbErrorResponse,
      401: IgdbErrorResponse,
      429: IgdbErrorResponse,
      500: IgdbErrorResponse,
      503: IgdbErrorResponse,
    },
  };

  fastify.get<{ Querystring: Static<typeof IgdbSearchQuery> }>(
    '/igdb/search',
    { schema: searchSchema, config: { auth: 'disabled' } },
    async (request, reply) =>
      withIgdbErrors(request, reply, () =>
        fastify.services.igdb.searchByName(
          request.query.q,
          request.query.limit ?? 20,
        ),
      ),
  );

  fastify.get<{ Querystring: Static<typeof IgdbSearchQuery> }>(
    '/igdb/games/search',
    {
      schema: {
        ...searchSchema,
        summary: 'Busca juegos por nombre en IGDB (ruta alternativa)',
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) =>
      withIgdbErrors(request, reply, () =>
        fastify.services.igdb.searchByName(
          request.query.q,
          request.query.limit ?? 20,
        ),
      ),
  );

  fastify.get<{ Params: { igdbId: string } }>(
    '/igdb/games/:igdbId',
    {
      schema: {
        tags: ['igdb'],
        summary: 'Obtiene los metadatos de un juego por su ID de IGDB',
        description:
          'Devuelve los metadatos normalizados del juego indicado. Si el ' +
          'juego no existe en IGDB responde 404.',
        params: IgdbIdParams,
        response: {
          200: IgdbGame,
          400: IgdbErrorResponse,
          401: IgdbErrorResponse,
          404: IgdbErrorResponse,
          429: IgdbErrorResponse,
          500: IgdbErrorResponse,
          503: IgdbErrorResponse,
        },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) =>
      withIgdbErrors(request, reply, async () => {
        const game = await fastify.services.igdb.findByIgdbId(
          request.params.igdbId,
        );
        if (!game) {
          throw new NotFoundException(
            `No existe ningun juego con igdbId ${request.params.igdbId}`,
          );
        }
        return game;
      }),
  );

  fastify.post<{ Body: Static<typeof IgdbSyncBody> }>(
    '/igdb/sync',
    {
      schema: {
        tags: ['igdb'],
        summary: 'Sincroniza un lote de juegos de IGDB contra la tabla games',
        description:
          'Upsert idempotente por igdb_id. Requiere el secreto de ' +
          'administrador en la cabecera `x-admin-secret` (IGDB_ADMIN_SECRET).',
        body: IgdbSyncBody,
        response: {
          200: IgdbSyncResult,
          400: IgdbErrorResponse,
          401: IgdbErrorResponse,
          403: IgdbErrorResponse,
          429: IgdbErrorResponse,
          500: IgdbErrorResponse,
          503: IgdbErrorResponse,
        },
      },
      config: { auth: 'disabled' },
      preValidation: requireAdminSecret(
        appConfig.igdb.adminSecret,
        'IGDB_ADMIN_SECRET',
      ),
    },
    async (request, reply) =>
      withIgdbErrors(request, reply, () =>
        fastify.services.igdb.sync(request.body),
      ),
  );

  return Promise.resolve();
};
