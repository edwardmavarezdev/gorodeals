/**
 * Tipos crudos devueltos por la API publica de la tienda de Steam.
 * Se replican aqui solo los campos que el modulo consume: la API devuelve
 * mucho mas (descripciones HTML, capturas, achievements) y no interesa.
 *
 * Referencia: https://store.steampowered.com/api/appdetails?appids=<id>
 */

/** Importes en centavos, tal como los publica Steam. */
export interface SteamPriceOverview {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
  initial_formatted?: string;
  final_formatted?: string;
}

export interface SteamRecommendations {
  total?: number;
  total_positive?: number;
}

export interface SteamMetacritic {
  score?: number;
}

export interface SteamReleaseDate {
  coming_soon?: boolean;
  date?: string;
}

export interface SteamAppDetails {
  type?: string;
  name?: string;
  steam_appid?: number;
  required_age?: number;
  is_free?: boolean;
  short_description?: string;
  header_image?: string;
  capsule_image?: string;
  website?: string;
  developers?: string[];
  publishers?: string[];
  price_overview?: SteamPriceOverview;
  recommendations?: SteamRecommendations;
  metacritic?: SteamMetacritic;
  platforms?: Record<string, boolean>;
  release_date?: SteamReleaseDate;
  categories?: { id: number; description: string }[];
  genres?: { id: number; description: string }[];
  dlc?: number[];
}

/** Envoltorio por appid devuelto por la API. */
export interface SteamAppDetailsResponse {
  success: boolean;
  data?: SteamAppDetails;
}

/**
 * Snapshot normalizado de precio. Es el contrato que consumen el sync de
 * precios y el historico: importes en la unidad mayor (divisor 100) y
 * `regularPrice` siempre definido (igual a `currentPrice` si no hay lista).
 */
export interface SteamPriceSnapshot {
  appId: number;
  name: string | null;
  currency: string;
  currentPrice: number;
  regularPrice: number;
  discountPercent: number;
  isFree: boolean;
  isAvailable: boolean;
  url: string;
  /** Valoracion de usuarios en porcentaje (0-100), null si no hay datos. */
  ratingPercent: number | null;
  ratingVotes: number | null;
  metacriticScore: number | null;
  /** Tamano de descarga en MB. Steam no lo publica en appdetails: null. */
  downloadSizeMb: number | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: string[];
  headerImage: string | null;
}
