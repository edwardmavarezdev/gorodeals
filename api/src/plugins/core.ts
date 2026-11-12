import fp from 'fastify-plugin';
import { buildServices } from '../context.js';
import { registerAuthHook } from '../hooks/auth.js';
import { registerErrorHandler } from '../hooks/error.js';
import { registerTimingHook } from '../hooks/timing.js';

/**
 * Nucleo transversal: servicios, error handler, trazabilidad y
 * autenticacion.
 *
 * Va en un solo plugin (con `fastify-plugin`, sin encapsular) para que los
 * hooks y el manejador de errores queden en el ambito raiz y se apliquen a
 * todas las rutas, incluidas las de los controladores.
 */
export const corePlugin = fp((fastify) => {
  fastify.decorate('services', buildServices(fastify.db));

  registerErrorHandler(fastify);
  registerTimingHook(fastify);
  registerAuthHook(fastify, fastify.services.token);

  /**
   * Ruta inexistente: el mismo cuerpo que devolvia NestJS, para que el
   * frontend no distinga entre las dos implementaciones.
   */
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      message: `Cannot ${request.method} ${request.url}`,
      error: 'Not Found',
    });
  });
  return Promise.resolve();
});
