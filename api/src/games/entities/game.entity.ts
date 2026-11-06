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
import {
  bigintTransformer,
  jsonbArrayTransformer,
  numericTransformer,
} from '../../database/typeorm-transformers.js';

/**
 * Juego maestro. `igdb_id` es la clave natural irreversible de IGDB y no se
 * reutiliza nunca: por eso es UNIQUE y NOT NULL.
 */
@Entity({ name: 'games' })
@Index('idx_games_title', ['title'])
@Index('idx_games_quality_score', ['qualityScore'])
@Unique('uq_games_igdb_id', ['igdbId'])
@Unique('uq_games_slug', ['slug'])
@Check(
  'chk_games_quality_score',
  '"quality_score" >= 0 AND "quality_score" <= 10',
)
@Check(
  'chk_games_metacritic_score',
  '"metacritic_score" IS NULL OR ("metacritic_score" >= 0 AND "metacritic_score" <= 100)',
)
@Check('chk_games_genres', 'jsonb_typeof("genres") = \'array\'')
@Check('chk_games_platforms', 'jsonb_typeof("platforms") = \'array\'')
@Check('chk_games_screenshots', 'jsonb_typeof("screenshots") = \'array\'')
export class Game {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'igdb_id', type: 'bigint', transformer: bigintTransformer })
  igdbId!: string;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({ name: 'slug', type: 'text' })
  slug!: string;

  @Column({ name: 'summary', type: 'text', nullable: true })
  summary!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({
    name: 'screenshots',
    type: 'jsonb',
    default: () => "'[]'",
    transformer: jsonbArrayTransformer,
  })
  screenshots!: string[];

  @Column({
    name: 'genres',
    type: 'jsonb',
    default: () => "'[]'",
    transformer: jsonbArrayTransformer,
  })
  genres!: string[];

  @Column({
    name: 'platforms',
    type: 'jsonb',
    default: () => "'[]'",
    transformer: jsonbArrayTransformer,
  })
  platforms!: string[];

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate!: string | null;

  @Column({ name: 'metacritic_score', type: 'smallint', nullable: true })
  metacriticScore!: number | null;

  /** Score de calidad 0-10 calculado en Fase 5 sobre metadatos y valoracion. */
  @Column({
    name: 'quality_score',
    type: 'numeric',
    precision: 3,
    scale: 1,
    default: 0,
    transformer: numericTransformer,
  })
  qualityScore!: number;

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
