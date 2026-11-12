import { Type } from '@sinclair/typebox';

/** Esquemas del historico de precios. */

/** Filtros del historico de precios. */
export const PriceHistoryQuery = Type.Object(
  {
    months: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 60,
        description: 'Meses de historico a devolver (por defecto 12)',
      }),
    ),
    storeProductId: Type.Optional(
      Type.String({
        maxLength: 64,
        description:
          'Oferta concreta a consultar: UUID de store_products o el id de ' +
          'producto de la tienda (por ejemplo el appid de Steam)',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Punto de la serie temporal de precios de una oferta. */
export const PriceSeriesPoint = Type.Object({
  recordedAt: Type.String({ example: '2026-11-03T00:00:00.000Z' }),
  price: Type.Number({ example: 59.99 }),
  regularPrice: Type.Union([Type.Number(), Type.Null()], { example: 79.99 }),
  discountPercent: Type.Union([Type.Number(), Type.Null()], { example: 25 }),
});

/** Serie temporal de precios de una oferta. */
export const PriceHistoryResponse = Type.Object({
  storeProductId: Type.String({
    description: 'UUID de la oferta (store_products) de la que es la serie',
  }),
  points: Type.Array(PriceSeriesPoint),
});
