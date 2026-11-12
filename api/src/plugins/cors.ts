import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { appConfig } from '../config.js';

/**
 * CORS restringido a los origenes configurados (`CORS_ORIGIN`, lista
 * separada por comas).
 *
 * Sin una allowlist, cualquier sitio podria leer las respuestas de la API
 * desde el navegador. Si la lista esta vacia no se registra el plugin: la
 * API sigue sirviendo `curl` y las peticiones desde el servidor, pero el
 * navegador no podra llamarla directamente.
 */
export const corsPlugin = fp(async (fastify) => {
  const origins = appConfig.cors.origin;

  if (origins.length === 0) {
    fastify.log.warn(
      'CORS_ORIGIN no configurado: el navegador no podra llamar a la API directamente',
    );
    return;
  }

  await fastify.register(cors, {
    origin: origins,
    credentials: true,
  });
});
