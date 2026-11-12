import { Type } from '@sinclair/typebox';

/** Esquemas de la lista de deseos. */

/** Tiendas en las que un juego puede estar anotado en la lista. */
export const WISHLIST_STORES = ['steam', 'gog', 'nintendo'] as const;

/**
 * Pagina de la lista de deseos.
 *
 * Los limites son los de `WishlistQueryDto` de NestJS: pagina desde 1 y
 * como mucho 100 elementos por pagina.
 */
export const WishlistQuery = Type.Object(
  {
    page: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: 'Pagina solicitada (1-based)',
        default: 1,
      }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        description: 'Elementos por pagina',
        default: 20,
      }),
    ),
    store: Type.Optional(
      Type.Union(
        WISHLIST_STORES.map((value) => Type.Literal(value)),
        { description: 'Filtra la lista por tienda' },
      ),
    ),
  },
  { additionalProperties: false },
);

/**
 * Datos para anadir un juego a la lista.
 *
 * El juego se identifica por `gameId` o por `slug`. El frontend envia los
 * dos a la vez, asi que, como en NestJS, si vienen ambos manda `gameId`.
 * El caso de "ninguno de los dos" lo rechaza el servicio, con el mensaje
 * que ya usaba NestJS.
 */
export const AddWishlistItemBody = Type.Object(
  {
    gameId: Type.Optional(
      Type.String({
        format: 'uuid',
        // `IsUUID('4')` de NestJS exige version 4, no cualquier UUID.
        pattern:
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        description: 'UUID del juego del catalogo',
      }),
    ),
    slug: Type.Optional(
      Type.String({
        maxLength: 160,
        description: 'Slug del juego del catalogo',
      }),
    ),
    store: Type.Optional(
      Type.Union(
        WISHLIST_STORES.map((value) => Type.Literal(value)),
        { description: 'Tienda donde esta el juego' },
      ),
    ),
    storeItemId: Type.Optional(
      Type.String({
        maxLength: 120,
        description: 'Identificador del producto en la tienda',
      }),
    ),
    note: Type.Optional(
      Type.String({
        maxLength: 500,
        description: 'Nota personal del usuario',
      }),
    ),
  },
  { additionalProperties: false },
);

/** Entrada de la lista de deseos. */
export const WishlistItem = Type.Object({
  id: Type.String({ description: 'UUID de la entrada' }),
  gameId: Type.String({ description: 'UUID del juego' }),
  slug: Type.String({ example: 'like-a-dragon-infinite-wealth' }),
  title: Type.String({ example: 'Like a Dragon: Infinite Wealth' }),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  store: Type.Union([Type.String(), Type.Null()]),
  storeItemId: Type.Union([Type.String(), Type.Null()]),
  note: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ description: 'Fecha de creacion (ISO 8601)' }),
});

/** Pagina de la lista de deseos. */
export const WishlistResponse = Type.Object({
  page: Type.Number({ example: 1 }),
  limit: Type.Number({ example: 20 }),
  total: Type.Number({ example: 42 }),
  items: Type.Array(WishlistItem),
});

/**
 * Resultado de una sincronizacion con una tienda externa.
 *
 * `not_configured` no es un error: informa de que faltan credenciales.
 */
export const WishlistSyncResponse = Type.Object({
  store: Type.String({ example: 'gog' }),
  status: Type.Union([Type.Literal('ok'), Type.Literal('not_configured')], {
    example: 'not_configured',
  }),
  imported: Type.Number({ example: 0 }),
  exported: Type.Number({ example: 0 }),
  message: Type.String({ example: 'Falta configurar WISHLIST_GOG_API_KEY' }),
});
