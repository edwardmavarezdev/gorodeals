import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum SocialProvider {
  STEAM = 'steam',
  GOOGLE = 'google',
}

/**
 * Vinculo entre un usuario de GoRoDeals y su identidad en un proveedor
 * social (Steam u OpenID, Google OAuth 2.0).
 *
 * La identidad del proveedor es la clave natural:
 * (`provider`, `provider_account_id`) es UNIQUE. Para Steam el
 * `provider_account_id` es el SteamID64 en texto (nunca `bigint`: excede los
 * 53 bits seguros de un numero JS). Para Google es el `sub` de OpenID.
 */
@Entity({ name: 'social_accounts' })
@Unique('uq_social_accounts_provider_account', [
  'provider',
  'providerAccountId',
])
@Index('idx_social_accounts_user_id', ['userId'])
@Check('chk_social_accounts_provider', "\"provider\" IN ('steam', 'google')")
export class SocialAccount {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  /**
   * Propietario de la identidad social. La FK `fk_social_accounts_user` se
   * crea en la migracion con `ON DELETE CASCADE`.
   *
   * La relacion `ManyToOne` se omite a proposito: mapear la misma columna
   * por la relacion y por el atributo hace que TypeORM la inserte como
   * `DEFAULT` (nula) en vez de con el valor del atributo.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'provider',
    type: 'text',
    enum: SocialProvider,
  })
  provider!: SocialProvider;

  /** Identificador de la cuenta en el proveedor (SteamID64 o `sub`). */
  @Column({ name: 'provider_account_id', type: 'text' })
  providerAccountId!: string;

  /** Nombre de perfil mostrado por el proveedor, si lo publica. */
  @Column({ name: 'nickname', type: 'text', nullable: true })
  nickname!: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

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
