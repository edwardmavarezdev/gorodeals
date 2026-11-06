import { DataSource } from 'typeorm';
import { StoreName } from '../../store-products/entities/store-product.entity.js';
import {
  PriceHistoryService,
  StoreProductState,
} from './price-history.service.js';
import { StorePriceSnapshot } from '../sync.types.js';

interface Executed {
  sql: string;
  params?: unknown[];
}

/**
 * Doble de la base de datos que emula la semantica relevante del modulo:
 * una tabla `price_history` con la clave (store_product_id, recorded_at) y
 * la restriccion `ON CONFLICT DO NOTHING` que hace idempotente el alta diaria.
 *
 * Los asserts del spec se apoyan en ESTE doble (filas realmente insertadas,
 * parametros enviados), no en busquedas de texto dentro del SQL.
 */
class FakeDatabase {
  executed: Executed[] = [];
  /** Claves (store_product_id, recorded_at) ya presentes. */
  historyKeys = new Set<string>();
  /** Transacciones abiertas. */
  transactions = 0;
  /** Fila de `price_history` creada en la ultima sentencia de insert. */
  insertedRows: string[] = [];
  /** Todas las filas de historico creadas, en orden. */
  insertedHistory: string[] = [];
  /** El ultimo UPDATE de `store_products` recibio estos ids. */
  updatedIds: string[] = [];
  /** Historial de `price_history` por producto, para las consultas. */
  historyRows: Array<Record<string, unknown>> = [];

  private currentDay = '2026-11-03';

  query(sql: string, params?: unknown[]): Promise<unknown[]> {
    this.executed.push({ sql, params });

    if (sql.includes('UPDATE store_products')) {
      this.updatedIds = (params?.[0] as string[] | undefined) ?? [];
      return Promise.resolve([]);
    }

    if (sql.includes('FROM price_history')) {
      return Promise.resolve(this.historyRows);
    }

    return Promise.resolve([]);
  }

  async transaction<T>(
    work: (manager: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    }) => Promise<T>,
  ): Promise<T> {
    this.transactions += 1;
    const manager = {
      query: (sql: string, params?: unknown[]) => {
        this.executed.push({ sql, params });

        if (sql.includes('UPDATE store_products')) {
          this.updatedIds = (params?.[0] as string[] | undefined) ?? [];
          return Promise.resolve([]);
        }

        if (sql.includes('INSERT INTO price_history')) {
          return Promise.resolve(this.insertHistory(sql, params));
        }
        return Promise.resolve([]);
      },
    };
    return work(manager);
  }

  /**
   * Emula el `INSERT ... SELECT ... ON CONFLICT DO NOTHING`:
   * - solo se insertan las filas cuyo precio ha cambiado o que aun no
   *   tienen ninguna fila de historico (primera captura);
   * - la clave (producto, dia) no se puede repetir.
   */
  private insertHistory(sql: string, params?: unknown[]): unknown[] {
    const ids = (params?.[0] as string[] | undefined) ?? [];
    const changes = (params?.[5] as boolean[] | undefined) ?? [];
    const ignoresConflicts = sql.includes('ON CONFLICT');

    const inserted: unknown[] = [];
    ids.forEach((id, index) => {
      const firstCapture = !this.historyKeys.has(`any|${id}`);
      const changed = changes[index] === true;
      if (!changed && !firstCapture) {
        return;
      }
      const key = `${id}|${this.currentDay}`;
      if (ignoresConflicts && this.historyKeys.has(key)) {
        return;
      }
      this.historyKeys.add(key);
      this.historyKeys.add(`any|${id}`);
      inserted.push({ store_product_id: id });
    });

    this.insertedRows = inserted.map((row) =>
      String((row as Record<string, unknown>)['store_product_id']),
    );
    this.insertedHistory.push(...this.insertedRows);
    return inserted;
  }
}

const state: StoreProductState = {
  id: '11111111-1111-1111-1111-111111111111',
  storeProductId: '440',
  currentPrice: 59.99,
  regularPrice: 59.99,
  discountPercent: 0,
  currency: 'USD',
  isAvailable: true,
  historicalLowPrice: 49.99,
};

const snapshot: StorePriceSnapshot = {
  storeProductId: '440',
  currentPrice: '29.99',
  regularPrice: '59.99',
  discountPercent: '50.00',
  currency: 'USD',
  url: 'https://store.steampowered.com/app/440',
  isAvailable: true,
};

