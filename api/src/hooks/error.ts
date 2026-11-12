import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Formato de error de la API.
 *
 * Es el mismo que devolvia NestJS: `{ statusCode, message, error }`. El
 * frontend ya sabe leerlo, asi que la migracion no puede cambiarlo.
 */
export interface ApiErrorBody {
  statusCode: number;
  /**
   * Un mensaje, o una lista de mensajes cuando el error viene de la
   * validacion de la entrada: es la forma que devolvia NestJS.
   */
  message: string | string[];
  error: string;
}

/**
 * Traduce una excepcion HTTP a su codigo.
 *
 * Los servicios lanzan `NotFoundException`, `UnauthorizedException` y demas
 * (`src/errors.ts`), que exponen un metodo `getStatus()`. La comprobacion es
 * generica a proposito: cualquier error con ese metodo se traduce igual.
 */
function statusFromHttpError(error: unknown): number | undefined {
  const candidate = error as { getStatus?: () => number };
  if (typeof candidate.getStatus === 'function') {
    const status = candidate.getStatus();
    return Number.isInteger(status) ? status : undefined;
  }
  return undefined;
}

/** Razon textual del error HTTP (`Not Found`, `Unauthorized`, ...). */
function reasonFor(status: number): string {
  const reasons: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return reasons[status] ?? 'Error';
}

/**
 * Manejador global de errores.
 *
 * Cualquier error que escapa de una ruta se convierte en un JSON con la
 * forma `{ statusCode, message, error }`. Los errores de validacion de Ajv
 * se traducen a un 400 legible en lugar del volcado interno de Fastify.
 */
export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (
      error: Error & { statusCode?: number; validation?: unknown[] },
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      // Errores de validacion del esquema JSON de la ruta.
      //
      // NestJS devolvia una lista de mensajes (una por restriccion
      // incumplida), asi que se mantiene la lista: el frontend ya sabe
      // leerla.
      if (Array.isArray(error.validation)) {
        const details = error.validation.map((issue) => {
          const item = issue as { instancePath?: string; message?: string };
          const path = item.instancePath || '(cuerpo)';
          return `${path}: ${item.message ?? 'valor invalido'}`;
        });
        return reply.status(400).send({
          statusCode: 400,
          message: details.length > 0 ? details : ['Datos invalidos'],
          error: 'Bad Request',
        });
      }

      const statusDeclarado = statusFromHttpError(error);
      const status =
        statusDeclarado ??
        (typeof error.statusCode === 'number' ? error.statusCode : 500);

      // 5xx: no se filtra el detalle interno al cliente, pero si se registra
      // en el log del servidor, que es donde hace falta.
      //
      // La excepcion es una excepcion deliberada del servicio (por ejemplo
      // "el proveedor no esta configurado"), no un fallo inesperado: su
      // mensaje es informacion util para el cliente y no filtra nada.
      if (status >= 500 && statusDeclarado === undefined) {
        request.log.error(
          { err: error, url: request.url, method: request.method },
          'Error no controlado en la peticion',
        );
        return reply.status(status).send({
          statusCode: status,
          message: 'Error interno del servidor',
          error: reasonFor(status),
        });
      }

      request.log.info(
        { statusCode: status, url: request.url, method: request.method },
        error.message,
      );
      return reply.status(status).send({
        statusCode: status,
        message: error.message,
        error: reasonFor(status),
      });
    },
  );
}
