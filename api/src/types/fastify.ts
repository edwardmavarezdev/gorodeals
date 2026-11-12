import type { DataSource } from 'typeorm';
import type { Services } from '../context.js';
import type { AuthMode } from '../hooks/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Conexion de TypeORM, decorada por el plugin de base de datos. */
    db: DataSource;
    /** Grafo de servicios, construido a mano en `buildServices`. */
    services: Services;
  }
}

/**
 * Configuracion de ruta. `auth` decide si la ruta exige access token:
 * `required` por defecto, `optional` o `disabled`.
 *
 * Se amplia el modulo donde se declara la interfaz original: al reexportarse
 * desde `fastify`, la ampliacion tiene que ir al modulo de origen para que
 * TypeScript la fusione.
 */
declare module 'fastify/types/context' {
  interface FastifyContextConfig {
    auth?: AuthMode;
    /** Limite de peticiones por ventana, aplicado por `@fastify/rate-limit`. */
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  }
}
