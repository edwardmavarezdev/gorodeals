import { buildServer } from './server.js';
import { appConfig } from './config.js';

/**
 * Punto de entrada del proceso.
 *
 * `server.ts` construye la aplicacion sin abrir el puerto; aqui se escucha
 * y se cierra de forma ordenada (SIGINT/SIGTERM), de modo que el pool de
 * PostgreSQL se cierra y el cron se detiene antes de salir.
 */
async function main(): Promise<void> {
  const fastify = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`Senal ${signal} recibida, cerrando el servidor`);
    try {
      await fastify.close();
      process.exit(0);
    } catch (error) {
      fastify.log.error(
        `Error al cerrar el servidor: ${(error as Error).message}`,
      );
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  const port = appConfig.port;
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(
      `GoRoDeals API escuchando en http://localhost:${port} (documentacion en /docs)`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      fastify.log.error(
        `El puerto ${port} ya esta ocupado por otro proceso. ` +
          `Localizalo con "lsof -i :${port}" y detienelo, o cambia PORT en el archivo .env.`,
      );
      process.exit(1);
    }
    throw error;
  }
}

void main();
