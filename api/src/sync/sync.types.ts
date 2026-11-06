/**
 * Tipos del contrato de sincronizacion de juegos de prueba.
 *
 * El mismo contrato sirve para el script de CLI (`scripts/sync-random-games.ts`)
 * y para el endpoint `POST /admin/sync/random`, de modo que la logica de
 * negocio vive una sola vez en `SyncRandomGamesService`.
 */

/** Plataformas soportadas por la sincronizacion de prueba. */
export type SyncPlatform = 'steam' | 'nintendo';

/** Tiendas que el endpoint y el CLI saben rellenar. */
export const SYNC_PLATFORMS: readonly SyncPlatform[] = ['steam', 'nintendo'];

/**
 * Normaliza el texto de plataformas (`"steam,nintendo"`, `"pc,switch"`) a la
 * lista de tiendas soportadas. Acepta los alias `pc` -> `steam` y
 * `switch` -> `nintendo`.
 */
export function parseSyncPlatforms(raw: string): SyncPlatform[] {
  const aliases: Record<string, SyncPlatform> = {
    steam: 'steam',
    pc: 'steam',
    nintendo: 'nintendo',
    switch: 'nintendo',
  };
  const platforms = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .map((value) => aliases[value])
    .filter((value): value is SyncPlatform => value !== undefined);
  return platforms.length > 0 ? [...new Set(platforms)] : [...SYNC_PLATFORMS];
}

/** Origen de los datos de cada tienda (contrato del endpoint admin). */
export type SyncSource = 'steam-search' | 'nintendo-api' | 'curated' | 'error';

export interface SyncRandomGamesOptions {
  /** Numero de juegos a traer por tienda. */
  count: number;
  /** Tiendas a sincronizar. */
  platforms: SyncPlatform[];
  /** Semilla del PRNG: hace el resultado reproducible. */
  seed?: number;
  /**
   * Si es `true` no se refrescan las ofertas ya gestionadas y se eligen
   * siempre juegos aleatorios nuevos (que no existan todavia). Por defecto
   * es `false`: la sincronizacion refresca lo ya sincronizado y solo anade
   * juegos nuevos cuando faltan para llegar a `count`.
   */
  onlyNew?: boolean;
}

export interface SyncRandomGamesResult {
  requested: {
    count: number;
    platforms: SyncPlatform[];
  };
  /** Juegos creados o actualizados. */
  games: number;
  /** Ofertas creadas o actualizadas. */
  offers: number;
  /** Filas de `price_history` insertadas (0 si ya existian). */
  history: number;
  durationMs: number;
  /** Estado por tienda: de donde salio cada conjunto de datos. */
  sources: Record<string, SyncSource>;
}

/**
 * Juego candidato a persistir, ya normalizado por tienda. Es la unidad que
 * consume la capa de persistencia (independiente de Steam o de Nintendo).
 */
export interface SyncCandidate {
  storeName: SyncPlatform;
  /** Id de producto en la tienda (appid de Steam o NSUID de la eShop). */
  storeProductId: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: string | null;
  metacriticScore: number | null;
  currentPrice: number;
  regularPrice: number;
  discountPercent: number;
  currency: string;
  url: string;
  isAvailable: boolean;
  /** Valoracion de usuarios en porcentaje (0-100), null si no hay datos. */
  ratingPercent: number | null;
}
