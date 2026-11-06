import { TtlLruCache } from './steam-cache.js';

describe('TtlLruCache', () => {
  let now = 1_000;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000;
  });

  it('devuelve el valor cacheado mientras no caduque', () => {
    const cache = new TtlLruCache<string>(1000, 10, clock);
    cache.set('a', 'valor');

    expect(cache.get('a')).toBe('valor');
    expect(cache.size).toBe(1);
  });

  it('descarta la entrada cuando el TTL ha expirado', () => {
    const cache = new TtlLruCache<string>(1000, 10, clock);
    cache.set('a', 'valor');

    now += 1001;

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('expulsa la entrada menos recientemente usada al superar el tope', () => {
    const cache = new TtlLruCache<string>(1000, 2, clock);
    cache.set('a', '1');
    cache.set('b', '2');
    // `a` pasa a ser la mas recientemente usada.
    expect(cache.get('a')).toBe('1');

    cache.set('c', '3');

    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });

  it('purga las entradas vencidas al insertar', () => {
    const cache = new TtlLruCache<string>(1000, 10, clock);
    cache.set('a', '1');
    now += 1001;
    cache.set('b', '2');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it('no crece por encima del tope con muchas entradas', () => {
    const cache = new TtlLruCache<number>(1000, 100, clock);
    for (let i = 0; i < 5000; i += 1) {
      cache.set(`k${i}`, i);
    }

    expect(cache.size).toBe(100);
  });

  it('queda deshabilitada con TTL o tope cero', () => {
    const cache = new TtlLruCache<string>(0, 10, clock);
    cache.set('a', 'valor');

    expect(cache.enabled).toBe(false);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