describe('PriceHistoryService', () => {
  let service: PriceHistoryService;
  let db: FakeDatabase;

  beforeEach(() => {
    db = new FakeDatabase();
    service = new PriceHistoryService(db as unknown as DataSource);
  });

  it('detecta la variacion de precio y la registra en el historico', async () => {
    const result = await service.persistSnapshot(state, snapshot);

    expect(result.changed).toBe(true);
    expect(result.historyInserted).toBe(true);
  });

  it('actualiza el estado persistido con el precio recibido', async () => {
    await service.persistSnapshot(state, snapshot);

    // El UPDATE del lote recibe el id del producto y sus precios.
    expect(db.updatedIds).toEqual([state.id]);
    const update = db.executed.find((q) =>
      q.sql.includes('UPDATE store_products'),
    );
    expect(update?.params?.[1]).toEqual(['29.99']);
    expect(update?.params?.[2]).toEqual(['59.99']);
    expect(update?.params?.[4]).toEqual(['USD']);
  });

  it('registra la primera captura aunque el precio no haya cambiado', async () => {
    const same = { ...snapshot, currentPrice: '59.99' };

    const result = await service.persistSnapshot(state, same);

    expect(result.changed).toBe(false);
    // Sin historico previo, la primera captura si se registra.
    expect(result.historyInserted).toBe(true);
    expect(db.insertedRows).toEqual([state.id]);
  });

  it('no registra historico cuando el precio no ha cambiado y ya hay captura', async () => {
    // El estado persistido ya tiene el precio actual: no hay variacion.
    const sameState: StoreProductState = {
      ...state,
      currentPrice: 29.99,
      regularPrice: 59.99,
      discountPercent: 50,
    };
    const same = { ...snapshot, currentPrice: '29.99' };

    // Primera captura: se registra.
    const first = await service.persistSnapshot(sameState, same);
    expect(first.changed).toBe(false);
    expect(first.historyInserted).toBe(true);

    // Segunda pasada del mismo dia: ya hay fila para (producto, dia).
    const second = await service.persistSnapshot(sameState, same);
    expect(second.changed).toBe(false);
    expect(second.historyInserted).toBe(false);
    expect(db.insertedHistory).toEqual([state.id]);
  });

  it('no duplica el historico cuando se repite el sync el mismo dia', async () => {
    const first = await service.persistSnapshot(state, snapshot);
    const second = await service.persistSnapshot(state, snapshot);

    expect(first.historyInserted).toBe(true);
    // La segunda pasada del mismo dia choca con la clave (producto, dia).
    expect(second.historyInserted).toBe(false);
    expect(db.insertedHistory).toEqual([state.id]);
  });

  it('persiste un lote con una sola transaccion', async () => {
    const secondState: StoreProductState = {
      ...state,
      id: '22222222-2222-2222-2222-222222222222',
      storeProductId: '570',
    };
    const secondSnapshot: StorePriceSnapshot = {
      ...snapshot,
      storeProductId: '570',
      currentPrice: '9.99',
    };

    const results = await service.persistBatch([
      { state, snapshot },
      { state: secondState, snapshot: secondSnapshot },
    ]);

    expect(results.get('440')).toEqual({
      changed: true,
      historyInserted: true,
    });
    expect(results.get('570')).toEqual({
      changed: true,
      historyInserted: true,
    });

    // Una transaccion y un unnest para todo el lote: los dos productos van
    // en las mismas matrices de parametros.
    expect(db.transactions).toBe(1);
    expect(db.updatedIds).toEqual([state.id, secondState.id]);
    expect(db.insertedRows).toEqual([state.id, secondState.id]);
  });

  it('recupera el estado de las ofertas de un lote con una sola consulta', async () => {
    await service.findStoreProductStates(StoreName.STEAM, ['440', '570']);

    expect(db.executed).toHaveLength(1);
    expect(db.executed[0].params?.[0]).toBe(StoreName.STEAM);
    expect(db.executed[0].params?.[1]).toEqual(['440', '570']);
  });

  it('limita el historico a la ventana temporal configurada', async () => {
    await service.findHistory(state.id, 12, 365);

    expect(db.executed).toHaveLength(1);
    expect(db.executed[0].params).toEqual([state.id, 12, 365]);
  });

  it('marca la oferta como no disponible sin tocar los precios', async () => {
    await service.markUnavailable(state);

    const update = db.executed[0];
    expect(update.params).toEqual([state.id]);
    // Solo se actualiza la disponibilidad: el historico no se toca.
    expect(db.executed.some((q) => q.sql.includes('price_history'))).toBe(
      false,
    );
  });
});
