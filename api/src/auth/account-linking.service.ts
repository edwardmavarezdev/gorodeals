import { ConflictException, UnauthorizedException } from '../errors.js';
import { createLogger } from '../logger.js';
import { UsersService } from '../users/users.service.js';
import { SocialProvider } from '../users/entities/social-account.entity.js';
import { PasswordService } from './password.service.js';
import { PendingLinkService } from './pending-link.service.js';

/**
 * Datos de una identidad social lista para vincular.
 */
export interface SocialIdentityInput {
  provider: SocialProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  nickname: string | null;
  avatarUrl: string | null;
}

/**
 * Resultado de resolver una identidad social.
 *
 * - `linked`: la identidad ya estaba vinculada a un usuario; se inicia
 *   sesion con el.
 * - `created`: la identidad es nueva y se ha creado un usuario para ella.
 * - `linkRequired`: el email de la identidad coincide con el de un usuario
 *   local. No se vincula automaticamente: la coincidencia de email no prueba
 *   que las dos cuentas sean la misma. Se devuelve un token de un solo uso
 *   para que el titular de la cuenta local demuestre su contrasena.
 */
export type SocialLoginResolution =
  | { status: 'linked' | 'created'; userId: string }
  | { status: 'linkRequired'; linkToken: string; email: string };

/**
 * Resolucion de identidades sociales y vinculacion de cuentas.
 *
 * La identidad de un proveedor es su identificador (`sub` de Google,
 * SteamID64 de Steam), nunca el email. El email solo se usa para detectar
 * el caso "esta cuenta ya existe en local" y pedir autenticacion previa.
 */
export class AccountLinkingService {
  private readonly logger = createLogger('AccountLinkingService');

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly pendingLinkService: PendingLinkService,
  ) {}

  /**
   * Resuelve una identidad social a un usuario local, creando el usuario si
   * hace falta.
   */
  async resolve(identity: SocialIdentityInput): Promise<SocialLoginResolution> {
    const existing = await this.usersService.findBySocialAccount(
      identity.provider,
      identity.providerAccountId,
    );
    if (existing) {
      return { status: 'linked', userId: existing.userId };
    }

    if (identity.email && identity.emailVerified) {
      const localUser = await this.usersService.findByEmail(identity.email);
      if (localUser) {
        /**
         * La identidad social es nueva y su email verificado coincide con
         * una cuenta local. No se vincula sin mas: se emite un token de
         * un solo uso y el titular tiene que confirmar su contrasena.
         */
        const pending = this.pendingLinkService.create({
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
          nickname: identity.nickname,
          avatarUrl: identity.avatarUrl,
          email: identity.email,
        });
        return {
          status: 'linkRequired',
          linkToken: pending.token,
          email: identity.email,
        };
      }
    }

    const user = await this.createUserForIdentity(identity);
    return { status: 'created', userId: user.id };
  }

  /**
   * Confirma una vinculacion pendiente con la contrasena de la cuenta
   * local. Devuelve el id del usuario ya vinculado.
   */
  async confirmLink(linkToken: string, password: string): Promise<string> {
    const pending = this.pendingLinkService.consume(linkToken);
    if (!pending) {
      throw new UnauthorizedException('El enlace de vinculacion no es valido');
    }

    const user = pending.email
      ? await this.usersService.findByEmail(pending.email)
      : null;
    if (!user) {
      throw new UnauthorizedException('El enlace de vinculacion no es valido');
    }

    if (!user.passwordHash) {
      /**
       * La cuenta local no tiene contrasena (solo social). En ese caso no
       * se puede demostrar la titularidad con este flujo: se rechaza.
       */
      throw new UnauthorizedException('El enlace de vinculacion no es valido');
    }

    const valid = await this.passwordService.verify(
      user.passwordHash,
      password,
    );
    if (!valid) {
      throw new UnauthorizedException('El enlace de vinculacion no es valido');
    }

    const linked = await this.usersService.linkSocialAccount(
      user.id,
      pending.provider as SocialProvider,
      pending.providerAccountId,
      { nickname: pending.nickname, avatarUrl: pending.avatarUrl },
    );
    if (!linked) {
      throw new AccountLinkingRequiredError(
        'Esa identidad social ya esta vinculada a otra cuenta',
      );
    }

    return user.id;
  }

  /**
   * Crea un usuario para una identidad social que no existe todavia.
   *
   * Steam no publica email, asi que se genera uno sintetico del dominio
   * reservado `users.gorodeals.local`. Google si publica email, pero solo
   * se usa si viene verificado; si no, tambien se genera uno sintetico.
   */
  private async createUserForIdentity(
    identity: SocialIdentityInput,
  ): Promise<{ id: string }> {
    const useRealEmail = identity.email !== null && identity.emailVerified;
    const email = useRealEmail
      ? (identity.email as string)
      : syntheticEmail(identity.provider, identity.providerAccountId);

    const displayName =
      identity.nickname?.trim() || defaultDisplayName(identity.provider);

    const user = await this.usersService.createUser({
      email,
      passwordHash: null,
      displayName,
      emailVerifiedAt: new Date(),
      isActive: true,
    });

    await this.usersService.linkSocialAccount(
      user.id,
      identity.provider,
      identity.providerAccountId,
      { nickname: identity.nickname, avatarUrl: identity.avatarUrl },
    );

    return user;
  }
}

/**
 * Email sintetico para identidades sociales sin email real (Steam) o con
 * email sin verificar (Google). El dominio reservado los hace
 * reconocibles y no son direcciones entregables.
 */
export function syntheticEmail(
  provider: SocialProvider,
  providerAccountId: string,
): string {
  const safeId = providerAccountId.replace(/[^A-Za-z0-9]/g, '');
  return `${provider}_${safeId}@users.gorodeals.local`;
}

/** Nombre mostrado por defecto cuando el proveedor no publica ninguno. */
export function defaultDisplayName(provider: SocialProvider): string {
  return provider === SocialProvider.STEAM ? 'Jugador de Steam' : 'Jugador';
}

/**
 * La identidad social ya esta vinculada a otra cuenta. 409.
 */
export class AccountLinkingRequiredError extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}
