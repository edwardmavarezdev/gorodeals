/**
 * Esquema del cuerpo de error de la API.
 *
 * El formato es el que devolvia NestJS: `{ statusCode, message, error }`.
 *
 * `message` admite dos formas porque NestJS tambien las tenia:
 *
 * - Un texto, cuando el error lo lanza el servicio (`NotFoundException`,
 *   `UnauthorizedException`, ...).
 * - Una lista de textos, cuando el error es de validacion de la entrada: el
 *   `ValidationPipe` de NestJS devolvia un mensaje por restriccion
 *   incumplida.
 *
 * Los esquemas de respuesta de Fastify validan lo que se serializa, asi que
 * declarar `message` como un unico texto haria que la lista se perdiera al
 * serializar.
 */

/** Cuerpo de error con un unico mensaje o una lista de mensajes. */
export interface ApiErrorBodyShape {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Esquema de respuesta de error, listo para `schema.response`.
 *
 * @param description Descripcion para la documentacion OpenAPI.
 */
export function errorResponse(description: string) {
  return {
    description,
    type: 'object',
    properties: {
      statusCode: { type: 'number' },
      message: {
        anyOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      error: { type: 'string' },
    },
  } as const;
}
