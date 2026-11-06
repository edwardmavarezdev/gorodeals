import { StoreName } from '../store-products/entities/store-product.entity.js';

/**
 * Pagina de resultado con cursor opaco. El cursor permite recorrer el
 * catalogo sin `OFFSET` (que degrada con volumen) y sin cargar el catalogo
 * completo en memoria.
 */
export interface Page<T> {
  items: T[];
  cursor?: string;
}

/**
 * Snapshot de precio publicado por una tienda para un producto concreto.
 * Los importes se transportan como `string` para no perder precision al
 * serializar entre capas.
 */
export interface StorePriceSnapshot {
  storeProductId: string;
  currentPrice: string;
  regularPrice: string;
  discountPercent: string;
  currency: string;
  url: string;
  isAvailable: boolean;
}

/**
 * Resultado de consultar el precio de UN producto en una tienda.
 *
 * Distingue tres situaciones que antes se confundian en un unico `null`:
 * - `ok`: la tienda publica precio.
 * - `unavailable`: la tienda responde correctamente pero NO publica datos
 *   para ese producto (appid inexistente, juego gratis, sin precio en la
 *   region). Solo este caso marca el producto como no disponible.
 * - `error`: fallo TECNICO (tienda caida, 403 por abuso, sin red, timeout).
 *   No marca el producto como no disponible: la disponibilidad que ya
 *   constaba en la base de datos se mantiene intacta.
 */
export type StorePriceResult =
  | { storeProductId: string; status: 'ok'; snapshot: StorePriceSnapshot }
  | { storeProductId: string; status: 'unavailable' }
  | { storeProductId: string; status: 'error'; error: Error };

/**
 * Contrato de proveedor de precios de una tienda.
 *
 * El orquestador (`PriceSyncService`) no conoce el detalle de ninguna tienda:
 * solo consume este contrato. Anadir GOG o Nintendo consiste en implementar
 * la interfaz y registrarla como proveedor, sin tocar el orquestador.
 */
export interface StorePriceProvider {
  readonly storeName: StoreName;

  /**
   * Devuelve el resultado de consultar el precio de los productos indicados.
   * Un resultado por producto, siempre en el mismo orden de entrada.
   */
  fetchPrices(storeProductIds: string[]): Promise<StorePriceResult[]>;

  /**
   * Devuelve los identificadores de producto de la tienda a sincronizar,
   * paginados por cursor.
   */
  listStoreProductIds(
    batchSize: number,
    cursor?: string,
  ): Promise<Page<string>>;
}

/** Resultado del recorrido de una tienda. */
export interface StoreSyncResult {
  storeName: string;
  processed: number;
  updated: number;
  changed: number;
  unchanged: number;
  unavailable: number;
  historyInserted: number;
  errors: number;
  durationMs: number;
}
