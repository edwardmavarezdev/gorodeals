import { Type } from '@sinclair/typebox';

/** Esquemas del modulo de sincronizacion de precios. */

/** Tiendas que el modulo sabe sincronizar. */
export const PRICE_SYNC_STORE_NAMES = ['steam', 'gog', 'nintendo'] as const;

/**
 * Parametros de la ejecucion manual del sync.
 *
 * Todos son opcionales: si se omiten se usa la configuracion del entorno.
 * `additionalProperties: false` reproduce el `forbidNonWhitelisted` del
 * `ValidationPipe` de NestJS.
 */
export const PriceSyncRunBody = Type.Object(
  {
    storeNames: Type.Optional(
      Type.Array(
        Type.Union(PRICE_SYNC_STORE_NAMES.map((name) => Type.Literal(name))),
        {
          minItems: 1,
          description: 'Tiendas a sincronizar en esta ejecucion',
        },
      ),
    ),
    batchSize: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 1000,
        description: 'Numero de ofertas por lote al recorrer el catalogo',
      }),
    ),
    catalogPages: Type.Optional(
      Type.Integer({
        minimum: 0,
        maximum: 200,
        description:
          'Paginas de catalogo de IGDB (limit/offset) a sincronizar antes de auditar precios',
      }),
    ),
    maxProducts: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 10000,
        description:
          'Limite de ofertas a procesar. Util para ejecuciones manuales acotadas',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Resultado de la sincronizacion de una tienda. */
export const PriceSyncStoreResult = Type.Object({
  storeName: Type.String({
    description: 'Tienda sincronizada',
    example: 'steam',
  }),
  processed: Type.Number({ description: 'Ofertas procesadas' }),
  updated: Type.Number({ description: 'Ofertas actualizadas' }),
  changed: Type.Number({ description: 'Ofertas con variacion de precio' }),
  unchanged: Type.Number({ description: 'Ofertas sin variacion de precio' }),
  unavailable: Type.Number({ description: 'Ofertas sin datos en la tienda' }),
  historyInserted: Type.Number({
    description: 'Filas nuevas en price_history',
  }),
  errors: Type.Number({ description: 'Errores aislados durante el proceso' }),
  durationMs: Type.Number({
    description: 'Duracion del recorrido de la tienda (ms)',
  }),
});

/** Totales agregados de la ejecucion. */
export const PriceSyncTotals = Type.Object({
  processed: Type.Number(),
  updated: Type.Number(),
  changed: Type.Number(),
  unchanged: Type.Number(),
  historyInserted: Type.Number(),
  unavailable: Type.Number(),
  errors: Type.Number(),
});

/** Resultado de la fase de catalogo de IGDB. */
export const PriceSyncCatalogResult = Type.Object({
  pages: Type.Number({ description: 'Paginas de catalogo recorridas' }),
  fetched: Type.Number({ description: 'Juegos leidos de IGDB' }),
  upserted: Type.Number({ description: 'Juegos insertados o actualizados' }),
  skipped: Type.Number({ description: 'Juegos omitidos' }),
  errors: Type.Number({
    description: 'Errores durante la sincronizacion del catalogo',
  }),
});

/** Resultado completo de una ejecucion del sync. */
export const PriceSyncRunResult = Type.Object({
  startedAt: Type.String({ description: 'Inicio de la ejecucion (ISO 8601)' }),
  finishedAt: Type.String({ description: 'Fin de la ejecucion (ISO 8601)' }),
  durationMs: Type.Number({ description: 'Duracion total (ms)' }),
  skipped: Type.Boolean({
    description: 'true si la ejecucion se omitio por solapamiento',
  }),
  skipReason: Type.Union([Type.String(), Type.Null()], {
    description: 'Motivo de la omision',
  }),
  stores: Type.Array(PriceSyncStoreResult, {
    description: 'Resultado por tienda',
  }),
  totals: PriceSyncTotals,
  catalog: Type.Union([PriceSyncCatalogResult, Type.Null()], {
    description:
      'Resultado de la sincronizacion del catalogo de IGDB, si se ejecuto',
  }),
});

/** Estado del modulo de sincronizacion. */
export const PriceSyncStatus = Type.Object({
  cron: Type.String({ description: 'Cron activo del modulo' }),
  timezone: Type.String({
    description: 'Zona horaria del cron',
    example: 'UTC',
  }),
  enabled: Type.Boolean({ description: 'Sincronizacion activada' }),
  batchSize: Type.Number({ description: 'Tamano de lote configurado' }),
  storeNames: Type.Array(Type.String(), {
    description: 'Tiendas configuradas',
  }),
  running: Type.Boolean({ description: 'Hay una ejecucion en curso' }),
  lastRun: Type.Union([PriceSyncRunResult, Type.Null()], {
    description: 'Resultado de la ultima ejecucion',
  }),
  catalogPages: Type.Number({
    description: 'Paginas de catalogo de IGDB sincronizadas por ciclo',
  }),
  runId: Type.Union([Type.String(), Type.Null()], {
    description: 'Identificador de la ejecucion en curso',
  }),
});

/** Fila del historico de precios de una oferta. */
export const PriceHistoryEntry = Type.Object({
  id: Type.String({ description: 'Identificador de la fila de historico' }),
  storeProductId: Type.String({ description: 'Oferta de tienda (uuid)' }),
  price: Type.Number({ description: 'Precio registrado' }),
  regularPrice: Type.Union([Type.Number(), Type.Null()], {
    description: 'Precio regular en el momento del registro',
  }),
  discountPercent: Type.Union([Type.Number(), Type.Null()], {
    description: 'Descuento en el momento del registro',
  }),
  source: Type.String({ description: 'Origen del registro', example: 'sync' }),
  recordedAt: Type.String({
    description: 'Momento del registro, truncado al dia (UTC)',
  }),
});

/**
 * Historico de precios de una oferta.
 *
 * Es un ARRAY de entradas, no un objeto: el servicio devuelve la lista
 * directamente.
 */
export const PriceHistoryList = Type.Array(PriceHistoryEntry);

/** Ventana temporal del historico. */
export const PriceSyncHistoryQuery = Type.Object(
  {
    windowMonths: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 60,
        description:
          'Ventana temporal del historico en meses (1-60, por defecto 12)',
      }),
    ),
  },
  { additionalProperties: false },
);
