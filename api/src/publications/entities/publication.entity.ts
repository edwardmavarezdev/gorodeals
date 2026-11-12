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
import { Franchise } from '../../franchises/entities/franchise.entity.js';

export enum PublicationCategory {
  GUIA = 'guia',
  RUTA = 'ruta',
  ANALISIS = 'analisis',
  NOTICIA = 'noticia',
}

/**
 * Publicacion editorial (articulo de la seccion /publicaciones).
 *
 * El articulo completo vive en `body` como markdown simple. `excerpt` es el
 * resumen de 1-3 frases que se muestra en el listado.
 */
@Entity({ name: 'publications' })
@Unique('uq_publications_slug', ['slug'])
@Index('idx_publications_franchise_id', ['franchiseId'])
@Index('idx_publications_is_published', ['isPublished'])
@Index('idx_publications_category', ['category'])
@Index('idx_publications_published_at', ['publishedAt'])
@Check('chk_publications_slug', '"slug" ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'')
@Check(
  'chk_publications_category',
  "\"category\" IN ('guia', 'ruta', 'analisis', 'noticia')",
)
@Check('chk_publications_reading_minutes', '"reading_minutes" > 0')
export class Publication {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'slug', type: 'text' })
  slug!: string;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({ name: 'subtitle', type: 'text', nullable: true })
  subtitle!: string | null;

  /** Resumen de 1-3 frases para el listado. */
  @Column({ name: 'excerpt', type: 'text' })
  excerpt!: string;

  /** Articulo completo en markdown simple. */
  @Column({ name: 'body', type: 'text' })
  body!: string;

  @Column({ name: 'category', type: 'text' })
  category!: PublicationCategory;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ name: 'author_name', type: 'text' })
  authorName!: string;

  @Column({ name: 'reading_minutes', type: 'integer' })
  readingMinutes!: number;

  /**
   * Saga a la que trata la publicacion. Referencia blanda: si la saga se
   * borra, la publicacion se queda sin saga pero no se pierde.
   */
  @Column({ name: 'franchise_id', type: 'uuid', nullable: true })
  franchiseId!: string | null;

  @ManyToOne(() => Franchise, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'franchise_id',
    foreignKeyConstraintName: 'fk_publications_franchise',
  })
  franchise!: Franchise | null;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  publishedAt!: Date;

  @Column({ name: 'seo_title', type: 'text', nullable: true })
  seoTitle!: string | null;

  @Column({ name: 'seo_description', type: 'text', nullable: true })
  seoDescription!: string | null;

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
