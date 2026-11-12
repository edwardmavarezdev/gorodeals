import { Type } from '@sinclair/typebox';

/** Esquemas del contenido editorial. */

/** Categorias editoriales disponibles. */
export const PUBLICATION_CATEGORIES = [
  'guia',
  'ruta',
  'analisis',
  'noticia',
] as const;

/** Filtros del listado de publicaciones. */
export const PublicationQuery = Type.Object(
  {
    page: Type.Optional(
      Type.Integer({ minimum: 1, description: 'Pagina solicitada (1-based)' }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 50,
        description: 'Elementos por pagina',
      }),
    ),
    category: Type.Optional(
      Type.Union(
        PUBLICATION_CATEGORIES.map((value) => Type.Literal(value)),
        { description: 'Filtra por categoria editorial' },
      ),
    ),
    franchise: Type.Optional(
      Type.String({
        maxLength: 100,
        description: 'Filtra por slug de saga',
      }),
    ),
    q: Type.Optional(
      Type.String({
        maxLength: 100,
        description: 'Busqueda por titulo o resumen (ILIKE)',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Saga resumida que acompaña a una publicacion. */
export const PublicationFranchise = Type.Object({
  slug: Type.String({ example: 'like-a-dragon' }),
  name: Type.String({ example: 'Like a Dragon' }),
});

/** Publicacion tal y como aparece en el listado. */
export const PublicationSummary = Type.Object({
  id: Type.String({ description: 'UUID de la publicacion' }),
  slug: Type.String({ example: 'como-empezar-la-saga-like-a-dragon' }),
  title: Type.String({
    example: 'Como empezar la saga Like a Dragon sin perderte',
  }),
  subtitle: Type.Union([Type.String(), Type.Null()]),
  excerpt: Type.String({ description: 'Resumen de 1-3 frases' }),
  category: Type.String({ example: 'ruta' }),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  authorName: Type.String({ example: 'Equipo GoRoDeals' }),
  readingMinutes: Type.Number({ example: 7 }),
  publishedAt: Type.String({ example: '2026-02-10T09:00:00.000Z' }),
  franchise: Type.Union([PublicationFranchise, Type.Null()], {
    description: 'Saga a la que trata la publicacion',
  }),
});

/** Pagina del listado de publicaciones. */
export const PublicationListResponse = Type.Object({
  page: Type.Number({ example: 1 }),
  limit: Type.Number({ example: 12 }),
  total: Type.Number({
    description: 'Total de publicaciones que cumplen el filtro (sin paginar)',
    example: 6,
  }),
  totalPages: Type.Number({
    description: 'Numero total de paginas',
    example: 1,
  }),
  items: Type.Array(PublicationSummary),
});

/** Categoria editorial con su nombre legible y su recuento. */
export const PublicationCategory = Type.Object({
  slug: Type.String({ example: 'guia' }),
  name: Type.String({ example: 'Guias' }),
  count: Type.Number({
    description: 'Numero de publicaciones publicadas',
    example: 1,
  }),
});

/** Listado de categorias editoriales con su recuento. */
export const PublicationCategoriesResponse = Type.Object({
  items: Type.Array(PublicationCategory),
});

/** Ruta de la saga a la que trata la publicacion. */
export const PublicationRoute = Type.Object({
  name: Type.String({ example: 'Like a Dragon' }),
  slug: Type.String({ example: 'like-a-dragon' }),
  entries: Type.Array(
    Type.Object({
      position: Type.Number({ example: 1 }),
      note: Type.Union([Type.String(), Type.Null()]),
      game: Type.Object({
        slug: Type.String({ example: 'yakuza-0' }),
        title: Type.String({ example: 'Yakuza 0' }),
        coverUrl: Type.Union([Type.String(), Type.Null()]),
      }),
    }),
  ),
});

/** Juego relacionado con la publicacion y su mejor oferta actual. */
export const PublicationRelatedGame = Type.Object({
  slug: Type.String({ example: 'yakuza-0' }),
  title: Type.String({ example: 'Yakuza 0' }),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  releaseDate: Type.Union([Type.String(), Type.Null()], {
    example: '2015-12-18',
  }),
  bestPrice: Type.Union([Type.Number(), Type.Null()], {
    description: 'Precio de la mejor oferta actual; null si no hay oferta',
    example: 14.99,
  }),
  discountPercent: Type.Union([Type.Number(), Type.Null()], {
    description: 'Descuento de la mejor oferta actual, en porcentaje',
    example: 50,
  }),
  storeName: Type.Union([Type.String(), Type.Null()], {
    description: 'Tienda de la mejor oferta actual',
    example: 'steam',
  }),
  currency: Type.Union([Type.String(), Type.Null()], {
    description: 'Moneda ISO 4217 de la mejor oferta actual',
    example: 'USD',
  }),
});

/** Detalle completo de una publicacion. */
export const PublicationDetail = Type.Object({
  id: Type.String({ description: 'UUID de la publicacion' }),
  slug: Type.String({ example: 'como-empezar-la-saga-like-a-dragon' }),
  title: Type.String({
    example: 'Como empezar la saga Like a Dragon sin perderte',
  }),
  subtitle: Type.Union([Type.String(), Type.Null()]),
  excerpt: Type.String({ description: 'Resumen de 1-3 frases' }),
  body: Type.String({ description: 'Articulo completo en markdown simple' }),
  category: Type.String({ example: 'ruta' }),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  authorName: Type.String({ example: 'Equipo GoRoDeals' }),
  readingMinutes: Type.Number({ example: 7 }),
  publishedAt: Type.String({ example: '2026-02-10T09:00:00.000Z' }),
  updatedAt: Type.String({ example: '2026-02-18T09:00:00.000Z' }),
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
  franchise: Type.Union([PublicationFranchise, Type.Null()]),
  route: Type.Union([PublicationRoute, Type.Null()], {
    description: 'Ruta de la saga; null si la publicacion no tiene saga',
  }),
  relatedGames: Type.Array(PublicationRelatedGame),
});
