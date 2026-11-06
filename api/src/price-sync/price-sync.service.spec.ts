import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { IgdbService } from '../igdb/igdb.service.js';
import { StoreName } from '../store-products/entities/store-product.entity.js';
import {
  PriceHistoryService,
  StoreProductState,
} from './history/price-history.service.js';
import { SteamPriceProvider } from './providers/steam-price.provider.js';
import { PriceSyncService } from './price-sync.service.js';
import { StorePriceResult, StorePriceSnapshot } from './sync.types.js';

class FakeDataSource {
  queries: Array<{ sql: string; params?: unknown[] }> = [];

  query(sql: string, params?: unknown[]): Promise<unknown[]> {
    this.queries.push({ sql, params });
    if (sql.includes('INSERT INTO price_sync_locks')) {
      return Promise.resolve([{ id: 'price_sync' }]);
    }
    return Promise.resolve([]);
  }
}

/**
 * Proveedor de mentira que reproduce el contrato real: un resultado por
 * producto, con los tres estados posibles (ok, unavailable, error).
 */
class FakeSteamProvider {
  batches: string[][] = [];
  /** Identificadores de producto, en orden de recorrido. */
  ids: string[] = [];
  /** Cursor (uuid) del ultimo elemento entregado. */
  cursors: (string | undefined)[] = [];
  snapshots = new Map<string, StorePriceSnapshot>();
  /** Productos sin datos publicados por la tienda. */
  unavailable = new Set<string>();
  /** Productos con fallo tecnico de la tienda. */
  failing = new Set<string>();
  /** Excepcion que rechaza la llamada entera. */
  failWith: Error | null = null;

  readonly storeName = StoreName.STEAM;

  listStoreProductIds(
    batchSize: number,
    cursor?: string,
  ): Promise<{ items: string[]; cursor?: string }> {
    this.cursors.push(cursor);
    const start = cursor ? this.ids.indexOf(cursor) + 1 : 0;
    const items = this.ids.slice(start, start + batchSize);
    return Promise.resolve({
      items,
      cursor: items.length > 0 ? items[items.length - 1] : undefined,
    });
  }

  fetchPrices(ids: string[]): Promise<StorePriceResult[]> {
    this.batches.push(ids);
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    return Promise.resolve(
      ids.map((id): StorePriceResult => {
        if (this.failing.has(id)) {
          return {
            storeProductId: id,
            status: 'error',
            error: new Error('Steam respondio 503'),
          };
        }
        if (this.unavailable.has(id)) {
          return { storeProductId: id, status: 'unavailable' };
        }
        const snap = this.snapshots.get(id);
        if (!snap) {
          return { storeProductId: id, status: 'unavailable' };
        }
        return { storeProductId: id, status: 'ok', snapshot: snap };
      }),
    );
  }
}

class FakeHistoryService {
  states = new Map<string, StoreProductState>();
  persisted: Array<{ state: StoreProductState; snapshot: StorePriceSnapshot }> =
    [];
  failOn: string | null = null;
  unavailable: string[] = [];
  /** Numero de llamadas a la persistencia por lote. */
  batchCalls = 0;
  /** Tamano de cada lote persistido. */
  batchSizes: number[] = [];

  findStoreProductStates(
    _storeName: StoreName,
    ids: string[],
  ): Promise<Map<string, StoreProductState>> {
    const out = new Map<string, StoreProductState>();
    for (const id of ids) {
      const state = this.states.get(id);
      if (state) {
        out.set(id, state);
      }
    }
    return Promise.resolve(out);
  }

  persistSnapshot(
    state: StoreProductState,
    snapshot: StorePriceSnapshot,
  ): Promise<{ changed: boolean; historyInserted: boolean }> {
    if (this.failOn && state.storeProductId === this.failOn) {
      return Promise.reject(new Error('fallo de persistencia'));
    }
    this.persisted.push({ state, snapshot });
    const changed =
      Number(snapshot.currentPrice).toFixed(2) !==
      state.currentPrice.toFixed(2);
    return Promise.resolve({ changed, historyInserted: changed });
  }

