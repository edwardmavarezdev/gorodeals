/**
 * Cache en memoria con TTL y eviction LRU.
 *
 * Se usa para la respuesta de la API de Steam: son datos JSON relativamente
 * voluminosos (~1,7 KB por appid medio), por lo que un `Map` plano sin tope
 * acababa en OOM con catalogos grandes (100k appids ~ 174 MB).
 *
 * Politica:
 * - TTL por entrada: al leer, una entrada vencida se descarta y cuenta como
 *   fallo de cache (se vuelve a pedir a la API).
 * - LRU por capacidad: al insertar con el cache lleno, se expulsa la entrada
 *   menos recientemente usada.
 * - Purga de entradas vencidas: se ejecuta de forma oportunista al insertar,
 *   para que las entradas caducadas no ocupen memoria ni evitan el uso de la
 *   cache.
 */
export class TtlLruCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  /**
   * @param ttlMs Duracion de vida de cada entrada. `0` desactiva la cache.
   * @param maxEntries Numero maximo de entradas vivas. `0` desactiva la cache.
   */
  constructor(ttlMs: number, maxEntries: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  /** Indica si la cache esta operativa (TTL y capacidad positivos). */
  get enabled(): boolean {
    return this.ttlMs > 0 && this.maxEntries > 0;
  }

  /** Numero de entradas almacenadas (incluidas las vencidas sin purgar). */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Devuelve el valor cacheado o `undefined` si no hay entrada vigente.
   * Una entrada vencida se elimina al detectarla.
   */
  get(key: string): T | undefined {
    if (!this.enabled) {
      return undefined;
    }
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU: se refresca el uso para que sea la candidata a expulsion.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Guarda un valor con el TTL vigente, expulsando entradas si hace falta. */
  set(key: string, value: T): void {
    if (!this.enabled) {
      return;
    }
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    this.purgeExpired();
    this.evictIfNeeded();
  }

  /** Elimina una entrada concreta. */
  delete(key: string): void {
    this.entries.delete(key);
  }

  /** Vacia el cache. */
  clear(): void {
    this.entries.clear();
  }

  /** Elimina las entradas ya vencidas. */
  purgeExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Expulsa las entradas menos recientes hasta quedar por debajo del tope. */
  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) {
        return;
      }
      this.entries.delete(oldest.value);
    }
  }
}
