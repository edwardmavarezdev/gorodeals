import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Sesion persistente de un usuario.
 *
 * El refresh token es opaco y aleatorio: en la base de datos solo se guarda
 * su SHA-256 (`token_hash`), nunca el token en claro. Si la base de datos se
 * filtra, los hashes no permiten autenticarse.
 *
 * `revoked_at` marca la sesion como cerrada. Un token ya revocado que se
 * vuelve a presentar es una senal de robo de token: el servicio revoca todas
 * las sesiones del usuario.
 */
@Entity({ name: 'refresh_tokens' })
@Index('idx_refresh_tokens_user_id', ['userId'])
@Index('idx_refresh_tokens_expires_at', ['expiresAt'])
@Index('idx_refresh_tokens_token_hash', ['tokenHash'], { unique: true })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  /**
   * Propietario de la sesion. La FK `fk_refresh_tokens_user` se crea en la
   * migracion con `ON DELETE CASCADE`.
   *
   * No se declara la relacion `ManyToOne` a proposito: mapear la misma
   * columna por la relacion y por el atributo hace que TypeORM la inserte
   * como `DEFAULT` (es decir, nula) en vez de con el valor del atributo.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** SHA-256 en hexadecimal del token opaco entregado al cliente. */
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** NULL mientras la sesion esta viva; fecha de revocacion si no. */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip', type: 'inet', nullable: true })
  ip!: string | null;

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
