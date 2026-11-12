/**
 * Script de carga de datos de prueba.
 *
 * Trae juegos aleatorios de Steam (PC) y de Nintendo Switch, crea/actualiza
 * el juego y su oferta en el catalogo y genera 30 dias de historico de
 * precios. Es idempotente: se puede ejecutar varias veces sin duplicar
 * juegos, ofertas ni filas de historico.
 *
 * Uso (desde `api/`):
 *
 * ```bash
 * npm run sync:random
 * npm run sync:random -- --pc=10 --switch=10 --seed=42
 * npm run sync:random -- --platforms=steam --count=5
 * npm run sync:random -- --new
 * ```
 *
 * Variables de entorno equivalentes: `SYNC_RANDOM_PC`, `SYNC_RANDOM_SWITCH`,
 * `SYNC_RANDOM_COUNT`, `SYNC_RANDOM_PLATFORMS`, `SYNC_RANDOM_SEED`.
 *
 * Por defecto se refrescan las ofertas ya gestionadas por la herramienta
 * (los que tienen `igdb_id` sintetico) y solo se buscan juegos aleatorios
 * nuevos cuando faltan para llegar al numero pedido. Con `--new` se eligen
 * siempre juegos nuevos.
 *
 * Fuentes de datos (ambas publicas, sin credenciales):
 * - Steam: `store.steampowered.com/search/results` (listado) y
 *   `store.steampowered.com/api/appdetails` (precio, un appid por llamada).
 * - Nintendo: `searching.nintendo-europe.com/en/select` (buscador Solr de la
 *   tienda). Si no responde, se usa la lista curada documentada en
 *   `src/sync/sync-random-games.service.ts`.
 *
 * El script conecta solo con PostgreSQL y con esas APIs publicas: la API
 * puede estar apagada.
 */
import { DataSource } from 'typeorm';
import { appConfig } from '../config.js';
import { dataSourceOptions } from '../database/data-source.js';
import { Game } from '../games/entities/game.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { PriceHistory } from '../prices/entities/price-history.entity.js';
import { SyncRandomGamesService } from '../sync/sync-random-games.service.js';
import { parseSyncPlatforms, SyncPlatform } from '../sync/sync.types.js';

interface CliOptions {
  /** Numero de juegos por tienda (salvo que se indique `--pc`/`--switch`). */
  count: number;
  platforms: SyncPlatform[];
  /** Numero especifico por tienda, si se indico. */
  perStore: Map<SyncPlatform, number>;
  seed?: number;
  /** Ignora las ofertas ya sincronizadas y anade solo juegos nuevos. */
  onlyNew?: boolean;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCliOptions(): CliOptions {
  const flags = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (match) {
      flags.set(match[1], match[2] ?? 'true');
    }
  }

  const count =
    parseNumber(flags.get('count')) ??
    parseNumber(process.env.SYNC_RANDOM_COUNT) ??
    10;

  const rawPlatforms =
    flags.get('platforms') ??
    process.env.SYNC_RANDOM_PLATFORMS ??
    'steam,nintendo';
  const platforms = parseSyncPlatforms(rawPlatforms);

  const perStore = new Map<SyncPlatform, number>();
  const pc =
    parseNumber(flags.get('pc')) ?? parseNumber(process.env.SYNC_RANDOM_PC);
  const switchCount =
    parseNumber(flags.get('switch')) ??
    parseNumber(process.env.SYNC_RANDOM_SWITCH);
  if (platforms.includes('steam') && pc !== undefined) {
    perStore.set('steam', pc);
  }
  if (platforms.includes('nintendo') && switchCount !== undefined) {
    perStore.set('nintendo', switchCount);
  }

  const seed =
    parseNumber(flags.get('seed')) ?? parseNumber(process.env.SYNC_RANDOM_SEED);

  return {
    count,
    platforms: platforms.length > 0 ? platforms : ['steam', 'nintendo'],
    perStore,
    ...(seed !== undefined ? { seed } : {}),
    ...(flags.get('new') !== undefined ? { onlyNew: true } : {}),
  };
}

async function main(): Promise<void> {
  const options = readCliOptions();

  // El CLI no levanta la API: abre solo la conexion de TypeORM y construye
  // el servicio a mano, igual que hace el grafo de servicios de Fastify.
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const service = new SyncRandomGamesService(
      dataSource.getRepository(Game),
      dataSource.getRepository(StoreProduct),
      dataSource.getRepository(PriceHistory),
      appConfig,
    );
    const total = {
      games: 0,
      offers: 0,
      history: 0,
      durationMs: 0,
      sources: {} as Record<string, string>,
    };

    if (options.perStore.size === 0) {
      const result = await service.run({
        count: options.count,
        platforms: options.platforms,
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
        ...(options.onlyNew !== undefined ? { onlyNew: options.onlyNew } : {}),
      });
      total.games += result.games;
      total.offers += result.offers;
      total.history += result.history;
      total.durationMs += result.durationMs;
      Object.assign(total.sources, result.sources);
    } else {
      for (const platform of options.platforms) {
        const result = await service.run({
          count: options.perStore.get(platform) ?? options.count,
          platforms: [platform],
          ...(options.seed !== undefined ? { seed: options.seed } : {}),
          ...(options.onlyNew !== undefined
            ? { onlyNew: options.onlyNew }
            : {}),
        });
        total.games += result.games;
        total.offers += result.offers;
        total.history += result.history;
        total.durationMs += result.durationMs;
        total.sources[platform] = result.sources[platform] ?? 'error';
      }
    }

    process.stdout.write(
      `Sincronizacion terminada: ${total.games} juegos, ${total.offers} ofertas, ` +
        `${total.history} filas de historico en ${total.durationMs} ms. ` +
        `Fuentes: ${JSON.stringify(total.sources)}\n`,
    );
    process.stdout.write(`${JSON.stringify(total, null, 2)}\n`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(
    'Fallo la sincronizacion de juegos de prueba:',
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
