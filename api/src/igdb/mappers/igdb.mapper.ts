import type { IgdbGameDto } from '../dto/igdb-game.dto.js';
import type { IgdbRawGame } from '../igdb.types.js';

const IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload';

/** Tamanos de imagen utiles para el modelo del proyecto. */
export const IGDB_IMAGE_SIZES = {
  coverBig: 't_cover_big',
  screenshotBig: 't_screenshot_big',
} as const;

/** Campos solicitados a IGDB para el modelo local. */
export const IGDB_GAME_FIELDS = [
  'id',
  'name',
  'slug',
  'summary',
  'storyline',
  'cover.image_id',
  'screenshots.image_id',
  'genres.name',
  'platforms.name',
  'first_release_date',
  'aggregated_rating',
  'aggregated_rating_count',
  'total_rating',
  'total_rating_count',
  'rating',
  'rating_count',
].join(', ');

export function buildCoverUrl(
  imageId: string | null | undefined,
): string | null {
  if (!imageId) {
    return null;
  }
  return `${IMAGE_BASE_URL}/${IGDB_IMAGE_SIZES.coverBig}/${imageId}.jpg`;
}

export function buildScreenshotUrl(
  imageId: string | null | undefined,
): string | null {
  if (!imageId) {
    return null;
  }
  return `${IMAGE_BASE_URL}/${IGDB_IMAGE_SIZES.screenshotBig}/${imageId}.jpg`;
}

/** Normaliza un slug de IGDB al formato slug del proyecto (kebab-case). */
export function normalizeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Convierte epoch en segundos a fecha ISO (YYYY-MM-DD). */
export function epochToDateString(
  epochSeconds: number | null | undefined,
): string | null {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) {
    return null;
  }
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Normaliza un score numerico de IGDB: los campos Double se redondean a dos
 * decimales y los no numericos se consideran ausentes (null).
 */
export function toRoundedScore(
  value: number | null | undefined,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(2));
}

/** Valida que el objeto crudo tenga la forma minima esperada. */
export function isValidRawGame(raw: unknown): raw is IgdbRawGame {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const candidate = raw as Partial<IgdbRawGame>;
  return (
    typeof candidate.id === 'number' &&
    Number.isFinite(candidate.id) &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0
  );
}

/** Mapea la respuesta cruda de IGDB al DTO normalizado de la API. */
export function mapRawGameToDto(raw: IgdbRawGame): IgdbGameDto {
  const screenshots = (raw.screenshots ?? [])
    .map((screenshot) => buildScreenshotUrl(screenshot?.image_id))
    .filter((url): url is string => url !== null);

  const genres = (raw.genres ?? [])
    .map((genre) => genre?.name)
    .filter((name): name is string => Boolean(name));

  const platforms = (raw.platforms ?? [])
    .map((platform) => platform?.name)
    .filter((name): name is string => Boolean(name));

  const criticsScore = toRoundedScore(raw.aggregated_rating);
  const criticsCount = toRoundedScore(raw.aggregated_rating_count);
  const totalScore = toRoundedScore(raw.total_rating);
  const totalScoreCount = toRoundedScore(raw.total_rating_count);

  const rating =
    typeof raw.rating === 'number' && Number.isFinite(raw.rating)
      ? raw.rating
      : null;

  const ratingCount =
    typeof raw.rating_count === 'number' && Number.isFinite(raw.rating_count)
      ? raw.rating_count
      : null;

  return {
    igdbId: String(raw.id),
    title: raw.name as string,
    slug: raw.slug ?? normalizeSlug(raw.name as string),
    summary: raw.summary ?? null,
    description: raw.storyline ?? raw.summary ?? null,
    coverUrl: buildCoverUrl(raw.cover?.image_id),
    screenshots,
    genres,
    platforms,
    releaseDate: epochToDateString(raw.first_release_date),
    criticsScore,
    criticsCount,
    totalScore,
    totalScoreCount,
    rating,
    ratingCount,
  };
}
