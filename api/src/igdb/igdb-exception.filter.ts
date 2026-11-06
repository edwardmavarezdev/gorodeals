import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  IgdbAuthError,
  IgdbBadQueryError,
  IgdbConfigurationError,
  IgdbRateLimitError,
  IgdbUnavailableError,
} from './igdb.errors.js';

/**
 * Traduce los errores tipados de IGDB a codigos HTTP coherentes:
 * 400 query invalida, 401 credenciales, 429 rate limit, 503 no disponible.
 */
@Catch(
  IgdbAuthError,
  IgdbBadQueryError,
  IgdbConfigurationError,
  IgdbRateLimitError,
  IgdbUnavailableError,
)
export class IgdbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(IgdbExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    const detail =
      exception instanceof Error ? exception.message : 'Error desconocido';
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}: ${detail}`);
    } else {
      this.logger.warn(`${request.method} ${request.url}: ${detail}`);
    }

    response.status(status).json({
      statusCode: status,
      error: this.errorName(exception),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Traduce el error tipado a codigo HTTP y a un mensaje CERRADO.
   *
   * El detalle tecnico del proveedor (cuerpo de la respuesta de IGDB, estado
   * interno, etc.) no sale del servidor: se registra en el log y al cliente
   * se le devuelve un mensaje estable.
   */
  private resolve(exception: unknown): { status: number; message: string } {
    if (exception instanceof IgdbBadQueryError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'La consulta enviada a IGDB no es valida',
      };
    }
    if (exception instanceof IgdbAuthError) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        message: 'Credenciales de IGDB invalidas o sin permisos',
      };
    }
    if (exception instanceof IgdbRateLimitError) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: 'IGDB ha limitado la peticiones: intentelo de nuevo mas tarde',
      };
    }
    if (exception instanceof IgdbConfigurationError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'IGDB no esta configurado en el servidor',
      };
    }
    if (exception instanceof IgdbUnavailableError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'IGDB no esta disponible en este momento',
      };
    }
    const message =
      exception instanceof Error ? exception.message : 'Error desconocido';
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message };
  }

  private errorName(exception: unknown): string {
    if (exception instanceof HttpException) {
      return exception.name;
    }
    if (exception instanceof Error) {
      return exception.name;
    }
    return 'Error';
  }
}
