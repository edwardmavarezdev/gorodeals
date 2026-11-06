import {
  buildCoverUrl,
  buildScreenshotUrl,
  epochToDateString,
  isValidRawGame,
  mapRawGameToDto,
  normalizeSlug,
  toRoundedScore,
} from './igdb.mapper.js';

describe('igdb.mapper', () => {
  describe('normalizeSlug', () => {
    it('normaliza a kebab-case sin acentos', () => {
      expect(normalizeSlug('Pokémon Legends: Arceus')).toBe(
        'pokemon-legends-arceus',
      );
    });

    it('colapsa separadores repetidos', () => {
      expect(normalizeSlug('  the   witcher  3 ')).toBe('the-witcher-3');
    });
  });

  describe('epochToDateString', () => {
    it('convierte epoch en fecha ISO', () => {
      expect(epochToDateString(1379635200)).toBe('2013-09-20');
    });

    it('devuelve null para valores no numericos', () => {
      expect(epochToDateString(null)).toBeNull();
      expect(epochToDateString(undefined)).toBeNull();
      expect(epochToDateString(Number.NaN)).toBeNull();
    });
  });

  describe('buildCoverUrl / buildScreenshotUrl', () => {
    it('construye la URL de imagen de IGDB', () => {
      expect(buildCoverUrl('co1x0h')).toBe(
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x0h.jpg',
      );
      expect(buildScreenshotUrl('sc1x0a')).toBe(
        'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1x0a.jpg',
      );
    });

    it('devuelve null si no hay image_id', () => {
      expect(buildCoverUrl(null)).toBeNull();
      expect(buildCoverUrl(undefined)).toBeNull();
    });
  });

  describe('toRoundedScore', () => {
    it('redondea a dos decimales', () => {
      expect(toRoundedScore(93.27123)).toBe(93.27);
    });

    it('devuelve null para valores no numericos', () => {
      expect(toRoundedScore(null)).toBeNull();
      expect(toRoundedScore(undefined)).toBeNull();
      expect(toRoundedScore(Number.NaN)).toBeNull();
    });
  });

  describe('isValidRawGame', () => {
    it('exige id numerico y nombre no vacio', () => {
      expect(isValidRawGame({ id: 1, name: 'Juego' })).toBe(true);
      expect(isValidRawGame({ id: 1, name: '   ' })).toBe(false);
      expect(isValidRawGame({ id: 'x', name: 'Juego' })).toBe(false);
      expect(isValidRawGame(null)).toBe(false);
    });
  });

  describe('mapRawGameToDto', () => {
    it('mapea los campos anidados de IGDB', () => {
      const dto = mapRawGameToDto({
        id: 1020,
        name: 'Grand Theft Auto V',
        slug: 'grand-theft-auto-v',
        summary: 'Resumen',
        storyline: 'Historia',
        cover: { image_id: 'co1x0h' },
        screenshots: [{ image_id: 'sc1x0a' }],
        genres: [{ name: 'Action' }],
        platforms: [{ name: 'PC' }],
        first_release_date: 1379635200,
        aggregated_rating: 96.4,
        aggregated_rating_count: 42,
        total_rating: 93.27,
        total_rating_count: 5432,
        rating: 91.2,
        rating_count: 5432,
      });

      expect(dto).toEqual({
        igdbId: '1020',
        title: 'Grand Theft Auto V',
        slug: 'grand-theft-auto-v',
        summary: 'Resumen',
        description: 'Historia',
        coverUrl:
          'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x0h.jpg',
        screenshots: [
          'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1x0a.jpg',
        ],
        genres: ['Action'],
        platforms: ['PC'],
        releaseDate: '2013-09-20',
        criticsScore: 96.4,
        criticsCount: 42,
        totalScore: 93.27,
        totalScoreCount: 5432,
        rating: 91.2,
        ratingCount: 5432,
      });
    });

    it('tolera campos nidos ausentes', () => {
      const dto = mapRawGameToDto({ id: 5, name: 'Sin cover' });

      expect(dto.coverUrl).toBeNull();
      expect(dto.screenshots).toEqual([]);
      expect(dto.genres).toEqual([]);
      expect(dto.platforms).toEqual([]);
      expect(dto.releaseDate).toBeNull();
      expect(dto.criticsScore).toBeNull();
      expect(dto.criticsCount).toBeNull();
      expect(dto.totalScore).toBeNull();
      expect(dto.totalScoreCount).toBeNull();
    });

    it('usa el summary como description si no hay storyline', () => {
      const dto = mapRawGameToDto({
        id: 6,
        name: 'X',
        summary: 'Solo resumen',
      });
      expect(dto.description).toBe('Solo resumen');
    });
  });
});
