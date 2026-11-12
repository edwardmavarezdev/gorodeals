import { ConflictException } from '../errors.js';
import type { Static } from '@sinclair/typebox';
import { AuthResponse } from '../schemas/auth.js';
import { SocialProvider } from '../users/entities/social-account.entity.js';
import { UsersService } from '../users/users.service.js';
import { AccountLinkingService } from './account-linking.service.js';
import { AuthService } from './auth.service.js';
import { SessionContext } from './session.service.js';
import { GoogleProfile } from './google-oauth.service.js';
import { SteamIdentity } from './steam-openid.service.js';

/**
 * Login social: traduce la identidad del proveedor a una cuenta local.
 *
 * Google aporta `sub` (la identidad) y, si viene verificado, el email.
 * Steam aporta el SteamID64 y nada mas.
 */
export class SocialLoginService {
  constructor(
    private readonly accountLinkingService: AccountLinkingService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /** Login (o registro) con la identidad de Google. */
  async loginWithGoogle(
    profile: GoogleProfile,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const resolution = await this.accountLinkingService.resolve({
      provider: SocialProvider.GOOGLE,
      providerAccountId: profile.sub,
      email: profile.email,
      emailVerified: profile.emailVerified,
      nickname: profile.name,
      avatarUrl: profile.picture,
    });

    if (resolution.status === 'linkRequired') {
      throw new SocialLinkRequiredError(resolution.linkToken, resolution.email);
    }

    return this.buildResponseForUser(resolution.userId, context);
  }

  /** Login (o registro) con la identidad de Steam. */
  async loginWithSteam(
    identity: SteamIdentity,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const resolution = await this.accountLinkingService.resolve({
      provider: SocialProvider.STEAM,
      providerAccountId: identity.steamId64,
      email: null,
      emailVerified: false,
      nickname: null,
      avatarUrl: identity.avatarUrl,
    });

    if (resolution.status === 'linkRequired') {
      throw new SocialLinkRequiredError(resolution.linkToken, resolution.email);
    }

    return this.buildResponseForUser(resolution.userId, context);
  }

  /** Confirma una vinculacion pendiente con la contrasena local. */
  async confirmLink(linkToken: string, password: string): Promise<string> {
    return this.accountLinkingService.confirmLink(linkToken, password);
  }

  /** Emite tokens para un usuario ya resuelto. */
  async buildResponseForUser(
    userId: string,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new ConflictException('La cuenta no existe');
    }
    return this.authService.buildAuthResponse(user.id, user.email, context);
  }
}

/**
 * La identidad social corresponde a una cuenta local existente y hay que
 * confirmar la vinculacion con la contrasena de esa cuenta.
 *
 * El cuerpo lleva el `linkToken` de un solo uso para que el cliente pueda
 * completar el paso por `POST /auth/link/confirm`.
 */
export class SocialLinkRequiredError extends ConflictException {
  constructor(
    public readonly linkToken: string,
    public readonly email: string,
  ) {
    super(
      'Esta identidad social ya esta registrada. Confirma la vinculacion ' +
        'con tu contrasena para continuar.',
    );
  }
}
