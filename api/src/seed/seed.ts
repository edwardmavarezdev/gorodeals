/**
 * Seed idempotente del catalogo de GoRoDeals.
 *
 * Uso: `npm run seed`
 *
 * Inserta un catalogo real (saga Like a Dragon / Yakuza y varias sagas mas),
 * la saga `like-a-dragon` con su ruta recomendada, las ofertas de Steam y
 * una serie de historico de precios de los ultimos 30 dias.
 *
 * Es idempotente: los juegos se localizan por `igdb_id` o por `slug`, las
 * ofertas por `(store_name, store_product_id)` y el historico usa
 * `ON CONFLICT DO NOTHING` sobre `(store_product_id, recorded_at)`.
 * Reejecutarlo nunca duplica filas ni pisa datos ajenos.
 */
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';

config();

interface SeedGame {
  igdbId: number;
  title: string;
  slug: string;
  summary: string;
  description: string;
  coverUrl: string;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  metacriticScore: number;
  qualityScore: number;
  /** appid real de Steam. */
  appId: string;
  regularPrice: number;
  currentPrice: number;
}

interface SeedRouteEntry {
  slug: string;
  position: number;
  note: string;
}

const GAMES: SeedGame[] = [
  {
    igdbId: 900001,
    title: "Yakuza 0 Director's Cut",
    slug: 'yakuza-0',
    summary:
      'Antes de Yakuza, un joven de los yakuza busca su lugar en Kamurocho.',
    description:
      'Prehistoria de la saga, ambientada en Kamurocho y Sotenbori, con el ' +
      'nacimiento del clan Majima.',
    coverUrl:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2988580/aaceda0f5c16fce191e63f7342d07323e86a1156/header.jpg?t=1783041339',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2025-12-08',
    metacriticScore: 85,
    qualityScore: 8.1,
    appId: '2988580',
    regularPrice: 29.99,
    currentPrice: 14.99,
  },
  {
    igdbId: 900002,
    title: 'Yakuza Kiwami',
    slug: 'yakuza-1',
    summary: 'Kazuma Kiryu vuelve a Kamurocho tras su ausencia de diez anos.',
    description:
      'El primer Yakuza: Kazuma Kiryu vuelve a su barrio natal para investigar ' +
      'la muerte de su padre y se convierte en protagonista involuntario.',
    coverUrl:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3717330/07bf98df23eb154febbf878a79ff02b915b6cc43/header.jpg?t=1784876186',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2016-03-17',
    metacriticScore: 78,
    qualityScore: 7.4,
    appId: '3717330',
    regularPrice: 19.99,
    currentPrice: 9.99,
  },
  {
    igdbId: 900003,
    title: 'Yakuza Kiwami 2',
    slug: 'yakuza-2',
    summary: 'Ryuji Goda recorre Sotenbori para vengar a su hermano.',
    description:
      'Segunda parte de la saga: Ryuji Goda y Goro Majima se unen en Sotenbori ' +
      'para superar la invasion que threatens el barrio.',
    coverUrl:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3717340/894621031b664c828e8114c42934a098e38d182b/header.jpg?t=1781258352',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2017-03-21',
    metacriticScore: 76,
    qualityScore: 7.2,
    appId: '3717340',
    regularPrice: 19.99,
    currentPrice: 7.99,
  },
  {
    igdbId: 900004,
    title: 'Yakuza 3 Remastered',
    slug: 'yakuza-3',
    summary: 'Kiryu y Kazuma vuelven a Kyoto y Okinawa.',
    description:
      'Tercera entrega: el regreso de Kiryu a Okinawa, la aparicion de Kazuma ' +
      'Majima y el conflicto con el clan Ryuzoji.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1088710/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2021-01-28',
    metacriticScore: 80,
    qualityScore: 7.6,
    appId: '1088710',
    regularPrice: 19.99,
    currentPrice: 5.99,
  },
  {
    igdbId: 900005,
    title: 'Yakuza 4 Remastered',
    slug: 'yakuza-4',
    summary:
      'Una nueva generacion de yakuza y una lucha por el poder en Tokio.',
    description:
      'Cuarta entrega: Saejima, Akiyama, Tanimura y Masato Arakawa se cruzan ' +
      'en un Tokio abierto bajo la amenaza de un nuevo clan.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1105500/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2021-01-28',
    metacriticScore: 88,
    qualityScore: 8.2,
    appId: '1105500',
    regularPrice: 19.99,
    currentPrice: 7.49,
  },
  {
    igdbId: 900006,
    title: 'Yakuza 5 Remastered',
    slug: 'yakuza-5',
    summary: 'Kazuma Kiryu regresa tras cinco anos desaparecido.',
    description:
      'Quinta entrega: Kiryu regresa tras desaparecer durante cinco anos y ' +
      'debe unravel el conflicto entre los clanes de Kamurocho.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1105510/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2021-01-28',
    metacriticScore: 80,
    qualityScore: 7.7,
    appId: '1105510',
    regularPrice: 29.99,
    currentPrice: 14.99,
  },
  {
    igdbId: 900007,
    title: 'Yakuza 6: The Song of Life',
    slug: 'yakuza-6',
    summary: 'Kazuma Kiryu busca a su hija en un Japon de paz reconstruida.',
    description:
      'Sexta entrega: Kiryu viaja a un pais en reconstruccion tras la guerra ' +
      'para reencontrar a su hija perdida.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1388590/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2021-03-25',
    metacriticScore: 87,
    qualityScore: 8.4,
    appId: '1388590',
    regularPrice: 29.99,
    currentPrice: 11.99,
  },
  {
    igdbId: 900008,
    title: 'Like a Dragon: Ishin!',
    slug: 'like-a-dragon-ishin',
    summary: 'Kyushu, 1868: un samurai busca al hombre que desarrollo a Kiryu.',
    description:
      'Espinela ambientada en la era Meiji: un samurai busca al maestro que ' +
      'convertira a Kiryu en leyenda de Kamurocho.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1805480/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2023-02-21',
    metacriticScore: 80,
    qualityScore: 7.8,
    appId: '1805480',
    regularPrice: 29.99,
    currentPrice: 17.99,
  },
  {
    igdbId: 900009,
    title: 'Yakuza: Like a Dragon',
    slug: 'like-a-dragon',
    summary: 'Kazuma Kiryu entra en el mundo criminal de Isezaki Ichi.',
    description:
      'Septima entrega y primera con el titulo Like a Dragon: Kiryu alcanza la ' +
      'mayoria de edad y se convierte en miembro de la Organizacioncriminal de ' +
      'Isezaki Ichi.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1235140/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2020-11-10',
    metacriticScore: 87,
    qualityScore: 8.3,
    appId: '1235140',
    regularPrice: 39.99,
    currentPrice: 19.99,
  },
  {
    igdbId: 900010,
    title: 'Like a Dragon: Infinite Wealth',
    slug: 'like-a-dragon-infinite-wealth',
    summary: 'Kasuga y su grupo viajan a un archipielago en busca del tesoro.',
    description:
      'Kasuga Ichiban y su grupo zarpa hacia un archipielago en busca del ' +
      'tesoro perdido, con la presencia del majordomo.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/2072450/library_600x900.jpg',
    genres: ['RPG', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox Series X', 'PC'],
    releaseDate: '2024-01-25',
    metacriticScore: 87,
    qualityScore: 8.5,
    appId: '2072450',
    regularPrice: 59.99,
    currentPrice: 29.99,
  },
  {
    igdbId: 900011,
    title: 'The Elder Scrolls V: Skyrim Special Edition',
    slug: 'the-elder-scrolls-v-skyrim',
    summary: 'El Dragonborn vuelve a Tamriel para enfrentar a Alduin.',
    description:
      'La quinta entrega de The Elder Scrolls: un mundo abierto enorme con ' +
      'dragones, guildas y mazmorras generadas proceduralmente.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/489830/library_600x900.jpg',
    genres: ['RPG', 'Adventure'],
    platforms: ['PS5', 'Xbox Series X', 'PC'],
    releaseDate: '2016-10-04',
    metacriticScore: 84,
    qualityScore: 8,
    appId: '489830',
    regularPrice: 39.99,
    currentPrice: 19.99,
  },
  {
    igdbId: 900012,
    title: 'Fallout 4',
    slug: 'fallout-4',
    summary: 'El Supervisor sale del cryoestanque en el Commonwealth.',
    description:
      'Wasteland postapocaliptico: el jugador despierta en una capsula del ' +
      'Siglo 52 y decide que hacer con una peninsula infestada de mutantes.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/377160/library_600x900.jpg',
    genres: ['RPG', 'Shooter'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2015-11-10',
    metacriticScore: 86,
    qualityScore: 8.1,
    appId: '377160',
    regularPrice: 59.99,
    currentPrice: 14.99,
  },
  {
    igdbId: 900013,
    title: 'Resident Evil 2',
    slug: 'resident-evil-2',
    summary: 'Leon y Claire sobreviven al brote en Raccoon City.',
    description:
      'Remake del clasico de terror: los dos protagonists se separan al entrar ' +
      'en la estacion de metro y se encuentran con el virus.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/883710/library_600x900.jpg',
    genres: ['Horror', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox One', 'PC'],
    releaseDate: '2019-01-25',
    metacriticScore: 93,
    qualityScore: 9,
    appId: '883710',
    regularPrice: 39.99,
    currentPrice: 11.99,
  },
  {
    igdbId: 900014,
    title: 'Resident Evil 4',
    slug: 'resident-evil-4',
    summary:
      'Leon Kennedy rescata a la hija del presidente en un pueblo espanol.',
    description:
      'Remake del terror en la peninsula iberica: Leon vuelve a las armas, esta ' +
      'vez con un companero, en un pueblo de infectados.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/2050650/library_600x900.jpg',
    genres: ['Horror', 'Action', 'Adventure'],
    platforms: ['PS4', 'PS5', 'Xbox Series X', 'PC'],
    releaseDate: '2023-03-24',
    metacriticScore: 94,
    qualityScore: 9.1,
    appId: '2050650',
    regularPrice: 39.99,
    currentPrice: 19.99,
  },
  {
    igdbId: 900015,
    title: 'God of War',
    slug: 'god-of-war',
    summary:
      'Kratos y Atreus viajan por el mundo Norse en busca del monte mas alto.',
    description:
      'El reboot de la saga: Kratos, ahora padre, recorre el mundo Norse ' +
      'acompanado de Atreus mientras busca el monte mas alto.',
    coverUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/1593500/library_600x900.jpg',
    genres: ['Action', 'Adventure', 'RPG'],
    platforms: ['PS4', 'PS5', 'PC'],
    releaseDate: '2022-01-14',
    metacriticScore: 95,
    qualityScore: 9.2,
    appId: '1593500',
    regularPrice: 39.99,
    currentPrice: 23.99,
  },
];

const FRANCHISE = {
  name: 'Like a Dragon',
  slug: 'like-a-dragon',
  description:
    'Saga de drama criminal en Japon. El hilo conductor es Kazuma ' +
    'Kiryu y la familia Majima, desde las calles de Kamurocho hasta los ' +
    'archipiélagos del mar de Palpa.',
  route: [
    {
      slug: 'yakuza-0',
      position: 1,
      note: 'Empieza aqui: cuenta como Kiryu se convierte en leyenda de Kamurocho.',
    },
    {
      slug: 'yakuza-1',
      position: 2,
      note: 'El origen de la saga y el inicio del viaje personal de Kiryu.',
    },
    {
      slug: 'yakuza-2',
      position: 3,
      note: 'Ryuji Goda y el comienzo de la faceta de Goro Majima.',
    },
    {
      slug: 'yakuza-3',
      position: 4,
      note: 'El regreso de Kiryu y la aparicion del Majima dual.',
    },
    {
      slug: 'yakuza-4',
      position: 5,
      note: 'Cuatro protagonistas y el conflicto entre clanes en Tokio.',
    },
    {
      slug: 'yakuza-5',
      position: 6,
      note: 'La guerra entre clanes y el regreso de Kiryu tras cinco anos.',
    },
    {
      slug: 'yakuza-6',
      position: 7,
      note: 'Espinela rural en un Japon reconstruido: el tono mas emocional.',
    },
    {
      slug: 'like-a-dragon-ishin',
      position: 8,
      note: 'Espinela en la era Meiji que explica el origen de Kiryu.',
    },
    {
      slug: 'like-a-dragon',
      position: 9,
      note: 'Isezaki Ichi: Kiryu entra en el mundo criminal moderno.',
    },
    {
      slug: 'like-a-dragon-infinite-wealth',
      position: 10,
      note: 'Kasuga y el archipielago: la saga cambia de protagonista.',
    },
  ] as SeedRouteEntry[],
};

/** Dias de historico generado por oferta. */
const HISTORY_DAYS = 30;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function discountOf(regular: number, current: number): number {
  if (regular <= 0) {
    return 0;
  }
  return round2(((regular - current) / regular) * 100);
}

/**
 * Serie diaria suave: el precio oscila alrededor del precio actual con una
 * amplitud del 4%. Es determinista (mismo seed, misma serie).
 */
function historyPrice(
  appId: string,
  dayIndex: number,
  current: number,
): number {
  const phase = (Number(appId) % 17) / 3;
  const drift = 0.04 * Math.sin(dayIndex / 3 + phase);
  const value = round2(current * (1 + drift));
  return value < 0 ? 0 : value;
}

async function upsertGame(client: PoolClient, game: SeedGame): Promise<string> {
  const existing = await client.query<{ id: string; igdb_id: string }>(
    `SELECT id, igdb_id FROM games WHERE slug = $1 OR igdb_id = $2 LIMIT 1`,
    [game.slug, game.igdbId],
  );

  if (existing.rowCount && existing.rows.length > 0) {
    await client.query(
      `UPDATE games
          SET title = $2,
              summary = $3,
              description = $4,
              cover_url = $5,
              genres = $6::jsonb,
              platforms = $7::jsonb,
              release_date = $8,
              metacritic_score = $9,
              quality_score = $10,
              updated_at = now()
        WHERE id = $1`,
      [
        existing.rows[0].id,
        game.title,
        game.summary,
        game.description,
        game.coverUrl,
        JSON.stringify(game.genres),
        JSON.stringify(game.platforms),
        game.releaseDate,
        game.metacriticScore,
        game.qualityScore,
      ],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO games (
        igdb_id, title, slug, summary, description, cover_url,
        genres, platforms, release_date, metacritic_score, quality_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
      RETURNING id`,
    [
      game.igdbId,
      game.title,
      game.slug,
      game.summary,
      game.description,
      game.coverUrl,
      JSON.stringify(game.genres),
      JSON.stringify(game.platforms),
      game.releaseDate,
      game.metacriticScore,
      game.qualityScore,
    ],
  );
  return inserted.rows[0].id;
}

async function upsertStoreProduct(
  client: PoolClient,
  gameId: string,
  game: SeedGame,
): Promise<string> {
  const discount = discountOf(game.regularPrice, game.currentPrice);
  const historicalLow = round2(game.currentPrice * 0.95);

  const result = await client.query<{ id: string }>(
    `INSERT INTO store_products (
        game_id, store_name, store_product_id, current_price, regular_price,
        discount_percent, currency, url, is_available, last_checked_at,
        historical_low_price
      ) VALUES ($1, 'steam', $2, $3, $4, $5, 'USD', $6, true, now(), $7)
      ON CONFLICT (store_name, store_product_id) DO UPDATE
        SET game_id = EXCLUDED.game_id,
            current_price = EXCLUDED.current_price,
            regular_price = EXCLUDED.regular_price,
            discount_percent = EXCLUDED.discount_percent,
            currency = EXCLUDED.currency,
            url = EXCLUDED.url,
            is_available = EXCLUDED.is_available,
            last_checked_at = EXCLUDED.last_checked_at,
            historical_low_price = EXCLUDED.historical_low_price,
            updated_at = now()
      RETURNING id`,
    [
      gameId,
      game.appId,
      game.currentPrice,
      game.regularPrice,
      discount,
      `https://store.steampowered.com/app/${game.appId}`,
      historicalLow,
    ],
  );
  return result.rows[0].id;
}

async function seedHistory(
  client: PoolClient,
  storeProductId: string,
  game: SeedGame,
): Promise<number> {
  let inserted = 0;
  const today = new Date();
  const end = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  for (let day = HISTORY_DAYS - 1; day >= 0; day -= 1) {
    const recordedAt = new Date(end - day * 24 * 60 * 60 * 1000);
    const price = historyPrice(game.appId, day, game.currentPrice);
    const discount = discountOf(game.regularPrice, price);
    const result = await client.query(
      `INSERT INTO price_history (
          store_product_id, price, regular_price, discount_percent, source, recorded_at
        ) VALUES ($1, $2, $3, $4, 'seed', $5)
        ON CONFLICT (store_product_id, recorded_at) DO NOTHING`,
      [storeProductId, price, game.regularPrice, discount, recordedAt],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function countRows(client: PoolClient, table: string): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table}`,
  );
  return result.rows[0].count;
}

async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'gorodeals',
    password: process.env.DB_PASSWORD ?? 'gorodeals',
    database: process.env.DB_NAME ?? 'gorodeals',
    max: 5,
  });

  const client = await pool.connect();
  const tables = [
    'games',
    'store_products',
    'price_history',
    'franchises',
    'franchise_play_order',
  ];

  console.log('Estado inicial:');
  for (const table of tables) {
    console.log(`  ${table}: ${await countRows(client, table)}`);
  }

  try {
    await client.query('BEGIN');

    const gameIds = new Map<string, string>();
    for (const game of GAMES) {
      gameIds.set(game.slug, await upsertGame(client, game));
    }

    const franchiseResult = await client.query<{ id: string }>(
      `INSERT INTO franchises (name, slug, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             updated_at = now()
       RETURNING id`,
      [FRANCHISE.name, FRANCHISE.slug, FRANCHISE.description],
    );
    const franchiseId = franchiseResult.rows[0].id;

    // La ruta se reconstruye de forma determinista: se borran las entradas
    // de esta saga y se vuelven a insertar en el orden recomendado.
    await client.query(
      `DELETE FROM franchise_play_order WHERE franchise_id = $1`,
      [franchiseId],
    );
    for (const entry of FRANCHISE.route) {
      const gameId = gameIds.get(entry.slug);
      if (!gameId) {
        throw new Error(
          `El juego "${entry.slug}" de la ruta no esta en el catalogo del seed`,
        );
      }
      await client.query(
        `INSERT INTO franchise_play_order (franchise_id, game_id, position, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (franchise_id, game_id) DO UPDATE
           SET position = EXCLUDED.position,
               note = EXCLUDED.note,
               updated_at = now()`,
        [franchiseId, gameId, entry.position, entry.note],
      );
    }

    let historyRows = 0;
    for (const game of GAMES) {
      const gameId = gameIds.get(game.slug) as string;
      const storeProductId = await upsertStoreProduct(client, gameId, game);
      historyRows += await seedHistory(client, storeProductId, game);
    }

    await client.query('COMMIT');

    console.log('\nSeed completado.');
    console.log(
      `  Filas de historico insertadas en esta ejecucion: ${historyRows}`,
    );
    console.log('Estado final:');
    for (const table of tables) {
      console.log(`  ${table}: ${await countRows(client, table)}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed fallido:', error);
  process.exitCode = 1;
});
