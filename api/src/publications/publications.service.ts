import type { Static } from '@sinclair/typebox';
import { DataSource, Repository } from 'typeorm';
import { Publication } from './entities/publication.entity.js';
import { FranchisesService } from '../franchises/franchises.service.js';
import { NotFoundException } from '../errors.js';
import {
  PUBLICATION_CATEGORIES,
  PublicationCategoriesResponse,
  PublicationCategory,
  PublicationDetail,
  PublicationListResponse,
  PublicationQuery,
  PublicationSummary,
} from '../schemas/publications.js';

/** Slug de una categoria editorial. */
export type PublicationCategorySlug = (typeof PUBLICATION_CATEGORIES)[number];

/** Nombre legible de cada categoria editorial. */
const CATEGORY_LABELS: Readonly<Record<PublicationCategorySlug, string>> = {
  guia: 'Guias',
  ruta: 'Rutas de saga',
  analisis: 'Analisis',
  noticia: 'Noticias',
};

interface PublicationRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  category: string;
  cover_url: string | null;
  author_name: string;
  reading_minutes: number;
  published_at: Date;
  franchise_slug: string | null;
  franchise_name: string | null;
}

interface RelatedGameRow {
  slug: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  current_price: number | null;
  discount_percent: number | null;
  store_name: string | null;
  currency: string | null;
}

export class PublicationsService {
  constructor(
    private readonly publicationRepo: Repository<Publication>,
    private readonly franchisesService: FranchisesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listado paginado de publicaciones publicadas. La paginacion y los
   * filtros se resuelven en SQL (LIMIT/OFFSET): nunca se trae la tabla
   * entera.
   */
  async list(
    query: Static<typeof PublicationQuery>,
  ): Promise<Static<typeof PublicationListResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const offset = (page - 1) * limit;

    const filters: string[] = ['p.is_published = true'];
    const params: unknown[] = [];

    if (query.category) {
      params.push(query.category);
      filters.push(`p.category = $${params.length}`);
    }

    if (query.franchise) {
      params.push(query.franchise);
      filters.push(`f.slug = $${params.length}`);
    }

    if (query.q) {
      params.push(`%${query.q}%`);
      filters.push(
        `(p.title ILIKE $${params.length} OR p.excerpt ILIKE $${params.length})`,
      );
    }

    const where = `WHERE ${filters.join(' AND ')}`;

    const rows = await this.dataSource.query<PublicationRow[]>(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.subtitle,
          p.excerpt,
          p.category,
          p.cover_url,
          p.author_name,
          p.reading_minutes,
          p.published_at,
          f.slug AS franchise_slug,
          f.name AS franchise_name
        FROM publications p
        LEFT JOIN franchises f ON f.id = p.franchise_id
        ${where}
        ORDER BY p.published_at DESC, p.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const countRows = await this.dataSource.query<{ total: number }[]>(
      `
        SELECT count(*)::int AS total
        FROM publications p
        LEFT JOIN franchises f ON f.id = p.franchise_id
        ${where}
      `,
      params,
    );

    const total = countRows[0]?.total ?? 0;

    const items: Static<typeof PublicationSummary>[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      excerpt: row.excerpt,
      category: row.category,
      coverUrl: row.cover_url,
      authorName: row.author_name,
      readingMinutes: Number(row.reading_minutes),
      publishedAt: new Date(row.published_at).toISOString(),
      franchise:
        row.franchise_slug && row.franchise_name
          ? { slug: row.franchise_slug, name: row.franchise_name }
          : null,
    }));

