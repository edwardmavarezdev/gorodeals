/**
 * Forma cruda de la respuesta de IGDB v4 (Apicalypse). Solo se declara lo que
 * el modulo solicita, de modo que un cambio en los `fields` de la query se
 * detecte al compilar.
 */

export interface IgdbNamedRef {
  name?: string | null;
}

export interface IgdbImageRef {
  image_id?: string | null;
}

export interface IgdbCoverRef extends IgdbImageRef {
  id?: number | null;
}

export interface IgdbScreenshotRef extends IgdbImageRef {
  id?: number | null;
}

export interface IgdbRawGame {
  id: number;
  name?: string | null;
  slug?: string | null;
  summary?: string | null;
  storyline?: string | null;
  cover?: IgdbCoverRef | null;
  screenshots?: IgdbScreenshotRef[] | null;
  genres?: IgdbNamedRef[] | null;
  platforms?: IgdbNamedRef[] | null;
  first_release_date?: number | null;
  /** Puntuacion media de criticos externos (0-100). */
  aggregated_rating?: number | null;
  /** Numero de puntuaciones de criticos externos. */
  aggregated_rating_count?: number | null;
  /** Puntuacion media de usuarios de IGDB y criticos externos (0-100). */
  total_rating?: number | null;
  /** Numero total de puntuaciones de usuarios y criticos. */
  total_rating_count?: number | null;
  rating?: number | null;
  rating_count?: number | null;
}

export interface IgdbTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string | string[];
}
