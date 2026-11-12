/**
 * Errores tipados del cliente IGDB. Se propagan hasta el controlador
 * (`src/controllers/igdb.ts`), que los traduce a codigos HTTP coherentes.
 */
export class IgdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Faltan IGDB_CLIENT_ID o IGDB_CLIENT_SECRET en la configuracion. */
export class IgdbConfigurationError extends IgdbError {}

/** Credenciales invalidas o token rechazado (401 de Twitch o de IGDB). */
export class IgdbAuthError extends IgdbError {}

/** Se agotaron los reintentos tras recibir 429 (rate limit de IGDB). */
export class IgdbRateLimitError extends IgdbError {}

/** La query Apicalypse enviada es invalida (400 de IGDB): es un bug de codigo. */
export class IgdbBadQueryError extends IgdbError {}

/** IGDB no respondio o respondio con 5xx tras agotar los reintentos. */
export class IgdbUnavailableError extends IgdbError {}
