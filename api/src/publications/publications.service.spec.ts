import type { DataSource, Repository } from 'typeorm';
import { PublicationsService } from './publications.service.js';
import { Publication } from './entities/publication.entity.js';
import { FranchisesService } from '../franchises/franchises.service.js';
import { NotFoundException } from '../errors.js';

describe('PublicationsService', () => {
  /** Firma de `DataSource.query(sql, params)`. */
  type QueryMock = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

  let service: PublicationsService;
  let dataSourceQuery: QueryMock;
  let publicationRepo: { findOne: jest.Mock };
  let franchisesService: { findRouteBySlug: jest.Mock };

  const summaryRow = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'como-empezar-la-saga-like-a-dragon',
    title: 'Como empezar la saga Like a Dragon sin perderte',
    subtitle: 'La ruta corta',
    excerpt: 'Resumen',
    category: 'ruta',
    cover_url: null,
    author_name: 'Equipo GoRoDeals',
    reading_minutes: 7,
    published_at: new Date('2026-02-10T09:00:00.000Z'),
    franchise_slug: 'like-a-dragon',
    franchise_name: 'Like a Dragon',
  };

  beforeEach(() => {
    dataSourceQuery = jest.fn<Promise<unknown[]>, [string, unknown[]?]>(() =>
      Promise.resolve([]),
    );
    publicationRepo = { findOne: jest.fn() };
    franchisesService = { findRouteBySlug: jest.fn() };

    service = new PublicationsService(
      publicationRepo as unknown as Repository<Publication>,
      franchisesService as unknown as FranchisesService,
      { query: dataSourceQuery } as unknown as DataSource,
    );
  });

  it('pagina el listado y devuelve el total de paginas', async () => {
    dataSourceQuery
      .mockResolvedValueOnce([summaryRow])
      .mockResolvedValueOnce([{ total: 26 }]);

    const result = await service.list({ page: 2, limit: 12 });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(12);
    expect(result.total).toBe(26);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].franchise).toEqual({
      slug: 'like-a-dragon',
      name: 'Like a Dragon',
    });
    expect(result.items[0].publishedAt).toBe('2026-02-10T09:00:00.000Z');
  });

  it('aplica LIMIT/OFFSET en la consulta del listado', async () => {
    dataSourceQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.list({ page: 3, limit: 10 });

    const [sql, params] = dataSourceQuery.mock.calls[0];
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(params).toEqual([10, 20]);
  });

  it('filtra por categoria, saga y busqueda', async () => {
    dataSourceQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.list({
      category: 'ruta',
      franchise: 'like-a-dragon',
      q: 'yakuza',
    });

    const [sql, params] = dataSourceQuery.mock.calls[0];
    expect(sql).toContain('p.category = $1');
    expect(sql).toContain('f.slug = $2');
    expect(sql).toContain('p.title ILIKE $3');
    expect(params?.slice(0, 3)).toEqual(['ruta', 'like-a-dragon', '%yakuza%']);
  });

  it('devuelve solo las categorias con publicaciones', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { category: 'ruta', count: 3 },
      { category: 'guia', count: 1 },
    ]);

    const result = await service.categories();

    expect(result.items).toEqual([
      { slug: 'guia', name: 'Guias', count: 1 },
      { slug: 'ruta', name: 'Rutas de saga', count: 3 },
    ]);
  });

  it('devuelve 404 cuando la publicacion no existe', async () => {
    publicationRepo.findOne.mockResolvedValue(null);

    await expect(service.findBySlug('no-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resuelve la ruta de la saga reutilizando FranchisesService', async () => {
    publicationRepo.findOne.mockResolvedValue({
      id: summaryRow.id,
      slug: summaryRow.slug,
      title: summaryRow.title,
      subtitle: summaryRow.subtitle,
      excerpt: summaryRow.excerpt,
      body: 'Cuerpo',
      category: 'ruta',
      coverUrl: null,
      authorName: 'Equipo GoRoDeals',
      readingMinutes: 7,
      franchiseId: '22222222-2222-2222-2222-222222222222',
      publishedAt: new Date('2026-02-10T09:00:00.000Z'),
      updatedAt: new Date('2026-02-18T09:00:00.000Z'),
      seoTitle: null,
      seoDescription: null,
    });

    dataSourceQuery
      .mockResolvedValueOnce([{ slug: 'like-a-dragon', name: 'Like a Dragon' }])
      .mockResolvedValueOnce([
        {
          slug: 'yakuza-0',
          title: 'Yakuza 0',
          cover_url: null,
          release_date: '2015-12-18',
          current_price: '14.99',
          discount_percent: '50.00',
          store_name: 'steam',
          currency: 'USD',
        },
      ]);

    franchisesService.findRouteBySlug.mockResolvedValue({
      name: 'Like a Dragon',
      slug: 'like-a-dragon',
      description: null,
      route: [
        {
          position: 1,
          note: 'Empieza aqui',
          game: {
            slug: 'yakuza-0',
            title: 'Yakuza 0',
            coverUrl: null,
            releaseDate: '2015-12-18',
            qualityScore: 8.1,
          },
        },
      ],
    });

    const result = await service.findBySlug(summaryRow.slug);

    expect(franchisesService.findRouteBySlug).toHaveBeenCalledWith(
      'like-a-dragon',
    );
    expect(result.route?.entries[0].game.slug).toBe('yakuza-0');
    expect(result.relatedGames[0].bestPrice).toBe(14.99);
    expect(result.relatedGames[0].discountPercent).toBe(50);
    expect(result.relatedGames[0].storeName).toBe('steam');
  });
});
