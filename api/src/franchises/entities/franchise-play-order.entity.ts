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
import { Franchise } from './franchise.entity.js';
import { Game } from '../../games/entities/game.entity.js';

/**
 * Orden recomendado de juego dentro de una saga. La posicion es unica por
 * saga y un juego no puede repetirse dentro de la misma saga.
 */
@Entity({ name: 'franchise_play_order' })
@Unique('uq_franchise_play_order_franchise_position', [
  'franchiseId',
  'position',
])
@Unique('uq_franchise_play_order_franchise_game', ['franchiseId', 'gameId'])
@Index('idx_franchise_play_order_game_id', ['gameId'])
@Index('idx_franchise_play_order_franchise_id', ['franchiseId'])
@Check('chk_franchise_play_order_position', '"position" > 0')
export class FranchisePlayOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'franchise_id', type: 'uuid' })
  franchiseId!: string;

  @ManyToOne(() => Franchise, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'franchise_id',
    foreignKeyConstraintName: 'fk_franchise_play_order_franchise',
  })
  franchise!: Franchise;

  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'game_id',
    foreignKeyConstraintName: 'fk_franchise_play_order_game',
  })
  game!: Game;

  @Column({ name: 'position', type: 'integer' })
  position!: number;

  /** Nota opcional del editor sobre por que ese juego va en esa posicion. */
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
