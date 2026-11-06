import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SteamAdminGuard } from './steam-admin.guard.js';

function contextWithHeader(value?: string): ExecutionContext {
  const request = {
    headers: value === undefined ? {} : { 'x-admin-secret': value },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardWithSecret(secret: string): SteamAdminGuard {
  const config = {
    get: (key: string) => (key === 'steam.adminSecret' ? secret : undefined),
  } as unknown as ConfigService;
  return new SteamAdminGuard(config);
}

describe('SteamAdminGuard', () => {
  it('permite el paso con el secreto correcto', () => {
    const guard = guardWithSecret('secreto');

    expect(guard.canActivate(contextWithHeader('secreto'))).toBe(true);
  });

  it('rechaza un secreto incorrecto', () => {
    const guard = guardWithSecret('secreto');

    expect(() => guard.canActivate(contextWithHeader('otro'))).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza la peticion sin cabecera', () => {
    const guard = guardWithSecret('secreto');

    expect(() => guard.canActivate(contextWithHeader())).toThrow(
      ForbiddenException,
    );
  });

  it('cierra el endpoint si no hay secreto configurado', () => {
    const guard = guardWithSecret('');

    expect(() => guard.canActivate(contextWithHeader('secreto'))).toThrow(
      ForbiddenException,
    );
  });
});
