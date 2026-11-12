import { Type } from '@sinclair/typebox';
import { CatalogItem } from './catalog.js';

/** Esquemas del top de ofertas. */

/** Filtros del top de ofertas. */
export const HottestDealsQuery = Type.Object(
  {
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        description: 'Numero de ofertas a devolver',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Top de ofertas por Deal Score. */
export const HottestDealsResponse = Type.Object({
  items: Type.Array(CatalogItem),
});
