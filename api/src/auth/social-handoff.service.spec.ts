import type { Static } from '@sinclair/typebox';
import { AuthResponse } from '../schemas/auth.js';
import { SocialHandoffService } from './social-handoff.service.js';

function buildResponse(): Static<typeof AuthResponse> {
  return {
    accessToken: 'access-token-placeholder',
    refreshToken: 'refresh-token-placeholder',
    expiresIn: 900,
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'ana@example.com',
      displayName: 'Ana',
      avatarUrl: null,
      providers: ['google'],
    },
  };
}

describe('SocialHandoffService', () => {
  let service: SocialHandoffService;

  beforeEach(() => {
    service = new SocialHandoffService();
  });

  it('devuelve la sesion asociada al codigo', () => {
    const response = buildResponse();
    const code = service.create(response);

    expect(code).toHaveLength(43);
    expect(service.consume(code)).toEqual(response);
  });

  it('el codigo es de un solo uso', () => {
    const code = service.create(buildResponse());

    expect(service.consume(code)).not.toBeNull();
    expect(service.consume(code)).toBeNull();
  });

  it('rechaza un codigo desconocido', () => {
    expect(service.consume('codigo-inexistente')).toBeNull();
  });

  it('emite un codigo distinto en cada traspaso', () => {
    const first = service.create(buildResponse());
    const second = service.create(buildResponse());

    expect(first).not.toBe(second);
  });
});
