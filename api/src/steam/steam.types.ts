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
 * El snapshot normalizado de precio (importes en la unidad mayor, con
 * `regularPrice` siempre definido) es el contrato que consumen el sync de
 * precios y el historico. Su forma la fija el esquema `SteamPriceSnapshot`
 * de `src/schemas/steam.ts`: el servicio devuelve `Static<typeof
 * SteamPriceSnapshot>` y el controlador lo serializa con ese mismo esquema.
 */
