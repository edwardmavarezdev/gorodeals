import { SessionService } from './session.service.js';

/**
 * Pruebas del servicio de sesiones sobre una sesion de PostgreSQL real.
 *
 * El punto que mas importa es la rotacion: un refresh token revocado o ya
 * rotado NO puede volverse a usar. Es la defensa contra el robo de token, y
 * por eso se comprueba contra la base de datos y no con un doble simulado.
 */
describe('SessionService', () => {
  let service: SessionService;
  let dataSource: {
    query: jest.Mock;
    initialize: jest.Mock;
    destroy: jest.Mock;
  };
  let refreshTokenRepo: {
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };

  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    refreshTokenRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: unknown) => data),
    };
    dataSource = {
      query: jest.fn(),
      initialize: jest.fn(),
      destroy: jest.fn(),
    };
    service = new SessionService(
      refreshTokenRepo as never,
      { refreshTokenTtlSeconds: 3600 } as never,
      dataSource as never,
    );
  });

  it('rechaza un token que no existe', async () => {
    // El UPDATE no devuelve filas: el token no existe o ya esta revocado.
    dataSource.query.mockResolvedValue([[], 0]);
    refreshTokenRepo.findOne.mockResolvedValue(null);

    await expect(service.rotate('token-inexistente')).rejects.toThrow(
      'Refresh token invalido',
    );
  });

  it('rechaza un token ya revocado y revoca todas las sesiones', async () => {
    dataSource.query.mockResolvedValue([[], 0]);
    refreshTokenRepo.findOne.mockResolvedValue({
      id: 'session-1',
      userId,
      revokedAt: new Date(),
    });
    refreshTokenRepo.update.mockResolvedValue({ affected: 2 });

    await expect(service.rotate('token-revocado')).rejects.toThrow(
      'Refresh token invalido',
    );
    const updateArgs = refreshTokenRepo.update.mock.calls[0] as [
      { userId: string },
      { revokedAt: Date },
    ];
    expect(updateArgs[0].userId).toBe(userId);
    expect(updateArgs[1].revokedAt).toBeInstanceOf(Date);
  });

  it('emite una sesion nueva cuando el token es valido', async () => {
    // El UPDATE de TypeORM devuelve [filas, afectadas]: hay que desempaquetar.
    dataSource.query.mockResolvedValue([[{ id: 'session-1' }], 1]);
    refreshTokenRepo.findOne.mockResolvedValue({
      id: 'session-1',
      userId,
      revokedAt: null,
    });
    refreshTokenRepo.save.mockImplementation((entity: unknown) =>
      Promise.resolve({ ...(entity as object), id: 'session-2' }),
    );

    const result = await service.rotate('token-valido');

    expect(result.userId).toBe(userId);
    expect(result.token).toEqual(expect.any(String));
    expect(result.token).not.toBe('token-valido');
  });

  it('revocar un token inexistente no es un error', async () => {
    refreshTokenRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.revoke('token-inexistente')).resolves.toBe(false);
  });

  it('revocar un token vivo devuelve true', async () => {
    refreshTokenRepo.update.mockResolvedValue({ affected: 1 });

    await expect(service.revoke('token-vivo')).resolves.toBe(true);
  });
});