    return {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      items,
    };
  }

  /**
   * Categorias editoriales con el numero de publicaciones publicadas de
   * cada una. Las categorias sin publicaciones no aparecen.
   */
  async categories(): Promise<Static<typeof PublicationCategoriesResponse>> {
    const rows = await this.dataSource.query<
      { category: string; count: number }[]
    >(
      `
        SELECT category, count(*)::int AS count
        FROM publications
        WHERE is_published = true
        GROUP BY category
      `,
    );

    const counts = new Map(rows.map((row) => [row.category, row.count]));

    const items: Static<typeof PublicationCategory>[] =
      PUBLICATION_CATEGORIES.filter((slug) => counts.has(slug)).map((slug) => ({
        slug,
        name: CATEGORY_LABELS[slug],
        count: counts.get(slug) ?? 0,
      }));

    return { items };
  }

  /**
   * Detalle completo de una publicacion: metadatos, saga, ruta de la saga y
   * juegos relacionados con su mejor oferta actual.
   */
  async findBySlug(slug: string): Promise<Static<typeof PublicationDetail>> {
    const publication = await this.publicationRepo.findOne({
      where: { slug, isPublished: true },
    });

    if (!publication) {
      throw new NotFoundException(
        `No existe la publicacion con slug "${slug}"`,
      );
    }

    let franchise: Static<typeof PublicationDetail>['franchise'] = null;
    let route: Static<typeof PublicationDetail>['route'] = null;

    if (publication.franchiseId) {
      const franchiseRow = await this.dataSource.query<
        { slug: string; name: string }[]
      >(`SELECT slug, name FROM franchises WHERE id = $1`, [
        publication.franchiseId,
      ]);

      if (franchiseRow.length > 0) {
        franchise = {
          slug: franchiseRow[0].slug,
          name: franchiseRow[0].name,
        };

        /**
         * La ruta se delega en `FranchisesService`: la consulta de la saga ya
         * existe y no debe duplicarse.
         */
        const franchiseRoute = await this.franchisesService.findRouteBySlug(
          franchiseRow[0].slug,
        );
        route = {
          name: franchiseRoute.name,
          slug: franchiseRoute.slug,
          entries: franchiseRoute.route.map((entry) => ({
            position: entry.position,
            note: entry.note,
            game: {
              slug: entry.game.slug,
              title: entry.game.title,
              coverUrl: entry.game.coverUrl,
            },
          })),
        };
      }
    }

    const relatedGames = await this.findRelatedGames(publication.id);

    return {
      id: publication.id,
      slug: publication.slug,
      title: publication.title,
      subtitle: publication.subtitle,
      excerpt: publication.excerpt,
      body: publication.body,
      category: publication.category,
      coverUrl: publication.coverUrl,
      authorName: publication.authorName,
      readingMinutes: Number(publication.readingMinutes),
      publishedAt: new Date(publication.publishedAt).toISOString(),
      updatedAt: new Date(publication.updatedAt).toISOString(),
      seoTitle: publication.seoTitle,
      seoDescription: publication.seoDescription,
      franchise,
      route,
      relatedGames,
    };
  }

  /**
   * Juegos vinculados a la publicacion con su mejor oferta actual: el
   * `store_product` disponible de menor precio. Se resuelve con un unico
   * LATERAL JOIN, sin una consulta por juego.
   */
  private async findRelatedGames(
    publicationId: string,
  ): Promise<Static<typeof PublicationDetail>['relatedGames']> {
    const rows = await this.dataSource.query<RelatedGameRow[]>(
      `
        SELECT
          g.slug,
          g.title,
          g.cover_url,
          g.release_date::text AS release_date,
          o.current_price,
          o.discount_percent,
          o.store_name,
          o.currency
        FROM publication_games pg
        INNER JOIN games g ON g.id = pg.game_id
        LEFT JOIN LATERAL (
          SELECT
            sp.current_price,
            sp.discount_percent,
            sp.store_name,
            sp.currency
          FROM store_products sp
          WHERE sp.game_id = g.id AND sp.is_available = true
          ORDER BY sp.current_price ASC, sp.id
          LIMIT 1
        ) o ON TRUE
        WHERE pg.publication_id = $1
        ORDER BY o.current_price ASC NULLS LAST, g.title ASC
      `,
      [publicationId],
    );

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      coverUrl: row.cover_url,
      releaseDate: row.release_date,
      bestPrice: row.current_price === null ? null : Number(row.current_price),
      discountPercent:
        row.discount_percent === null ? null : Number(row.discount_percent),
      storeName: row.store_name,
      currency: row.currency,
    }));
  }
}
