import { Type } from '@sinclair/typebox';

/** Esquemas del dominio de IGDB. */

/**
 * Cuerpo de error de la API.
 *
 * Las propiedades se dejan abiertas a proposito: el filtro de IGDB devuelveva
 * `{ statusCode, error, message, path, timestamp }` y el manejador global de
 * errores devuelve `{ statusCode, message, error }`, con `message` como lista
 * cuando el error viene de la validacion de la entrada. Un esquema cerrado
 * descartaria campos o fallaria al serializar una lista como una cadena.
 */
export const IgdbErrorResponse = Type.Object(
  {},
  {
    additionalProperties: true,
    description: 'Error de la API',
  },
);

/**
 * Parametros de busqueda por nombre.
 *
 * Traduce `IgdbSearchQueryDto`: `q` es obligatorio (1-100 caracteres) y
 * `limit` es un entero opcional entre 1 y 50. El limite por defecto (20) lo
 * aplica el servicio, igual que en NestJS.
 */
export const IgdbSearchQuery = Type.Object(
  {
    q: Type.String({
      minLength: 1,
      maxLength: 100,
      description: 'Nombre del juego a buscar',
      example: 'zelda',
    }),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 50,
        description: 'Numero maximo de resultados (1-50)',
        example: 20,
      }),
    ),
  },
  { additionalProperties: false },
);

/**
 * Parametro `igdbId` de la ruta.
 *
 * En NestJS el parametro no tenia ninguna validacion (`@Param('igdbId')` con
 * `string`): un identificador no numerico lo rechazaba despues el servicio,
 * con `IgdbBadQueryError`, que el filtro traducía a un 400. Aqui se mantiene
 * la misma cadena: el esquema acepta cualquier cadena y el error lo sigue
 * produciendo el servicio.
 */
export const IgdbIdParams = Type.Object(
  {
    igdbId: Type.String({
      description: 'Identificador numerico del juego en IGDB',
      example: '1942',
    }),
  },
  { additionalProperties: false },
);

/**
 * Cuerpo de la sincronizacion.
 *
 * Traduce `IgdbSyncDto`: consulta opcional de Apicalypse, limite opcional
 * (1-50) y desplazamiento opcional (>= 0).
 */
export const IgdbSyncBody = Type.Object(
  {
    query: Type.Optional(
      Type.String({
        minLength: 1,
        description:
          'Consulta Apicalypse completa a ejecutar. Si se omite se sincroniza por lotes sobre `name`.',
        example:
          'fields id, name, slug, cover.image_id; search "zelda"; limit 50;',
      }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 50,
        description:
          'Numero de juegos a sincronizar cuando no se indica `query`',
      }),
    ),
    offset: Type.Optional(
      Type.Integer({
        minimum: 0,
        description: 'Desplazamiento (offset) para la paginacion del catalogo',
      }),
    ),
  },
  { additionalProperties: false },
);

/**
 * Juego de IGDB normalizado.
 *
 * Los campos opcionales del DTO son siempre presentes en la respuesta (con
 * `null` cuando IGDB no aporta el dato), asi que se declaran como
 * obligatorios y anulables.
 */
export const IgdbGame = Type.Object({
  igdbId: Type.String({
    description: 'Identificador numerico del juego en IGDB',
  }),
  title: Type.String({ description: 'Titulo del juego' }),
  slug: Type.String({ description: 'Slug del juego en IGDB' }),
  summary: Type.Union([Type.String(), Type.Null()], {
    description: 'Resumen del juego',
  }),
  description: Type.Union([Type.String(), Type.Null()], {
    description: 'Historia del juego',
  }),
  coverUrl: Type.Union([Type.String(), Type.Null()], {
    description: 'URL de la caratula',
  }),
  screenshots: Type.Array(Type.String(), {
    description: 'URLs de capturas de pantalla',
  }),
  genres: Type.Array(Type.String(), { description: 'Generos' }),
  platforms: Type.Array(Type.String(), { description: 'Plataformas' }),
  releaseDate: Type.Union([Type.String(), Type.Null()], {
    description: 'Fecha de lanzamiento (YYYY-MM-DD)',
  }),
  criticsScore: Type.Union([Type.Number(), Type.Null()], {
    description: 'Puntuacion media de criticos externos (0-100)',
  }),
  criticsCount: Type.Union([Type.Number(), Type.Null()], {
    description: 'Numero de puntuaciones de criticos externos',
  }),
  totalScore: Type.Union([Type.Number(), Type.Null()], {
    description: 'Puntuacion media de usuarios de IGDB y criticos (0-100)',
  }),
  totalScoreCount: Type.Union([Type.Number(), Type.Null()], {
    description: 'Numero total de puntuaciones de usuarios y criticos',
  }),
  rating: Type.Union([Type.Number(), Type.Null()], {
    description: 'Valoracion media de IGDB (0-100)',
  }),
  ratingCount: Type.Union([Type.Number(), Type.Null()], {
    description: 'Numero de valoraciones de IGDB',
  }),
});

/** Resultado de la sincronizacion de IGDB. */
export const IgdbSyncResult = Type.Object({
  fetched: Type.Number({ description: 'Juegos devueltos por IGDB' }),
  upserted: Type.Number({ description: 'Juegos insertados o actualizados' }),
  skipped: Type.Number({ description: 'Juegos omitidos por datos invalidos' }),
});
