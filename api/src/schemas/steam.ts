import { Type } from '@sinclair/typebox';

/** Esquemas del dominio de Steam. */

/**
 * Cuerpo de error de la API.
 *
 * El manejador global (`src/hooks/error.ts`) responde `{ statusCode, message,
 * error }`, pero `message` es una lista de textos cuando el error viene de la
 * validacion de la entrada. El esquema deja las propiedades abiertas para no
 * perder campos ni fallar al serializar una lista como si fuera una cadena.
 */
export const SteamErrorResponse = Type.Object(
  {},
  {
    additionalProperties: true,
    description: 'Error de la API',
  },
);

/**
 * Appid de Steam en la ruta.
 *
 * En NestJS lo validaba `ParseIntPipe`, no un DTO: acepta cualquier entero
 * con signo (`/^-?\d+$/`) y, cuando el valor no es numerico, responde 400 con
 * un mensaje de texto plano ("Validation failed (numeric string is
 * expected)"), no con la lista de mensajes de la validacion de esquema.
 *
 * Para devolver exactamente el mismo cuerpo, el esquema deja la cadena sin
 * restringir y la comprobacion la hace el controlador.
 */
export const SteamAppIdParams = Type.Object({
  appId: Type.String({
    description: 'Appid de Steam',
    example: '1091500',
  }),
});

/**
 * Lote de appids para `POST /steam/batch`.
 *
 * Traduce `SteamBatchDto`: entre 1 y 100 appids, cada uno entero entre 1 y
 * 2147483647.
 */
export const SteamBatchBody = Type.Object(
  {
    appIds: Type.Array(Type.Integer({ minimum: 1, maximum: 2_147_483_647 }), {
      minItems: 1,
      maxItems: 100,
      description: 'Appids de Steam a consultar',
      examples: [[1091500, 1145360]],
    }),
  },
  { additionalProperties: false },
);

/**
 * Sincronizacion de appids contra un juego del catalogo.
 *
 * Traduce `SyncSteamAppDto`: `gameId` es un UUID v4 y el lote de appids
 * tiene las mismas limits que el del endpoint de batch.
 */
export const SteamSyncBody = Type.Object(
  {
    gameId: Type.String({
      format: 'uuid',
      description: 'Juego del catalogo al que se vinculan las ofertas de Steam',
    }),
    appIds: Type.Array(Type.Integer({ minimum: 1, maximum: 2_147_483_647 }), {
      minItems: 1,
      maxItems: 100,
      description: 'Appids de Steam a sincronizar',
      examples: [[1091500, 1145360]],
    }),
  },
  { additionalProperties: false },
);

/**
 * Snapshot de precio de un appid.
 *
 * Los campos coinciden con `SteamPriceSnapshotDto`: el servicio devuelve
 * exactamente estas claves, y ninguna mas.
 */
export const SteamPriceSnapshot = Type.Object({
  appId: Type.Number({ description: 'Appid de Steam', example: 1091500 }),
  name: Type.Union([Type.String(), Type.Null()], {
    description: 'Nombre del juego en Steam',
  }),
  currency: Type.String({ description: 'Moneda ISO 4217 del precio' }),
  currentPrice: Type.Number({ description: 'Precio actual' }),
  regularPrice: Type.Number({ description: 'Precio regular' }),
  discountPercent: Type.Number({ description: 'Descuento en porcentaje' }),
  isFree: Type.Boolean({ description: 'El juego es gratis en la region' }),
  isAvailable: Type.Boolean({ description: 'Hay precio disponible' }),
  url: Type.String({ description: 'URL de la ficha en la tienda' }),
  ratingPercent: Type.Union([Type.Number(), Type.Null()], {
    description: 'Valoracion de usuarios en porcentaje (0-100)',
  }),
  ratingVotes: Type.Union([Type.Number(), Type.Null()], {
    description: 'Numero de votos de la valoracion',
  }),
  metacriticScore: Type.Union([Type.Number(), Type.Null()], {
    description: 'Puntuacion de Metacritic',
  }),
  downloadSizeMb: Type.Union([Type.Number(), Type.Null()], {
    description: 'Tamano de descarga en MB (null: Steam no lo publica)',
  }),
  releaseDate: Type.Union([Type.String(), Type.Null()], {
    description: 'Fecha de salida publicada por Steam',
  }),
  developers: Type.Array(Type.String(), { description: 'Desarrolladores' }),
  publishers: Type.Array(Type.String(), { description: 'Editores' }),
  genres: Type.Array(Type.String(), { description: 'Generos' }),
  platforms: Type.Array(Type.String(), { description: 'Plataformas' }),
  headerImage: Type.Union([Type.String(), Type.Null()], {
    description: 'URL de la imagen de cabecera',
  }),
});

/**
 * Respuesta de `POST /steam/batch`: mapa de snapshots indexado por appid.
 *
 * Los appids sin datos publicados por Steam no aparecen en el mapa.
 */
export const SteamBatchResponse = Type.Object(
  {},
  { additionalProperties: SteamPriceSnapshot },
);

/** Resultado de persistir un appid de Steam. */
export const SteamSyncItem = Type.Object({
  appId: Type.Number({ description: 'Appid de Steam' }),
  status: Type.Union(
    [
      Type.Literal('upserted'),
      Type.Literal('not_found'),
      Type.Literal('error'),
    ],
    { description: 'Resultado de la operacion' },
  ),
  storeProductId: Type.Optional(
    Type.String({ description: 'uuid de la fila en store_products' }),
  ),
  gameId: Type.Optional(
    Type.String({ description: 'uuid del juego vinculado' }),
  ),
  currentPrice: Type.Optional(
    Type.Number({ description: 'Precio actual persistido' }),
  ),
  regularPrice: Type.Optional(
    Type.Number({ description: 'Precio regular persistido' }),
  ),
  discountPercent: Type.Optional(
    Type.Number({ description: 'Descuento persistido' }),
  ),
  currency: Type.Optional(Type.String({ description: 'Moneda persistida' })),
  message: Type.Optional(Type.String({ description: 'Motivo del no-ok' })),
});

/** Resumen de la sincronizacion de un lote de appids. */
export const SteamSyncSummary = Type.Object({
  requested: Type.Number({ description: 'Appids solicitados' }),
  upserted: Type.Number({ description: 'Appids persistidos' }),
  notFound: Type.Number({ description: 'Appids sin datos en Steam' }),
  errors: Type.Number({ description: 'Appids con error' }),
  items: Type.Array(SteamSyncItem),
});

/** Oferta de Steam persistida en el catalogo. */
export const SteamProduct = Type.Object({
  id: Type.String({ description: 'UUID de la oferta' }),
  gameId: Type.String({ description: 'UUID del juego' }),
  storeName: Type.String({ description: 'Tienda de la oferta' }),
  storeProductId: Type.String({ description: 'Id del producto en la tienda' }),
  currentPrice: Type.Number({ description: 'Precio actual' }),
  regularPrice: Type.Number({ description: 'Precio regular' }),
  discountPercent: Type.Number({ description: 'Descuento en porcentaje' }),
  currency: Type.String({ description: 'Moneda ISO 4217 del precio' }),
  url: Type.Union([Type.String(), Type.Null()], {
    description: 'URL de la ficha en la tienda',
  }),
  isAvailable: Type.Boolean({ description: 'La oferta esta disponible' }),
  lastCheckedAt: Type.String({
    description: 'Ultima comprobacion del precio',
    example: '2026-11-10T06:00:07.933Z',
  }),
  historicalLowPrice: Type.Union([Type.Number(), Type.Null()], {
    description: 'Minimo historico observado',
  }),
});
