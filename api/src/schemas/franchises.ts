import { Type } from '@sinclair/typebox';
import { RouteEntry } from './games.js';

/** Esquemas de sagas y rutas de juego. */

/** Resumen de una saga con la que se puede abrir su ruta de juego. */
export const FranchiseSummary = Type.Object({
  slug: Type.String({ example: 'like-a-dragon' }),
  name: Type.String({ example: 'Like a Dragon' }),
  description: Type.Union([Type.String(), Type.Null()]),
  gameCount: Type.Number({
    description: 'Juegos que forman parte de la saga',
    example: 7,
  }),
});

/** Listado de sagas. */
export const FranchiseSummaryList = Type.Array(FranchiseSummary);

/** Saga con su ruta de juego recomendada. */
export const FranchiseRoute = Type.Object({
  name: Type.String({ example: 'Like a Dragon' }),
  slug: Type.String({ example: 'like-a-dragon' }),
  description: Type.Union([Type.String(), Type.Null()]),
  route: Type.Array(RouteEntry),
});