  /**
   * Persistencia por lote: si un producto del lote falla, la transaccion
   * entera falla (igual que en la base de datos) y el servicio reintenta
   * producto a producto.
   */
  persistBatch(
    items: Array<{ state: StoreProductState; snapshot: StorePriceSnapshot }>,
  ): Promise<Map<string, { changed: boolean; historyInserted: boolean }>> {
    if (
      this.failOn &&
      items.some((i) => i.state.storeProductId === this.failOn)
    ) {
      return Promise.reject(new Error('fallo de persistencia'));
    }
    this.batchCalls += 1;
    this.batchSizes.push(items.length);
    const results = new Map<
      string,
      { changed: boolean; historyInserted: boolean }
    >();
    for (const { state, snapshot } of items) {
      this.persisted.push({ state, snapshot });
      const changed =
        Number(snapshot.currentPrice).toFixed(2) !==
        state.currentPrice.toFixed(2);
      results.set(state.storeProductId, {
        changed,
        historyInserted: changed,
      });
    }
    return Promise.resolve(results);
  }

  markUnavailable(state: StoreProductState): Promise<void> {
    this.unavailable.push(state.storeProductId);
    return Promise.resolve();
  }
}

class FakeIgdbService {
  configured = false;
  pages: number[] = [];

  isConfigured(): boolean {
    return this.configured;
  }

  sync(dto: { limit?: number; offset?: number }): Promise<{
    fetched: number;
    upserted: number;
    skipped: number;
  }> {
    this.pages.push(dto.offset ?? 0);
    return Promise.resolve({ fetched: 10, upserted: 10, skipped: 0 });
  }
}

function snapshot(
  storeProductId: string,
  currentPrice: string,
): StorePriceSnapshot {
  return {
    storeProductId,
    currentPrice,
    regularPrice: '59.99',
    discountPercent: '50.00',
    currency: 'USD',
    url: `https://store.steampowered.com/app/${storeProductId}`,
    isAvailable: true,
  };
}

function state(
  id: string,
  overrides: Partial<StoreProductState> = {},
): StoreProductState {
  return {
    id: `uuid-${id}`,
    storeProductId: id,
    currentPrice: 0,
    regularPrice: 0,
    discountPercent: 0,
    currency: 'USD',
    isAvailable: true,
    historicalLowPrice: null,
    ...overrides,
  };
}

