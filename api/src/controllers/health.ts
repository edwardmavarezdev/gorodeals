import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Estado del servicio y de la base de datos.
 *
 * Consulta la base de datos con un `SELECT 1`: si la conexion falla,
 * `database` pasa a `down` y `status` a `degraded`, sin propagar el error.
 * Un monitor de salud debe poder leer la respuesta aunque la base de datos
 * este caida.
 */
const HealthResponse = Type.Object({
  status: Type.String(),
  database: Type.String(),
  timestamp: Type.String(),
});

export const healthController: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Estado del servicio',
        description:
          'Endpoint de salud: confirma que el proceso esta vivo y que la ' +
          'base de datos responde.',
        response: { 200: HealthResponse },
      },
      config: { auth: 'disabled' },
    },
    async (request, reply) => {
      const timestamp = new Date().toISOString();
      try {
        await fastify.db.query('SELECT 1');
        return reply.status(200).send({
          status: 'ok',
          database: 'up',
          timestamp,
        });
      } catch (error) {
        request.log.error(
          `Fallo al comprobar la base de datos: ${(error as Error).message}`,
        );
        return reply.status(200).send({
          status: 'degraded',
          database: 'down',
          timestamp,
        });
      }
    },
  );
  return Promise.resolve();
};
