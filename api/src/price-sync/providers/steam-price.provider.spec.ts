import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config.js';
import { SteamService } from '../../steam/steam.service.js';
import { SteamAppNotFoundError } from '../../steam/steam.errors.js';
import { SteamPriceProvider } from './steam-price.provider.js';

/**
 * Doble del servicio de Steam que reproduce los tres desenlaces posibles:
 * precio publicado, "sin datos" y fallo tecnico (503).
 */
class FakeSteamService {
  prices = new Map<number, unknown>();
  notFound = new Set<number>();
  failing = new Set<number>();

  getCurrentPrice(product: {
    storeName: string;
    storeProductId: string;
  }): Promise<unknown> {
    const appId = Number(product.storeProductId);
    if (this.failing.has(appId)) {
      return Promise.reject(
        new Error('Steam store API no disponible: HTTP 503'),
      );
    }
    if (this.notFound.has(appId)) {
      return Promise.reject(new SteamAppNotFoundError(appId));
    }
    const price = this.prices.get(appId);
    return Promise.resolve(price ?? null);
  }
}

function price(appId: number) {
  return {
    appId,
    name: 'Juego',
    currency: 'USD',
    currentPrice: 19.99,
    regularPrice: 39.99,
    discountPercent: 50,
    isFree: false,
    isAvailable: true,
    url: `https://store.steampowered.com/app/${appId}`,
    ratingPercent: 90,
    ratingVotes: 100,
    metacriticScore: 90,
    downloadSizeMb: null,
    releaseDate: null,
    developers: [],
    publishers: [],
    genres: [],
    platforms: ['Windows'],
    headerImage: null,
  };
}

describe('SteamPriceProvider', () => {
  let provider: SteamPriceProvider;
  let steamService: FakeSteamService;

  beforeEach(() => {
    steamService = new FakeSteamService();
    const config = {
      steam: { concurrency: 2 },
      priceSync: { requestDelayMs: 0 },
    } as unknown as AppConfig;

    provider = new SteamPriceProvider(
      { query: () => Promise.resolve([]) } as unknown as DataSource,
      steamService as unknown as SteamService,
      config,
    );
  });

  it('devuelve ok cuando Steam publica precio', async () => {
    steamService.prices.set(440, price(440));

    const results = await provider.fetchPrices(['440']);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('ok');
    if (results[0].status === 'ok') {
      expect(results[0].snapshot.currentPrice).toBe('19.99');
      expect(results[0].snapshot.currency).toBe('USD');
    }
  });

  it('devuelve unavailable cuando Steam no publica datos', async () => {
    steamService.prices.set(440, null);

    const results = await provider.fetchPrices(['440']);

    expect(results[0].status).toBe('unavailable');
  });

  it('devuelve unavailable cuando el appid no existe', async () => {
    steamService.notFound.add(440);

    const results = await provider.fetchPrices(['440']);

    expect(results[0].status).toBe('unavailable');
  });

  it('devuelve error cuando la tienda falla (503), no unavailable', async () => {
    steamService.failing.add(440);

    const results = await provider.fetchPrices(['440']);

    // Un fallo tecnico NO es "sin datos": el orquestador no debe marcar la
    // oferta como no disponible.
    expect(results[0].status).toBe('error');
    if (results[0].status === 'error') {
      expect(results[0].error.message).toContain('503');
    }
  });

  it('mantiene el orden de los resultados respecto a la entrada', async () => {
    steamService.prices.set(440, price(440));
    steamService.failing.add(570);

    const results = await provider.fetchPrices(['440', '570', '620']);

    expect(results.map((r) => r.storeProductId)).toEqual(['440', '570', '620']);
    expect(results.map((r) => r.status)).toEqual([
      'ok',
      'error',
      'unavailable',
    ]);
  });
});