describe('PriceSyncService', () => {
  let service: PriceSyncService;
  let dataSource: FakeDataSource;
  let historyService: FakeHistoryService;
  let steamProvider: FakeSteamProvider;
  let igdbService: FakeIgdbService;

  beforeEach(() => {
    dataSource = new FakeDataSource();
    historyService = new FakeHistoryService();
    steamProvider = new FakeSteamProvider();
    igdbService = new FakeIgdbService();

    const config = {
      get: (key: string) => {
        const values: Record<string, unknown> = {
          'priceSync.enabled': true,
          'priceSync.cron': '0 6 * * *',
          'priceSync.batchSize': 2,
          'priceSync.storeNames': 'steam',
          'priceSync.adminSecret': 'secreto',
          'priceSync.catalogPages': 0,
          'priceSync.lockTimeoutSeconds': 3600,
          'priceSync.maxFailureRate': 0.5,
        };
        return values[key];
      },
    } as unknown as ConfigService;

    service = new PriceSyncService(
      dataSource as unknown as DataSource,
      config,
      historyService as unknown as PriceHistoryService,
      steamProvider as unknown as SteamPriceProvider,
      igdbService as unknown as IgdbService,
    );
  });

  it('recorre el catalogo por lotes y persiste el precio de cada producto', async () => {
    steamProvider.ids = ['10', '20', '30'];
    steamProvider.snapshots.set('10', snapshot('10', '29.99'));
    steamProvider.snapshots.set('20', snapshot('20', '9.99'));
    steamProvider.snapshots.set('30', snapshot('30', '4.99'));
    for (const id of ['10', '20', '30']) {
      historyService.states.set(id, state(id));
    }

    const result = await service.runSync();

    expect(result.skipped).toBe(false);
    expect(result.totals.processed).toBe(3);
    expect(result.totals.changed).toBe(3);
    expect(result.totals.historyInserted).toBe(3);
    expect(historyService.persisted).toHaveLength(3);
    // Lotes de 2 elementos: el catalogo no se carga completo en memoria.
    expect(steamProvider.batches).toEqual([['10', '20'], ['30']]);
  });

  it('pide la siguiente pagina con el cursor del ultimo producto entregado', async () => {
    steamProvider.ids = ['10', '20', '30'];
    for (const id of ['10', '20', '30']) {
      steamProvider.snapshots.set(id, snapshot(id, '9.99'));
      historyService.states.set(id, state(id));
    }

    await service.runSync();

    // El cursor es opaco y lo produce el proveedor: la primera pagina no
    // lleva cursor y la siguiente usa el ultimo id entregado.
    expect(steamProvider.cursors).toEqual([undefined, '20']);
  });

  it('no registra variacion cuando el precio no ha cambiado', async () => {
    steamProvider.ids = ['10'];
    steamProvider.snapshots.set('10', snapshot('10', '29.99'));
    historyService.states.set(
      '10',
      state('10', {
        currentPrice: 29.99,
        regularPrice: 59.99,
        discountPercent: 50,
        historicalLowPrice: 29.99,
      }),
    );

    const result = await service.runSync();

    expect(result.totals.changed).toBe(0);
    expect(result.totals.unchanged).toBe(1);
    expect(result.totals.historyInserted).toBe(0);
  });

  it('continua el ciclo cuando falla un producto', async () => {
    steamProvider.ids = ['10', '20'];
    steamProvider.snapshots.set('10', snapshot('10', '29.99'));
    steamProvider.snapshots.set('20', snapshot('20', '9.99'));
    historyService.states.set('10', state('10'));
    historyService.states.set('20', state('20'));
    historyService.failOn = '10';

    const result = await service.runSync();

    expect(result.totals.errors).toBe(1);
    expect(result.totals.processed).toBe(1);
    expect(historyService.persisted.map((p) => p.state.storeProductId)).toEqual(
      ['20'],
    );
  });

  it('marca como no disponible el producto sin datos en la tienda', async () => {
    steamProvider.ids = ['10'];
    // El proveedor responde "sin datos" para el producto 10.
    historyService.states.set('10', state('10'));

    const result = await service.runSync();

    expect(result.totals.unavailable).toBe(1);
    expect(historyService.unavailable).toEqual(['10']);
    expect(result.totals.processed).toBe(0);
  });

  it('no marca el catalogo como no disponible cuando la tienda falla', async () => {
    steamProvider.ids = ['10', '20'];
    for (const id of ['10', '20']) {
      steamProvider.snapshots.set(id, snapshot(id, '29.99'));
      historyService.states.set(id, state(id));
    }
    // Fallo tecnico de la tienda (503) para todos los productos.
    steamProvider.failing.add('10');
    steamProvider.failing.add('20');

    const result = await service.runSync();

    expect(result.totals.unavailable).toBe(0);
    expect(historyService.unavailable).toEqual([]);
    expect(result.totals.errors).toBe(2);
  });

  it('aborta el ciclo de la tienda cuando los fallos tecnicos superan el umbral', async () => {
    steamProvider.ids = ['10', '20', '30'];
    for (const id of ['10', '20', '30']) {
      steamProvider.snapshots.set(id, snapshot(id, '29.99'));
      historyService.states.set(id, state(id));
    }
    // 2 de 2 fallos en el primer lote: 100% > 50% de umbral.
    steamProvider.failing.add('10');
    steamProvider.failing.add('20');

    const result = await service.runSync();

    // El ciclo se aborta: no se recorre la segunda pagina.
    expect(steamProvider.batches).toEqual([['10', '20']]);
    expect(result.totals.unavailable).toBe(0);
    expect(historyService.unavailable).toEqual([]);
  });

  it('omite la ejecucion si ya hay un ciclo en curso', async () => {
    const running = service.runSync();
    const second = await service.runSync();

    expect(second.skipped).toBe(true);
    expect(second.skipReason).toContain('en curso');
    await running;
  });

  it('omite la ejecucion si otra instancia mantiene el lock', async () => {
    dataSource.query = (sql: string, params?: unknown[]) => {
      dataSource.queries.push({ sql, params });
      return Promise.resolve([]);
    };

    const result = await service.runSync();

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Otra instancia');
  });

  it('aborta el ciclo si la consulta del lock falla', async () => {
    dataSource.query = (sql: string, params?: unknown[]) => {
      dataSource.queries.push({ sql, params });
      if (sql.includes('INSERT INTO price_sync_locks')) {
        return Promise.reject(new Error('la tabla de locks no existe'));
      }
      return Promise.resolve([]);
    };

    const result = await service.runSync();

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No se pudo tomar el lock');
    expect(result.totals.processed).toBe(0);
  });

  it('persiste el lote en una sola transaccion', async () => {
    steamProvider.ids = ['10', '20'];
    steamProvider.snapshots.set('10', snapshot('10', '29.99'));
    steamProvider.snapshots.set('20', snapshot('20', '9.99'));
    for (const id of ['10', '20']) {
      historyService.states.set(id, state(id));
    }

    const result = await service.runSync();

    expect(result.totals.processed).toBe(2);
    expect(result.totals.historyInserted).toBe(2);
    expect(historyService.batchCalls).toBe(1);
    expect(historyService.batchSizes).toEqual([2]);
  });

  it('libera el lock al terminar el ciclo', async () => {
    await service.runSync();

    const deletions = dataSource.queries.filter((q) =>
      q.sql.includes('DELETE FROM price_sync_locks'),
    );
    expect(deletions).toHaveLength(1);
  });

  it('libera el lock al apagarse el proceso con un ciclo en curso', async () => {
    const running = service.runSync();
    await service.onModuleDestroy();
    await running;

    const deletions = dataSource.queries.filter((q) =>
      q.sql.includes('DELETE FROM price_sync_locks'),
    );
    expect(deletions.length).toBeGreaterThanOrEqual(1);
  });

  it('limita el numero de productos cuando se indica maxProducts', async () => {
    steamProvider.ids = ['10', '20'];
    steamProvider.snapshots.set('10', snapshot('10', '29.99'));
    steamProvider.snapshots.set('20', snapshot('20', '9.99'));
    historyService.states.set('10', state('10'));

    const result = await service.runSync({ maxProducts: 1 });

    expect(result.totals.processed).toBe(1);
  });

  it('cuenta los productos intentados, no solo los persistidos, al limitar el ciclo', async () => {
    steamProvider.ids = ['10', '20', '30'];
    for (const id of ['10', '20', '30']) {
      steamProvider.snapshots.set(id, snapshot(id, '29.99'));
      historyService.states.set(id, state(id));
    }
    // El producto 10 falla: si el limite contara solo los persistidos, el
    // ciclo seguiria pidiendo paginas hasta acabar el catalogo.
    steamProvider.failing.add('10');

    const result = await service.runSync({ maxProducts: 2 });

    expect(steamProvider.batches).toEqual([['10', '20']]);
    expect(result.totals.processed).toBe(1);
    expect(result.totals.errors).toBe(1);
  });

  it('sincroniza el catalogo de IGDB con limit/offset encadenados', async () => {
    igdbService.configured = true;

    await service.runSync({ catalogPages: 3 });

    expect(igdbService.pages).toEqual([0, 50, 100]);
  });
});
