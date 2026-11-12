import { buildServer } from '../src/server.js';

/**
 * Pruebas de extremo a extremo de la API.
 *
 * Se usa `fastify.inject()` en lugar de abrir un puerto: la instancia es
 * exactamente la que se despliega (`buildServer()`), asi que lo que se
 * prueba y lo que corre no pueden divergir.
 */
describe('API GoRoDeals (e2e)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde el estado de la base de datos', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      status: string;
      database: string;
      timestamp: string;
    }>();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /catalog devuelve la pagina de juegos', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/catalog?page=1&limit=5',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: unknown[]; page: number }>();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.page).toBe(1);
  });

  it('rechaza un parametro de consulta desconocido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/catalog?parametro-inexistente=1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('exige token en las rutas privadas', async () => {
    const response = await app.inject({ method: 'GET', url: '/wishlist' });

    expect(response.statusCode).toBe(401);
  });

  it('registra una cuenta, inicia sesion y devuelve el perfil', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'Contrasena1!';

    const registration = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password, displayName: 'E2E' },
    });
    expect(registration.statusCode).toBe(201);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const { accessToken } = login.json<{ accessToken: string }>();
    expect(typeof accessToken).toBe('string');

    const profile = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json<{ email: string }>().email).toBe(email);
  });

  it('devuelve 404 con el cuerpo esperado en una ruta inexistente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/no-existe',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: string }>().error).toBe('Not Found');
  });
});
