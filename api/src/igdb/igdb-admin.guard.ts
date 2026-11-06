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
 * Protege los endpoints de sincronizacion con un secreto de administrador.
 * Si `IGDB_ADMIN_SECRET` no esta configurado, el endpoint queda cerrado.
 */
@Injectable()
export class IgdbAdminGuard implements CanActivate {
  private readonly logger = new Logger(IgdbAdminGuard.name);
  private readonly adminSecret: string;

  constructor(config: ConfigService) {
    this.adminSecret = config.get<string>('igdb.adminSecret') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.adminSecret) {
      this.logger.warn(
        'Endpoint de sincronizacion bloqueado: IGDB_ADMIN_SECRET no esta configurado',
      );
      throw new ForbiddenException(
        'Sincronizacion deshabilitada: IGDB_ADMIN_SECRET no esta configurado',
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
