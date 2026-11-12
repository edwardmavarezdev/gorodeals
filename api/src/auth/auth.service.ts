import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../errors.js';
import { createLogger } from '../logger.js';
import type { Static } from '@sinclair/typebox';
import { AuthResponse, AuthUser } from '../schemas/auth.js';
import { UsersService, normalizeEmail } from '../users/users.service.js';
import {
  PasswordService,
  InvalidCredentialsError,
} from './password.service.js';
import { SessionService, SessionContext } from './session.service.js';
import { TokenService } from './token.service.js';
import { AccountLinkingService } from './account-linking.service.js';

/**
 * Orquestacion de la autenticacion: registro, login, renovacion de sesion
 * y perfil.
 */
export class AuthService {
  private readonly logger = createLogger('AuthService');

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly accountLinkingService: AccountLinkingService,
  ) {}

  /**
   * Registra una cuenta local con email y contrasena.
   *
   * El email se normaliza (trim + minusculas) antes de buscarlo, y la base
   * de datos lo restringe con `UNIQUE` mas un CHECK de formato y de
   * minusculas.
   */
  async register(
    email: string,
    password: string,
    displayName: string,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const normalizedEmail = normalizeEmail(email);
    this.passwordService.validateStrength(password);

    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.usersService.createUser({
      email: normalizedEmail,
      passwordHash,
      displayName: displayName.trim(),
      emailVerifiedAt: new Date(),
      isActive: true,
    });

    return this.buildAuthResponse(user.id, user.email, context);
  }

  /**
   * Login con email y contrasena.
   *
   * El error es siempre el mismo (401 "credenciales invalidas"), tanto si
   * el email no existe como si la contrasena no coincide. El tiempo de
   * respuesta tambien se iguala con un hash dummy.
   */
  async login(
    email: string,
    password: string,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      await this.passwordService.verifyDummy(password);
      throw new InvalidCredentialsError();
    }

    if (!user.passwordHash) {
      // Cuenta solo social: se verifica igualmente el hash dummy para no
      // delatar la diferencia de tiempo.
      await this.passwordService.verifyDummy(password);
      throw new InvalidCredentialsError();
    }

    const valid = await this.passwordService.verify(
      user.passwordHash,
      password,
    );
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new AccountNotVerifiedError();
    }

    return this.buildAuthResponse(user.id, user.email, context);
  }

  /**
   * Rota el refresh token: emite un access token nuevo y un refresh token
   * nuevo, y revoca el anterior.
   */
  async refresh(
    refreshToken: string,
    context: SessionContext,
  ): Promise<Static<typeof AuthResponse>> {
    const rotated = await this.sessionService.rotate(refreshToken, context);
    const user = await this.usersService.findById(rotated.userId);
    if (!user || !user.isActive) {
      throw new AccountNotVerifiedError();
    }
    return this.buildAuthResponse(user.id, user.email, context, rotated.token);
  }

  /**
   * Cierra la sesion actual. `all` revoca todas las sesiones del usuario
   * en lugar de solo la que corresponde al token presentado.
   */
  async logout(
    userId: string,
    refreshToken: string | null,
    all: boolean,
  ): Promise<{ revoked: number }> {
    if (all) {
      const revoked = await this.sessionService.revokeAllForUser(userId);
      return { revoked };
    }
    if (!refreshToken) {
      return { revoked: 0 };
    }
    const revoked = (await this.sessionService.revoke(refreshToken)) ? 1 : 0;
    return { revoked };
  }

  /** Perfil del usuario autenticado. */
  async getProfile(userId: string): Promise<Static<typeof AuthUser>> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    return this.toAuthUser(user.id, user.email, user.displayName);
  }

  /** Actualiza el nombre visible del usuario autenticado. */
  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<Static<typeof AuthUser>> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    user.displayName = displayName.trim();
    await this.usersService.createUser(user);
    return this.toAuthUser(user.id, user.email, user.displayName);
  }

  /**
   * Emite un access token y una sesion nueva (refresh token) para el
   * usuario, y construye la respuesta de la API.
   */
  async buildAuthResponse(
    userId: string,
    email: string,
    context: SessionContext,
    existingRefreshToken?: string,
  ): Promise<Static<typeof AuthResponse>> {
    const accessToken = await this.tokenService.signAccessToken(userId, email);

    let refreshToken = existingRefreshToken;
    if (!refreshToken) {
      const issued = await this.sessionService.issue(userId, context);
      refreshToken = issued.token;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokenService.accessTokenTtlSeconds,
      user: await this.toAuthUser(userId, email),
    };
  }

  /** Datos publicos del usuario, con sus proveedores de login social. */
  private async toAuthUser(
    userId: string,
    email: string,
    displayName?: string,
  ): Promise<Static<typeof AuthUser>> {
    const user = displayName
      ? undefined
      : await this.usersService.findById(userId);
    const socialAccounts = await this.usersService.listSocialAccounts(userId);
    const avatar = socialAccounts.find(
      (account) => account.avatarUrl,
    )?.avatarUrl;

    return {
      id: userId,
      email,
      displayName: displayName ?? user?.displayName ?? '',
      avatarUrl: avatar ?? null,
      providers: socialAccounts.map((account) => account.provider),
    };
  }
}

/**
 * El email ya esta registrado. 409. Solo en el registro: en el login nunca
 * se revela si una cuenta existe.
 */
export class EmailAlreadyRegisteredError extends ConflictException {
  constructor() {
    super('Ese correo ya esta registrado');
  }
}

/**
 * La cuenta no esta activa o verificada. 403.
 */
export class AccountNotVerifiedError extends ForbiddenException {
  constructor() {
    super('La cuenta no esta verificada');
  }
}
