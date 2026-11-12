import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

/**
 * Limite global de peticiones: 120 por minuto.
 *
 * Los endpoints de autenticacion lo endurecen por ruta
 * (`config: { rateLimit: { max: 5 } }`), porque son el vector de fuerza
 * bruta por excelencia. En NestJS lo hacia `@Throttle`.
 */
export const rateLimitPlugin = fp(async (fastify) => {
  await fastify.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // La clave por defecto es la IP, que es la que interesa para la fuerza
    // bruta.
    keyGenerator: (request) => request.ip,
  });
});
