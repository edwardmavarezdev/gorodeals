import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import {
  SocialAccount,
  SocialProvider,
} from './entities/social-account.entity.js';

/**
 * Normaliza un email: recorta espacios y pasa a minusculas.
 *
 * La base de datos guarda el email ya normalizado (CHECK `email = lower`),
 * pero normalizar aqui evita depender del CHECK para la unicidad real.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Acceso a datos de usuarios y cuentas sociales. No contiene reglas de
 * negocio de autenticacion: eso vive en `AuthModule`.
 */
export class UsersService {
  constructor(
    private readonly userRepo: Repository<User>,
    private readonly socialAccountRepo: Repository<SocialAccount>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findBySocialAccount(
    provider: SocialProvider,
    providerAccountId: string,
  ): Promise<SocialAccount | null> {
    return this.socialAccountRepo.findOne({
      where: { provider, providerAccountId },
    });
  }

  listSocialAccounts(userId: string): Promise<SocialAccount[]> {
    return this.socialAccountRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  createUser(user: Partial<User>): Promise<User> {
    return this.userRepo.save(this.userRepo.create(user));
  }

  createSocialAccount(account: Partial<SocialAccount>): Promise<SocialAccount> {
    return this.socialAccountRepo.save(this.socialAccountRepo.create(account));
  }

  /**
   * Vincula una identidad social a un usuario. Si la identidad ya esta
   * vinculada a otro usuario devuelve `false` en lugar de robarla: el
   * vinculo social es la credencial, no el email.
   */
  async linkSocialAccount(
    userId: string,
    provider: SocialProvider,
    providerAccountId: string,
    profile: { nickname?: string | null; avatarUrl?: string | null },
  ): Promise<SocialAccount | null> {
    const existing = await this.findBySocialAccount(
      provider,
      providerAccountId,
    );
    if (existing) {
      return existing.userId === userId ? existing : null;
    }
    return this.createSocialAccount({
      userId,
      provider,
      providerAccountId,
      nickname: profile.nickname ?? null,
      avatarUrl: profile.avatarUrl ?? null,
    });
  }
}
