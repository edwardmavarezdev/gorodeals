import Fastify, { type FastifyInstance } from 'fastify';
import { extractBearerToken, registerAuthHook } from './auth.js';
import type { TokenService } from '../auth/token.service.js';

/**
 * Token de mentira: el hook solo necesita saber verificar y fallar.
 */
function fakeTokenService(options: {
  valid?: boolean;
  sub?: string;
}): TokenService {
  return {
    verifyAccessToken: (token: string) => {
      if (!options.valid || token !== 'token-valido') {
        return Promise.reject(new Error('token invalido'));
      }
      return Promise.resolve({
        sub: options.sub ?? 'usuario-1',
        email: 'a@b.c',
        jti: 'jti-1',
      });
    },
  } as unknown as TokenService;
}

/** Servidor minimo con el hook de autenticacion, sin base de datos. */
async function buildApp(tokenService: TokenService): Promise<FastifyInstance> {
  const fastify = Fastify();
  registerAuthHook(fastify, tokenService);

  fastify.get('/publico', { config: { auth: 'disabled' } }, () => ({
    ok: true,
  }));
  fastify.get('/protegido', () => ({ ok: true }));
  fastify.get('/opcional', { config: { auth: 'optional' } }, () => ({
    ok: true,
  }));

  await fastify.ready();
  return fastify;
}

describe('extractBearerToken', () => {
  it('devuelve el token de una cabecera Bearer', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
  });

  it('acepta el esquema en minusculas', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('devuelve null si el esquema no es Bearer', () => {
    expect(extractBearerToken('Basic abc')).toBeNull();
  });

  it('devuelve null si no hay cabecera', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });
});

describe('hook de autenticacion', () => {
  it('deja pasar las rutas publicas sin token', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({ method: 'GET', url: '/publico' });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('rechaza una ruta protegida sin token', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({ method: 'GET', url: '/protegido' });
    expect(response.statusCode).toBe(401);
    const body = response.json<{ message: string }>();
    expect(body.message).toBe('Credenciales invalidas');
    await app.close();
  });

  it('rechaza una ruta protegida con token invalido', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({
      method: 'GET',
      url: '/protegido',
      headers: { authorization: 'Bearer token-malo' },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('acepta una ruta protegida con token valido', async () => {
    const app = await buildApp(fakeTokenService({ valid: true }));
    const response = await app.inject({
      method: 'GET',
      url: '/protegido',
      headers: { authorization: 'Bearer token-valido' },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('deja pasar una ruta opcional sin token', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({ method: 'GET', url: '/opcional' });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('ignora un token invalido en una ruta opcional', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({
      method: 'GET',
      url: '/opcional',
      headers: { authorization: 'Bearer token-malo' },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('responde 404 y no 401 a una ruta inexistente', async () => {
    const app = await buildApp(fakeTokenService({}));
    const response = await app.inject({ method: 'GET', url: '/no-existe' });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
