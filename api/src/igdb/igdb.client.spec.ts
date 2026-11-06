import { ConfigService } from '@nestjs/config';
import { IgdbClient } from './igdb.client.js';
import { IgdbRateLimitError } from './igdb.errors.js';

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'igdb.clientId': 'client-id',
    'igdb.clientSecret': 'client-secret',
    'igdb.tokenUrl': 'https://id.twitch.tv/oauth2/token',
    'igdb.apiUrl': 'https://api.igdb.com/v4/games',
    'igdb.timeoutMs': 5000,
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function jsonResponse(
  body: unknown,
  init?: { status?: number; retryAfter?: string },
): Response {
  return {
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'retry-after'
          ? (init?.retryAfter ?? null)
          : null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

/**
 * Cliente de prueba: se anula la espera real (`sleep`) para poder medir el
 * espaciado entre peticiones sin depender del reloj.
 */
class TestableIgdbClient extends IgdbClient {
  sleeps: number[] = [];

  protected override sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    return Promise.resolve();
  }
}

describe('IgdbClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('obtiene el token y consulta la API con la cabecera de autorizacion', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2/token')) {
        return Promise.resolve(
          jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const client = new TestableIgdbClient(buildConfig());
    await client.query('fields id;');

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('oauth2/token');
    expect(calls[1].url).toContain('api.igdb.com');
    const headers = calls[1].init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token-1');
  });

  it('aplica timeout a todas las peticiones, incluida la del token', async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return Promise.resolve(
        jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
      );
    });

    const client = new TestableIgdbClient(buildConfig());
    await client.getAccessToken();

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it('espacia tambien los reintentos, no solo la primera peticion', async () => {
    const stamps: number[] = [];
    global.fetch = jest.fn(() => {
      stamps.push(Date.now());
      if (stamps.length === 1) {
        // El token va bien; la primera consulta a la API falla con 429.
        return Promise.resolve(
          jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
        );
      }
      if (stamps.length === 2) {
        return Promise.resolve(
          jsonResponse({ error: 'rate limited' }, { status: 429 }),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const client = new TestableIgdbClient(buildConfig());
    await client.query('fields id;');

    // Tres peticiones (token, consulta, reintento): el espaciado global se
    // aplica a todas, no solo a la primera.
    expect(stamps).toHaveLength(3);
    // Entre la primera peticion de la API y el reintento hay una espera.
    const waits = client.sleeps.filter((ms) => ms > 0);
    expect(waits.length).toBeGreaterThanOrEqual(2);
  });

  it('espera el Retry-After una sola vez por reintento', async () => {
    let attempts = 0;
    global.fetch = jest.fn(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
        );
      }
      if (attempts === 2) {
        return Promise.resolve(
          jsonResponse(
            { error: 'rate limited' },
            { status: 429, retryAfter: '2' },
          ),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const client = new TestableIgdbClient(buildConfig());
    await client.query('fields id;');

    // El Retry-After (2000 ms) se espera UNA vez: ni en la rama del 429 ni
    // despues en el backoff.
    const retryAfterWaits = client.sleeps.filter((ms) => ms === 2000);
    expect(retryAfterWaits).toHaveLength(1);
  });

  it('lanza un error de rate limit cuando se agotan los reintentos', async () => {
    let attempts = 0;
    global.fetch = jest.fn(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
        );
      }
      return Promise.resolve(
        jsonResponse({ error: 'rate limited' }, { status: 429 }),
      );
    });

    const client = new TestableIgdbClient(buildConfig());

    await expect(client.query('fields id;')).rejects.toBeInstanceOf(
      IgdbRateLimitError,
    );
  });
});
