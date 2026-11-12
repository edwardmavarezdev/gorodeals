import { timingSafeEqual } from 'node:crypto';
import type {
  FastifyReply,
  FastifyRequest,
  preValidationAsyncHookHandler,
} from 'fastify';

const ADMIN_SECRET_HEADER = 'x-admin-secret';

/**
 * Compara dos cadenas en tiempo constante.
 *
 * `timingSafeEqual` exige la misma longitud, asi que se comprueba antes: si
 * las longitudes difieren, la comparacion no se hace (y la respuesta es la
 * misma de todos modos, de modo que no filtra informacion).
 */
export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Hook de administracion: exige la cabecera `x-admin-secret`.
 *
 * Sustituye a los guards `SteamAdminGuard`, `IgdbAdminGuard` y
 * `PriceSyncAdminGuard` de NestJS. Sigue las mismas reglas:
 *
 * - Si el secreto no esta configurado, el endpoint queda **cerrado** (403).
 *   Un endpoint de sincronizacion sin secreto no es un endpoint abierto.
 * - La comparacion del secreto es en tiempo constante.
 *
 * Se registra en `preValidation` y no en `preHandler`: en NestJS los guards
 * se ejecutan antes del `ValidationPipe`, de modo que una peticion con el
 * cuerpo invalido se rechaza con 403 y no con 400. En Fastify la validacion
 * del esquema ocurre justo despues de `preValidation`, asi que es la fase
 * equivalente.
 */
export function requireAdminSecret(
  secret: string,
  reason: string,
  invalidMessage = 'Secreto de administrador invalido',
): preValidationAsyncHookHandler {
  // Fastify acepta hooks asincronos: el tipo `preValidationAsyncHookHandler`
  // declara `Promise<unknown>`, pero la regla `no-misused-promises` no lo
  // tiene en cuenta.

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!secret) {
      request.log.warn(`Endpoint bloqueado: ${reason} no esta configurado`);
      reply.status(403).send({
        statusCode: 403,
        message: `Sincronizacion deshabilitada: ${reason} no esta configurado`,
        error: 'Forbidden',
      });
      return;
    }

    const header = request.headers[ADMIN_SECRET_HEADER];
    const provided = Array.isArray(header) ? header[0] : header;

    if (!provided || !safeEquals(provided, secret)) {
      reply.status(403).send({
        statusCode: 403,
        message: invalidMessage,
        error: 'Forbidden',
      });
    }
  };
}
