import Fastify from 'fastify';
import { NotFoundException } from '../errors.js';
import { registerErrorHandler } from './error.js';

/**
 * Manejador global de errores: traduce excepciones al cuerpo
 * `{ statusCode, message, error }` que espera el frontend.
 */
describe('manejador global de errores', () => {
  it('traduce una excepcion HTTP a su codigo', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get('/no-existe', () => {
      throw new NotFoundException('El juego no existe');
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/no-existe' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      statusCode: 404,
      message: 'El juego no existe',
      error: 'Not Found',
    });
    await app.close();
  });

  it('devuelve una lista de mensajes cuando falla la validacion', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.post(
      '/dato',
      {
        schema: {
          body: {
            type: 'object',
            required: ['nombre'],
            properties: { nombre: { type: 'string' } },
          },
        },
      },
      () => ({ ok: true }),
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/dato',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    const body = response.json<{ message: string[]; error: string }>();
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.error).toBe('Bad Request');
    await app.close();
  });

  it('no filtra el detalle interno de un error inesperado', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get('/falla', () => {
      throw new Error('detalle interno que no debe salir');
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/falla' });
    expect(response.statusCode).toBe(500);
    expect(response.json<{ message: string }>().message).toBe(
      'Error interno del servidor',
    );
    await app.close();
  });
});
