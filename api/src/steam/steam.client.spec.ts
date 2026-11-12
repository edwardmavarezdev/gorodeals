import type { AppConfig } from '../config.js';
import { SteamClient } from './steam.client.js';
import { SteamInvalidResponseError } from './steam.errors.js';

/**
 * Configuracion de pruebas: solo la rama `steam` del arbol, con los valores
 * por defecto que usa el cliente mas los ajustes de cada caso.
 */
function buildConfig(overrides: Partial<AppConfig['steam']> = {}): AppConfig {
  return {
    steam: {
      baseUrl: 'https://store.steampowered.com/api',
      countryCode: 'us',
      language: 'es',
      timeoutMs: 1000,
      maxRetries: 1,
      cacheTtlMs: 60_000,
      cacheMaxEntries: 3,
      batchSize: 50,
      concurrency: 2,
      interBatchDelayMs: 0,
      ...overrides,
    },
  } as unknown as AppConfig;
}

/** Respuesta falsa de `fetch`, con la forma que consume el cliente. */
function fakeResponse(body: string, init?: Partial<Response>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('SteamClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('cachea la respuesta del appid y no repite la peticion', async () => {
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      return Promise.resolve(
        fakeResponse(
          JSON.stringify({ '440': { success: true, data: { name: 'CS' } } }),
        ),
      );
    });

    const client = new SteamClient(buildConfig());

    const first = await client.fetchAppDetails(440);
    const second = await client.fetchAppDetails(440);

    expect(first?.name).toBe('CS');
    expect(second?.name).toBe('CS');
    expect(calls).toBe(1);
  });

  it('no pide el lote por coma a Steam: usa appid a appid', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn((url: string) => {
      urls.push(url);
      const appId = new URL(url).searchParams.get('appids');
      return Promise.resolve(
        fakeResponse(
          JSON.stringify({
            [appId ?? '']: { success: true, data: { name: 'X' } },
          }),
        ),
      );
    });

    const client = new SteamClient(buildConfig());
    const result = await client.fetchAppDetailsBatch([440, 570]);

    expect(result.size).toBe(2);
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url).not.toContain('440,570');
    }
  });

  it('vuelve a pedir el appid cuando el TTL de la cache es cero', async () => {
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      return Promise.resolve(
        fakeResponse(
          JSON.stringify({ '440': { success: true, data: { name: 'CS' } } }),
        ),
      );
    });

    const client = new SteamClient(buildConfig({ cacheTtlMs: 0 }));

    await client.fetchAppDetails(440);
    await client.fetchAppDetails(440);

    // Con TTL 0 la cache esta deshabilitada: se pide siempre.
    expect(calls).toBe(2);
  });

  it('lanza un error de parseo tipado cuando el cuerpo no es JSON', async () => {
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      return Promise.resolve(fakeResponse('<html>no soy json</html>'));
    });

    const client = new SteamClient(buildConfig({ maxRetries: 3 }));

    await expect(client.fetchAppDetails(440)).rejects.toBeInstanceOf(
      SteamInvalidResponseError,
    );
    // Un fallo de contrato no se reintenta: el cuerpo volveria a ser invalido.
    expect(calls).toBe(1);
  });
});
