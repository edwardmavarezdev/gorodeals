/**
 * Excepciones HTTP de la aplicacion.
 *
 * Antes de la migracion a Fastify eran las clases de `@nestjs/common`. Se
 * sustituyen por estas, que conservan la misma semantica:
 *
 * - `getStatus()` devuelve el codigo HTTP, que es lo que lee el manejador de
 *   errores de `src/hooks/error.ts` para construir `{ statusCode, message,
 *   error }`.
 * - El mensaje por defecto es el mismo que usaba NestJS (`Not Found`,
 *   `Bad Request`, ...), de modo que el cuerpo de la respuesta no cambia.
 *
 * La firma del constructor de `HttpException` es la de NestJS:
 * `new HttpException(mensaje, estado)`. Los errores tipados de Steam
 * (`src/steam/steam.errors.ts`) heredan de ella y no cambian.
 */

/** Codigos HTTP usados por la aplicacion. */
export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Error con un codigo HTTP asociado.
 *
 * `response` es el cuerpo que describira el error: normalmente una cadena con
 * el mensaje, pero puede ser un objeto para dar forma a la respuesta.
 */
export class HttpException extends Error {
  readonly response: string | Record<string, unknown>;
  readonly status: number;

  constructor(response: string | Record<string, unknown>, status: number) {
    super();
    this.response = response;
    this.status = status;
    this.initMessage();
    this.name = new.target.name;
  }

  /**
   * Calcula el mensaje a partir del cuerpo, con las mismas reglas que
   * NestJS: si el cuerpo es una cadena, es el mensaje; si es un objeto con
   * `message`, tambien; si no, el nombre de la clase en palabras.
   */
  private initMessage(): void {
    if (typeof this.response === 'string') {
      this.message = this.response;
      return;
    }
    const mensaje = this.response.message;
    if (typeof mensaje === 'string') {
      this.message = mensaje;
      return;
    }
    this.message = this.name.match(/[A-Z][a-z]+|[0-9]+/g)?.join(' ') ?? 'Error';
  }

  /** Codigo HTTP del error. */
  getStatus(): number {
    return this.status;
  }

  /** Cuerpo descrito por el error. */
  getResponse(): string | Record<string, unknown> {
    return this.response;
  }
}

/** Error de sintaxis o de datos invalidos en la peticion (400). */
export class BadRequestException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Bad Request',
  ) {
    super(objectOrError ?? description, HttpStatus.BAD_REQUEST);
  }
}

/** Falta autenticacion o las credenciales no son validas (401). */
export class UnauthorizedException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Unauthorized',
  ) {
    super(objectOrError ?? description, HttpStatus.UNAUTHORIZED);
  }
}

/** El llamador esta autenticado pero no tiene permiso (403). */
export class ForbiddenException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Forbidden',
  ) {
    super(objectOrError ?? description, HttpStatus.FORBIDDEN);
  }
}

/** El recurso solicitado no existe (404). */
export class NotFoundException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Not Found',
  ) {
    super(objectOrError ?? description, HttpStatus.NOT_FOUND);
  }
}

/** El recurso ya existe o choca con el estado actual (409). */
export class ConflictException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Conflict',
  ) {
    super(objectOrError ?? description, HttpStatus.CONFLICT);
  }
}

/** El peticion se entiende pero no se puede procesar todavia (503). */
export class ServiceUnavailableException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Service Unavailable',
  ) {
    super(objectOrError ?? description, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/** Fallo interno del servidor (500). */
export class InternalServerErrorException extends HttpException {
  constructor(
    objectOrError?: string | Record<string, unknown>,
    description = 'Internal Server Error',
  ) {
    super(objectOrError ?? description, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
