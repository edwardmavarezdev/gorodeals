import { Type } from '@sinclair/typebox';

/** Esquemas de la ficha de un juego. */

/** Filtros de la ficha de un juego. */
export const GameDetailQuery = Type.Object(
  {
    months: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 60,
        description:
          'Meses de historico de precios a incluir (por defecto 3, es decir ' +
          '90 dias)',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Oferta de un juego en una tienda concreta. */
export const Offer = Type.Object({
  storeName: Type.String({
    description: 'Tienda de la oferta',
    example: 'steam',
  }),
  storeProductId: Type.String({ example: '1091500' }),
  currentPrice: Type.Number({ example: 59.99 }),
  regularPrice: Type.Number({ example: 79.99 }),
  discountPercent: Type.Number({ example: 25 }),
  currency: Type.String({ example: 'USD' }),
  url: Type.Union([Type.String(), Type.Null()]),
  isAvailable: Type.Boolean({
    description: 'La oferta esta disponible en la tienda',
  }),
  historicalLowPrice: Type.Union([Type.Number(), Type.Null()], {
    example: 39.99,
  }),
  dealScore: Type.Number({ description: 'Deal Score 0-10', example: 7.2 }),
  lastCheckedAt: Type.String({ example: '2026-11-03T06:00:00.000Z' }),
});

/** Punto de la serie de precios de una oferta. */
export const PriceHistoryPoint = Type.Object({
  storeProductId: Type.String({
    description: 'UUID de la oferta (store_products)',
  }),
  storeName: Type.String({ example: 'steam' }),
  price: Type.Number({ example: 59.99 }),
  regularPrice: Type.Union([Type.Number(), Type.Null()], { example: 79.99 }),
  discountPercent: Type.Union([Type.Number(), Type.Null()], { example: 25 }),
  recordedAt: Type.String({ example: '2026-11-03T00:00:00.000Z' }),
});

/** Ficha completa de un juego. */
export const GameDetail = Type.Object({
  id: Type.String({ description: 'UUID del juego' }),
  slug: Type.String({ example: 'like-a-dragon-infinite-wealth' }),
  title: Type.String({ example: 'Like a Dragon: Infinite Wealth' }),
  summary: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  screenshots: Type.Array(Type.String()),
  genres: Type.Array(Type.String()),
  platforms: Type.Array(Type.String()),
  releaseDate: Type.Union([Type.String(), Type.Null()], {
    example: '2023-01-01',
  }),
  metacriticScore: Type.Union([Type.Number(), Type.Null()], { example: 87 }),
  qualityScore: Type.Number({
    description: 'Score de calidad 0-10',
    example: 8.4,
  }),
});

/**
 * Entrada de la ruta de una saga: posicion, nota del editor y juego.
 * Se define aqui (y no en el esquema de sagas) para no crear una
 * dependencia circular entre los dos dominios.
 */
export const RouteEntry = Type.Object({
  position: Type.Number({ example: 1 }),
  note: Type.Union([Type.String(), Type.Null()]),
  game: Type.Object({
    slug: Type.String({ example: 'yakuza-0' }),
    title: Type.String({ example: 'Yakuza 0' }),
    coverUrl: Type.Union([Type.String(), Type.Null()]),
    releaseDate: Type.Union([Type.String(), Type.Null()], {
      example: '2015-12-18',
    }),
    qualityScore: Type.Number({ example: 8.1 }),
  }),
});

/** Saga con su ruta de juego recomendada. */
export const FranchiseRoute = Type.Object({
  name: Type.String({ example: 'Like a Dragon' }),
  slug: Type.String({ example: 'like-a-dragon' }),
  description: Type.Union([Type.String(), Type.Null()]),
  route: Type.Array(RouteEntry),
});

/**
 * Respuesta completa de la ficha de un juego: metadatos, ofertas, historico
 * de precios y la saga a la que pertenece (si la hay).
 */
export const GameDetailResponse = Type.Object({
  game: GameDetail,
  offers: Type.Array(Offer),
  priceHistory: Type.Array(PriceHistoryPoint),
  franchise: Type.Union([FranchiseRoute, Type.Null()], {
    description: 'Saga a la que pertenece el juego, con su ruta',
  }),
});
