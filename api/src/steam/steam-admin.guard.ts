import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const ADMIN_SECRET_HEADER = 'x-admin-secret';

/**
 * Protege el endpoint `POST /steam/sync` con un secreto de administrador.
 *
 * Sigue el mismo patron que `PriceSyncAdminGuard` e `IgdbAdminGuard`:
 * comparacion en tiempo constante y endpoint cerrado si el secreto no esta
 * configurado. El secreto se lee de `steam.adminSecret`, que resuelve
 * `STEAM_ADMIN_SECRET` y, si no existe, `IGDB_ADMIN_SECRET`.
 */
@Injectable()
export class SteamAdminGuard implements CanActivate {
  private readonly logger = new Logger(SteamAdminGuard.name);
  private readonly adminSecret: string;

  constructor(config: ConfigService) {
    this.adminSecret = config.get<string>('steam.adminSecret') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.adminSecret) {
      this.logger.warn(
        'Endpoint de sincronizacion de Steam bloqueado: STEAM_ADMIN_SECRET no esta configurado',
      );
      throw new ForbiddenException(
        'Sincronizacion deshabilitada: STEAM_ADMIN_SECRET no esta configurado',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[ADMIN_SECRET_HEADER];
    const provided = Array.isArray(header) ? header[0] : header;

    if (!provided || !this.safeEquals(provided, this.adminSecret)) {
      throw new ForbiddenException('Secreto de administrador invalido');
    }

    return true;
  }

  private safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    return timingSafeEqual(bufferA, bufferB);
  }
}
