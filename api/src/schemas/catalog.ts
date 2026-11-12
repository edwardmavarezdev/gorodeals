import { Type } from '@sinclair/typebox';

/**
 * Esquemas del catalogo.
 *
 * Sustituyen a los DTO con `class-validator`: el mismo contenido, pero
 * como JSON Schema, que es lo que Fastify valida y lo que `@fastify/swagger`
 * publica. Una sola definicion para las tres cosas.
 */

/** Tiendas que pueden filtrar el catalogo. */
export const CATALOG_STORES = ['steam', 'gog', 'nintendo'] as const;

/** Ordenaciones del catalogo. */
export const CATALOG_SORTS = ['recent', 'quality', 'discount'] as const;

/** Filtros del catalogo paginado. */
export const CatalogQuery = Type.Object(
  {
    page: Type.Optional(
      Type.Integer({ minimum: 1, description: 'Pagina solicitada (1-based)' }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        description: 'Elementos por pagina',
      }),
    ),
    q: Type.Optional(
      Type.String({
        maxLength: 100,
        description: 'Filtro por titulo (ILIKE)',
      }),
    ),
    sort: Type.Optional(
      Type.Union(
        CATALOG_SORTS.map((value) => Type.Literal(value)),
        {
          description:
            'Orden: recent = fecha de salida, quality = score de calidad, ' +
            'discount = mejor descuento',
        },
      ),
    ),
    store: Type.Optional(
      Type.Union(
        CATALOG_STORES.map((value) => Type.Literal(value)),
        { description: 'Filtra por tienda' },
      ),
    ),
  },
  { additionalProperties: false },
);

/** Oferta destacada de un juego. */
export const BestOffer = Type.Object({
  storeName: Type.String({
    description: 'Tienda de la oferta',
    example: 'steam',
  }),
  storeProductId: Type.String({
    description: 'Identificador del producto en la tienda',
    example: '1091500',
  }),
  currentPrice: Type.Number({ description: 'Precio actual', example: 59.99 }),
  regularPrice: Type.Number({ description: 'Precio de lista', example: 79.99 }),
  discountPercent: Type.Number({
    description: 'Descuento en porcentaje',
    example: 25,
  }),
  currency: Type.String({ description: 'Moneda ISO 4217', example: 'USD' }),
  url: Type.Union([Type.String(), Type.Null()], {
    description: 'URL de la oferta en la tienda',
  }),
  dealScore: Type.Number({
    description: 'Deal Score 0-10 de la oferta',
    example: 7.2,
  }),
  historicalLowPrice: Type.Union([Type.Number(), Type.Null()], {
    description: 'Precio mas bajo registrado historicamente para la oferta',
  }),
});

/** Juego del catalogo con su mejor oferta. */
export const CatalogItem = Type.Object({
  id: Type.String({ description: 'UUID del juego' }),
  slug: Type.String({ example: 'like-a-dragon-infinite-wealth' }),
  title: Type.String({ example: 'Like a Dragon: Infinite Wealth' }),
  summary: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  genres: Type.Array(Type.String(), { example: ['RPG'] }),
  platforms: Type.Array(Type.String(), { example: ['PS5'] }),
  releaseDate: Type.Union([Type.String(), Type.Null()], {
    example: '2023-01-01',
  }),
  metacriticScore: Type.Union([Type.Number(), Type.Null()], { example: 87 }),
  qualityScore: Type.Number({
    description: 'Score de calidad 0-10',
    example: 8.4,
  }),
  bestOffer: Type.Union([BestOffer, Type.Null()], {
    description: 'Mejor oferta vigente; null si el juego no tiene ofertas',
  }),
});

/** Pagina del catalogo con el total de juegos que cumplen el filtro. */
export const CatalogResponse = Type.Object({
  page: Type.Number({ example: 1 }),
  limit: Type.Number({ example: 24 }),
  total: Type.Number({
    description: 'Total de juegos que cumplen el filtro (sin paginar)',
    example: 123,
  }),
  items: Type.Array(CatalogItem),
});
