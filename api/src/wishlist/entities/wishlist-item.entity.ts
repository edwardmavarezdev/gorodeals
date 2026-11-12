import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Game } from '../../games/entities/game.entity.js';

/**
 * Entrada de la lista de deseos de un usuario.
 *
 * Un juego solo puede aparecer una vez por usuario (UNIQUE
 * `user_id, game_id`). `store` indica en que tienda se quiere el juego y
 * `store_item_id` el identificador del producto en esa tienda, que es lo que
 * permite la sincronizacion bidireccional con GOG o Nintendo.
 */
@Entity({ name: 'wishlist_items' })
@Unique('uq_wishlist_items_user_game', ['userId', 'gameId'])
@Index('idx_wishlist_items_user_id', ['userId'])
@Index('idx_wishlist_items_game_id', ['gameId'])
@Check(
  'chk_wishlist_items_store',
  "\"store\" IS NULL OR \"store\" IN ('steam', 'gog', 'nintendo')",
)
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  /**
   * Propietario de la entrada. La FK `fk_wishlist_items_user` se crea en la
   * migracion con `ON DELETE CASCADE`.
   *
   * La relacion `ManyToOne` se omite a proposito: mapear la misma columna
   * por la relacion y por el atributo hace que TypeORM la inserte como
   * `DEFAULT` (nula) en vez de con el valor del atributo.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'game_id',
    foreignKeyConstraintName: 'fk_wishlist_items_game',
  })
  game!: Game;

  /** Tienda donde esta el juego. NULL si todavia no se ha decidido. */
  @Column({ name: 'store', type: 'text', nullable: true })
  store!: string | null;

  /** Identificador del producto en la tienda (id de Steam, etc.). */
  @Column({ name: 'store_item_id', type: 'text', nullable: true })
  storeItemId!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

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
