import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

/**
 * Cuenta de usuario de GoRoDeals.
 *
 * `email` es obligatorio y unico. Las cuentas que solo usan login social
 * reciben un email sintetico del dominio reservado `users.gorodeals.local`
 * (`steam_<steamid64>@users.gorodeals.local`), de modo que la columna puede
 * mantener NOT NULL + UNIQUE sin huecos. El dominio reservado identifica esas
 * cuentas: nunca son direcciones reales.
 *
 * `password_hash` es NULL para cuentas que solo existen en un proveedor
 * social (Google o Steam).
 */
@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Check(
  'chk_users_email_format',
  '"email" ~ \'^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$\'',
)
@Check('chk_users_email_lowercase', '"email" = lower("email")')
@Check('chk_users_role', "\"role\" IN ('user', 'admin')")
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  /** Email normalizado: siempre en minusculas y sin espacios. */
  @Column({ name: 'email', type: 'text' })
  email!: string;

  /** Hash argon2id. NULL en cuentas que solo usan login social. */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({
    name: 'role',
    type: 'text',
    default: UserRole.USER,
    enum: UserRole,
  })
  role!: UserRole;

  /**
   * Fecha de verificacion del email. En el MVP se fija al crear la cuenta
   * porque todavia no hay proveedor de correo configurado que envie el token
   * de verificacion; en cuanto exista, pasa a ser NULL hasta verificar.
   */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date;
}
