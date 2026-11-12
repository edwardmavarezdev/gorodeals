import Fastify, { type FastifyInstance } from 'fastify';
import { requireAdminSecret, safeEquals } from './admin.js';

describe('safeEquals', () => {
  it('acepta cadenas iguales', () => {
    expect(safeEquals('secreto', 'secreto')).toBe(true);
  });

  it('rechaza cadenas distintas', () => {
    expect(safeEquals('secreto', 'secreto2')).toBe(false);
  });

  it('rechaza longitudes distintas sin lanzar', () => {
    expect(safeEquals('corto', 'muchisimolargodeverdad')).toBe(false);
  });
});

describe('hook de administracion', () => {
  async function buildApp(secret: string): Promise<FastifyInstance> {
    const app = Fastify();
    app.post(
      '/sync',
      { preValidation: requireAdminSecret(secret, 'X_SECRET') },
      () => ({
        ok: true,
      }),
    );
    await app.ready();
    return app;
  }

  it('deja pasar la peticion con el secreto correcto', async () => {
    const app = await buildApp('secreto');
    const response = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: { 'x-admin-secret': 'secreto' },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('rechaza un secreto incorrecto', async () => {
    const app = await buildApp('secreto');
    const response = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: { 'x-admin-secret': 'otro' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('rechaza la peticion si no hay secreto configurado', async () => {
    const app = await buildApp('');
    const response = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: { 'x-admin-secret': 'lo-que-sea' },
    });
    expect(response.statusCode).toBe(403);
    const body = response.json<{ message: string }>();
    expect(body.message).toContain('no esta configurado');
    await app.close();
  });
});
