import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Hook de observabilidad: id de peticion y duracion de la respuesta.
 *
 * Sustituye al interceptor de NestJS que midia el tiempo de respuesta. El
 * id (`X-Request-Id`) permite correlacionar la peticion con su linea en el
 * log; si la peticion ya trae uno, se respeta.
 */
export function registerTimingHook(fastify: FastifyInstance): void {
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const incoming = request.headers['x-request-id'];
      const requestId =
        (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
      request.id = requestId;
      reply.header('X-Request-Id', requestId);
    },
  );

  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const durationMs = Math.round(reply.elapsedTime * 1000) / 1000;
      request.log.info(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          durationMs,
        },
        'peticion completada',
      );
    },
  );
}
