import { HttpException, HttpStatus } from '../errors.js';

/**
 * La API publico de Steam responde `{"<appid>": {"success": false}}` cuando
 * el appid no existe o no tiene datos publicados. No es un fallo de red: es
 * "sin datos", y por eso tiene su propia excepcion.
 */
export class SteamAppNotFoundError extends HttpException {
  constructor(appId: number | string) {
    super(
      `Steam no tiene datos publicados para el appid ${appId}`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/** El juego existe pero no tiene precio en la region configurada. */
export class SteamPriceUnavailableError extends HttpException {
  constructor(appId: number | string) {
    super(
      `Steam no expone precio para el appid ${appId} en la region configurada`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** La API no respondio: 5xx, HTML por abuseo, timeout o error de red. */
export class SteamUnavailableError extends HttpException {
  constructor(detalle: string) {
    super(`Steam store API no disponible: ${detalle}`, HttpStatus.BAD_GATEWAY);
  }
}

/**
 * La oferta ya existe en el catalogo con una clave que entra en conflicto con
 * la peticion (por ejemplo, el mismo appid vinculado a otro juego).
 *
 * El detalle tecnico (nombre de la tabla, de la restriccion o mensaje de
 * Postgres) no se propaga al cliente: se registra en el log del servicio.
 */
export class SteamStoreProductConflictError extends HttpException {
  constructor(mensaje: string) {
    super(mensaje, HttpStatus.CONFLICT);
  }
}

/**
 * La respuesta de Steam no es JSON valido.
 *
 * Es un fallo de CONTRATO, no de red: no tiene sentido reintentar, porque la
 * misma respuesta volveria a ser invalida. Se distingue del error de red
 * (`SteamUnavailableError`) para no gastar los reintentos del cliente.
 */
export class SteamInvalidResponseError extends HttpException {
  constructor(detalle: string) {
    super(
      `Steam devolvio una respuesta que no se puede interpretar: ${detalle}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
