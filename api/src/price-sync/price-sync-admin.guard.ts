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
 * Protege el endpoint de sincronizacion manual con un secreto de
 * administrador. Sigue el mismo patron que `IgdbAdminGuard`: comparacion en
 * tiempo constante y endpoint cerrado si el secreto no esta configurado.
 */
@Injectable()
export class PriceSyncAdminGuard implements CanActivate {
  private readonly logger = new Logger(PriceSyncAdminGuard.name);
  private readonly adminSecret: string;

  constructor(config: ConfigService) {
    this.adminSecret = config.get<string>('priceSync.adminSecret') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.adminSecret) {
      this.logger.warn(
        'Endpoint de sincronizacion bloqueado: PRICE_SYNC_ADMIN_SECRET no esta configurado',
      );
      throw new ForbiddenException(
        'Sincronizacion deshabilitada: PRICE_SYNC_ADMIN_SECRET no esta configurado',
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
