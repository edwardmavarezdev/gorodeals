import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Publication } from './publication.entity.js';
import { Game } from '../../games/entities/game.entity.js';

/**
 * Union entre una publicacion y los juegos que menciona. La PK compuesta
 * garantiza que un juego no se repite dentro de la misma publicacion.
 *
 * Ambas FK son CASCADE: si se borra la publicacion o el juego, la fila de la
 * union desaparece.
 */
@Entity({ name: 'publication_games' })
@Index('idx_publication_games_game_id', ['gameId'])
export class PublicationGame {
  @PrimaryColumn({ name: 'publication_id', type: 'uuid' })
  publicationId!: string;

  @ManyToOne(() => Publication, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'publication_id',
    foreignKeyConstraintName: 'fk_publication_games_publication',
  })
  publication!: Publication;

  @PrimaryColumn({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'game_id',
    foreignKeyConstraintName: 'fk_publication_games_game',
  })
  game!: Game;
}
