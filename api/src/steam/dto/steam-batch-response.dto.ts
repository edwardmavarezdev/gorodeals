import { SteamPriceSnapshotDto } from './steam-price-snapshot.dto.js';

/**
 * Respuesta de `POST /steam/batch`: mapa de snapshots indexado por appid.
 * Los appids sin datos publicados por Steam no aparecen en el mapa.
 *
 * El mapa no se puede expresar como una clase con propiedades fijas: se
 * declara como tipo indexado y su esquema Swagger se define en el
 * controlador con `additionalProperties`.
 */
export type SteamBatchResponseDto = Record<string, SteamPriceSnapshotDto>;

/**
 * Esquema Swagger del mapa de snapshots de Steam.
 */
export const STEAM_BATCH_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: { $ref: '#/components/schemas/SteamPriceSnapshotDto' },
  example: {
    '1091500': {
      appId: 1091500,
      name: 'Cyberpunk 2077',
      currency: 'USD',
      currentPrice: 19.99,
      regularPrice: 39.99,
      discountPercent: 50,
      isFree: false,
      isAvailable: true,
      url: 'https://store.steampowered.com/app/1091500',
      ratingPercent: 92,
      ratingVotes: 120000,
      metacriticScore: 93,
      downloadSizeMb: null,
      releaseDate: '2020-12-10',
      developers: ['CD PROJEKT RED'],
      publishers: ['CD PROJEKT RED'],
      genres: ['RPG'],
      platforms: ['Windows'],
      headerImage: null,
    },
  },
};
