import { Type } from '@sinclair/typebox';

/**
 * Esquemas del endpoint de administracion de sincronizacion.
 */

/** Parametros de `POST /admin/sync/random`. */
export const SyncRandomGamesQuery = Type.Object(
  {
    count: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        description: 'Numero de juegos a traer por tienda',
      }),
    ),
    platforms: Type.Optional(
      Type.String({
        description:
          'Tiendas a sincronizar, separadas por coma (steam,nintendo). ' +
          'Admite los alias `pc` y `switch`.',
      }),
    ),
    seed: Type.Optional(
      Type.Integer({
        description:
          'Semilla de la seleccion aleatoria. Por defecto se usa una ' +
          'semilla fija, de modo que la sincronizacion es idempotente.',
      }),
    ),
    onlyNew: Type.Optional(
      Type.Boolean({
        description:
          'Si es true, anade juegos aleatorios nuevos en lugar de ' +
          'refrescar los ya sincronizados.',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Resumen de la sincronizacion de juegos de prueba. */
export const SyncRandomGamesResult = Type.Object({
  requested: Type.Object({
    count: Type.Number({
      description: 'Numero de juegos pedidos por tienda',
    }),
    platforms: Type.Array(Type.String(), {
      description: 'Tiendas incluidas en la sincronizacion',
      example: ['steam', 'nintendo'],
    }),
  }),
  games: Type.Number({ description: 'Juegos creados o actualizados' }),
  offers: Type.Number({ description: 'Ofertas creadas o actualizadas' }),
  history: Type.Number({
    description: 'Filas de historico de precios insertadas',
  }),
  durationMs: Type.Number({ description: 'Duracion de la sincronizacion' }),
  sources: Type.Record(Type.String(), Type.String(), {
    description: 'Estado por tienda: de donde salio cada conjunto de datos',
  }),
});
