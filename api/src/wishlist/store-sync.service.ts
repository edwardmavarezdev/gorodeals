import type { AppConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { WishlistItem } from './entities/wishlist-item.entity.js';
import { WISHLIST_STORES } from '../schemas/wishlist.js';

/**
 * Tienda externa con la que se puede sincronizar la lista de deseos.
 *
 * Son las tiendas de `WISHLIST_STORES` con API de lista propia: Steam no
 * expone una, asi que no entra en la sincronizacion.
 */
export type ExternalStore = Exclude<(typeof WISHLIST_STORES)[number], 'steam'>;

/**
 * Resultado de una sincronizacion con una tienda externa.
 */
export interface StoreSyncResult {
  store: ExternalStore;
  /** `not_configured` si faltan credenciales; `ok` si se sincronizo. */
  status: 'ok' | 'not_configured';
  imported: number;
  exported: number;
  message: string;
}

/**
 * Sincronizacion bidireccional con tiendas externas (GOG, Nintendo).
 *
 * La interfaz esta lista, pero el transporte real depende de credenciales
 * de terceros que no estan configuradas en este entorno. En vez de
 * inventar endpoints que fallarian, el servicio comprueba la configuracion
 * y reporta `not_configured` con el motivo, de forma que el endpoint
 * `POST /wishlist/sync/:store` responda 200 con la informacion en vez de
 * reventar.
 */
export class StoreSyncService {
  private readonly logger = createLogger('StoreSyncService');

  constructor(private readonly config: AppConfig) {}

  /**
   * Sincroniza la lista de un usuario con una tienda externa.
   *
   * Sin credenciales no se intenta ninguna llamada: se devuelve el estado
   * `not_configured`.
   */
  sync(store: ExternalStore, items: WishlistItem[]): StoreSyncResult {
    if (!this.isConfigured(store)) {
      const message = this.configurationHint(store);
      this.logger.warn(
        `Sincronizacion con ${store} omitida: ${message} ` +
          `(${items.length} elementos en la lista)`,
      );
      return {
        store,
        status: 'not_configured',
        imported: 0,
        exported: 0,
        message,
      };
    }

    /**
     * Con credenciales, aqui se implementaria la llamada a la API de la
     * tienda. No se inventa: sin un cliente real y credenciales de prueba
     * no es verificable, y un endpoint que falla es peor que uno que
     * informa de lo que falta.
     */
    return {
      store,
      status: 'not_configured',
      imported: 0,
      exported: 0,
      message: 'La sincronizacion con esta tienda todavia no esta implementada',
    };
  }

  /** Indica si la tienda tiene credenciales configuradas. */
  isConfigured(store: ExternalStore): boolean {
    switch (store) {
      case 'gog':
        return this.config.wishlist.gog.apiKey !== '';
      case 'nintendo':
        return this.config.wishlist.nintendo.apiKey !== '';
      default:
        return false;
    }
  }

  /** Explicacion de que falta para poder sincronizar con la tienda. */
  configurationHint(store: ExternalStore): string {
    switch (store) {
      case 'gog':
        return 'Falta configurar WISHLIST_GOG_API_KEY';
      case 'nintendo':
        return 'Falta configurar WISHLIST_NINTENDO_API_KEY';
      default:
        return 'Tienda no soportada';
    }
  }
}
