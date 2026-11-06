import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../games/entities/game.entity.js';
import {
  StoreName,
  StoreProduct,
} from '../store-products/entities/store-product.entity.js';
import {
  PriceHistory,
  PriceHistorySource,
} from '../prices/entities/price-history.entity.js';
import {
  SyncCandidate,
  SyncPlatform,
  SyncRandomGamesOptions,
  SyncRandomGamesResult,
  SyncSource,
} from './sync.types.js';

/** Dias de historico generados por oferta. */
const HISTORY_DAYS = 30;

/**
 * Semilla por defecto de la seleccion de juegos. Es FIJA a proposito: la
 * sincronizacion debe ser idempotente, asi que dos ejecuciones seguidas
 * seleccionan exactamente los mismos juegos y solo actualizan las filas
 * existentes. Para obtener otra combinacion basta pasar `seed` (script) o
 * `?seed=` (endpoint).
 */
const DEFAULT_SEED = 20260101;

/**
 * Rango reservado de `igdb_id` sinteticos. IGDB real usa ids bajos; este
 * rango (9e12) no colisiona con los ids sembrados por otros agentes ni con
 * los que publicara IGDB en el futuro.
 */
const SYNTHETIC_IGDB_BASE: Record<SyncPlatform, number> = {
  steam: 9_000_000_000_000,
  nintendo: 9_500_000_000_000,
};

const STEAM_SEARCH_URL =
  'https://store.steampowered.com/search/results/?query&start={start}&count=50&cc={cc}&l={l}&infinite=1';
const STEAM_APPDETAILS_URL =
  'https://store.steampowered.com/api/appdetails?appids={appid}&cc={cc}&l={l}';
const NINTENDO_SEARCH_URL =
  'https://searching.nintendo-europe.com/en/select?q={q}&size=10&from=0&country={country}&locale={locale}&fq=type:GAME AND system_type:nintendoswitch';

/**
 * Palabras clave usadas para descubrir juegos de Switch en el buscador
 * publico de la tienda de Nintendo (endpoint `select`, formato Solr).
 * Se eligen al azar de esta lista para que cada ejecucion exploreTitles
 * distinto.
 */
const NINTENDO_QUERY_TERMS: readonly string[] = [
  'zelda',
  'mario',
  'pokemon',
  'animal crossing',
  'minecraft',
  'sonic',
  'street fighter',
  'elden ring',
  'hollow knight',
  'cyberpunk',
  'witcher',
  'red dead',
  'apex legends',
  'overwatch',
  'fortnite',
  'stardew valley',
  'hades',
  'portal',
  'halo',
  'doom',
  'mass effect',
  'final fantasy',
  'persona',
  'metroid',
  'kirby',
  'splatoon',
  'fire emblem',
  'xenoblade',
  'octopath',
  'dragon quest',
  'monster hunter',
  'resident evil',
  'silent hill',
  'nier automata',
  'death stranding',
  'ghost of tsushima',
  'assassins creed',
  'far cry',
  'borderlands',
  'valheim',
  'terraria',
  'cuphead',
  'celeste',
  'undertale',
  'sega',
  'kingdom hearts',
  'final fantasy xiv',
  'granblue',
  'ark survival',
  'no mans sky',
  'destiny',
  'warframe',
];

/** Lista curada de respaldo por si el buscador publico de Nintendo falla. */
const NINTENDO_CURATED: readonly {
  nsuid: string;
  title: string;
  price: number;
  discount: number;
  categories: string[];
}[] = [
  {
    nsuid: '70010000000127',
    title: 'Super Mario Odyssey',
    price: 49.99,
    discount: 0,
    categories: ['Plataformas', 'Aventura'],
  },
  {
    nsuid: '70010000000023',
    title: 'The Legend of Zelda: Breath of the Wild',
    price: 77.98,
    discount: 0,
    categories: ['Aventura', 'RPG'],
  },
  {
    nsuid: '70010000063715',
    title: 'The Legend of Zelda: Tears of the Kingdom',
    price: 59.99,
    discount: 0,
    categories: ['Aventura', 'RPG'],
  },
  {
    nsuid: '70010000130793',
    title: 'The Legend of Zelda: Ocarina of Time',
    price: 49.99,
    discount: 0,
    categories: ['Aventura'],
  },
  {
    nsuid: '70010000020034',
    title: "The Legend of Zelda: Link's Awakening",
    price: 49.99,
    discount: 0,
    categories: ['Aventura', 'RPG'],
  },
  {
    nsuid: '70010000014140',
    title: 'Untitled Goose Game',
    price: 17.99,
    discount: 0,
    categories: ['Puzles', 'Simulacion'],
  },
  {
    nsuid: '70010000013195',
    title: 'FINAL FANTASY VII',
    price: 12.79,
    discount: 60,
    categories: ['RPG'],
  },
  {
    nsuid: '70010000010581',
    title: 'FINAL FANTASY IX',
    price: 16.99,
    discount: 70,
    categories: ['RPG'],
  },
  {
    nsuid: '70010000006022',
    title: 'Hyrule Warriors: Definitive Edition',
    price: 49.99,
    discount: 0,
    categories: ['Accion'],
  },
  {
    nsuid: '70010000104188',
    title: 'Super Mario Galaxy',
    price: 33.99,
    discount: 0,
    categories: ['Plataformas'],
  },
  {
    nsuid: '70010000001076',
    title: 'Super Smash Bros. Ultimate',
    price: 74.99,
    discount: 0,
    categories: ['Lucha'],
  },
  {
    nsuid: '70010000001658',
    title: 'Animal Crossing: New Horizons',
    price: 59.99,
    discount: 0,
    categories: ['Simulacion', 'Social'],
  },
  {
    nsuid: '70010000000840',
    title: 'Splatoon 2',
    price: 49.99,
    discount: 0,
    categories: ['Shooters'],
  },
  {
    nsuid: '70010000001347',
    title: 'Fire Emblem: Three Houses',
    price: 59.99,
    discount: 0,
    categories: ['RPG', 'Estrategia'],
  },
  {
    nsuid: '70010000005722',
    title: 'Kirby and the Forgotten Land',
    price: 49.99,
    discount: 0,
    categories: ['Plataformas'],
  },
  {
    nsuid: '70010000000326',
    title: 'Metroid Dread',
    price: 59.99,
    discount: 0,
    categories: ['Accion', 'Aventura'],
  },
  {
    nsuid: '70010000001541',
    title: 'Bayonetta 3',
    price: 69.99,
    discount: 0,
    categories: ['Accion'],
  },
  {
    nsuid: '70010000001811',
    title: 'Xenoblade Chronicles 3',
    price: 69.99,
    discount: 0,
    categories: ['RPG'],
  },
  {
    nsuid: '70010000000874',
    title: 'Octopath Traveler II',
    price: 59.99,
    discount: 0,
    categories: ['RPG'],
  },
  {
    nsuid: '70010000004284',
    title: 'Minecraft',
    price: 29.99,
    discount: 0,
    categories: ['Simulacion', 'Aventura'],
  },
];

/** Respuesta cruda del buscador publico de Nintendo (subconjunto usado). */
interface NintendoSearchDoc {
  fs_id?: string;
  title?: string;
  url?: string;
  image_url?: string;
  excerpt?: string;
  product_catalog_description_s?: string;
  nsuid_txt?: string[];
  related_nsuids_txt?: string[];
  price_regular_f?: number;
  price_lowest_f?: number;
  price_discount_percentage_f?: number;
  pretty_game_categories_txt?: string[];
  game_categories_txt?: string[];
  dates_released_dts?: string[];
  publisher?: string;
  system_names_txt?: string[];
}

interface NintendoSearchResponse {
  response?: {
    numFound?: number;
    docs?: NintendoSearchDoc[];
  };
}

interface SteamSearchResponse {
  success?: number;
  total_count?: number;
  results_html?: string;
}

interface SteamAppDetailsResponse {
  success?: boolean;
  data?: {
    type?: string;
    name?: string;
    short_description?: string;
    detailed_description?: string;
    header_image?: string;
    capsule_image?: string;
    is_free?: boolean;
    genres?: { id: number; description: string }[];
    platforms?: Record<string, boolean>;
    release_date?: { coming_soon?: boolean; date?: string };
    metacritic?: { score?: number };
    recommendations?: { total?: number; total_positive?: number };
    price_overview?: {
      currency?: string;
      initial?: number;
      final?: number;
      discount_percent?: number;
    };
  };
}

/**
 * Servicio de carga de datos de prueba.
 *
 * Trae un numero configurable de juegos de Steam y de Nintendo Switch desde
 * APIs publicas (sin credenciales), crea/actualiza el juego y su oferta en el
 * catalogo y genera 30 dias de historico de precios. Es idempotente: repetir
 * la ejecucion no duplica juegos, ofertas ni filas de historico.
 *
 * Fuentes (verificadas con curl):
 * - Steam: `store.steampowered.com/search/results` (listado aleatorio) y
 *   `store.steampowered.com/api/appdetails` (un appid por llamada; el lote
 *   por comas responde HTTP 400).
 * - Nintendo: `searching.nintendo-europe.com/en/select` (Solr publico). El
 *   host estadounidense `searching.nintendo.com` no resuelve por DNS desde
 *   este entorno, y el europeo responde en EUR.
 */
@Injectable()
export class SyncRandomGamesService {
  private readonly logger = new Logger(SyncRandomGamesService.name);
  private readonly timeoutMs: number;

  constructor(
    @InjectRepository(Game)
    private readonly games: Repository<Game>,
    @InjectRepository(StoreProduct)
    private readonly storeProducts: Repository<StoreProduct>,
    @InjectRepository(PriceHistory)
    private readonly priceHistory: Repository<PriceHistory>,
    private readonly config: ConfigService,
  ) {
    this.timeoutMs = this.config.get<number>('steam.timeoutMs') ?? 12_000;
  }

  /**
   * Ejecuta la sincronizacion completa. Es la unica puerta de entrada: la
   * usan tanto el script de CLI como el endpoint de administracion.
   */
  async run(options: SyncRandomGamesOptions): Promise<SyncRandomGamesResult> {
    const startedAt = Date.now();
    const count = Math.max(1, Math.min(options.count, 100));
    const platforms = options.platforms.filter(
      (platform): platform is SyncPlatform =>
        platform === 'steam' || platform === 'nintendo',
    );
    const seed = options.seed ?? DEFAULT_SEED;
    const random = mulberry32(seed);

    const sources: Record<string, SyncSource> = {};
    let gamesCount = 0;
    let offersCount = 0;
    let historyCount = 0;

    for (const platform of platforms) {
      let candidates: SyncCandidate[] = [];
      let source: SyncSource = 'error';
      try {
        const built = await this.buildCandidates(
          platform,
          count,
          random,
          options.onlyNew === true,
        );
        candidates = built.candidates;
        source = built.source;
      } catch (error) {
        this.logger.error(
          `Fallo la obtencion de datos de ${platform}: ${describeError(error)}`,
        );
        sources[platform] = 'error';
        continue;
      }

      sources[platform] = source;
      for (const candidate of candidates) {
        const result = await this.persistCandidate(candidate);
        gamesCount += 1;
        offersCount += 1;
        historyCount += result.historyInserted;
      }
    }

    return {
      requested: { count, platforms },
      games: gamesCount,
      offers: offersCount,
      history: historyCount,
      durationMs: Date.now() - startedAt,
      sources,
    };
  }

  /**
   * Construye la lista de candidatos de una tienda.
   *
   * Se prioriza refrescar las ofertas que ya gestiona esta herramienta
   * (las que tienen `igdb_id` sintetico): repetir la sincronizacion actualiza
   * sus precios y NO anade filas nuevas, de modo que los conteos del
   * catalogo son estables. Solo se buscan juegos aleatorios nuevos cuando
   * hacen falta para reaching el numero pedido.
   */
  private async buildCandidates(
    platform: SyncPlatform,
    count: number,
    random: () => number,
    onlyNew = false,
  ): Promise<{ candidates: SyncCandidate[]; source: SyncSource }> {
    const managed = await this.findManagedProducts(platform);
    const keep = onlyNew ? [] : managed.slice(0, count);
    const missing = onlyNew ? count : count - keep.length;

    const refreshed = await this.refreshCandidates(platform, keep);
    const known = new Set(managed.map((product) => product.storeProductId));

    let fresh: SyncCandidate[] = [];
    let source: SyncSource = 'error';
    if (missing > 0) {
      if (platform === 'steam') {
        fresh = await this.fetchSteamCandidates(missing, random, known);
        source = fresh.length > 0 ? 'steam-search' : 'error';
      } else {
        const nintendo = await this.fetchNintendoCandidates(
          missing,
          random,
          known,
        );
        fresh = nintendo.candidates;
        source = nintendo.source;
      }
    } else {
      source = platform === 'steam' ? 'steam-search' : 'nintendo-api';
    }

    return { candidates: [...refreshed, ...fresh], source };
  }

  /**
   * Ofertas de la tienda que gestiona esta herramienta. Se distinguen por el
   * `igdb_id` sintetico del juego asociado (rango reservado).
   */
  private async findManagedProducts(
    platform: SyncPlatform,
  ): Promise<StoreProduct[]> {
    const base = SYNTHETIC_IGDB_BASE[platform];
    return this.storeProducts
      .createQueryBuilder('product')
      .innerJoin('product.game', 'game')
      .where('product.store_name = :storeName', {
        storeName: platform as StoreName,
      })
      .andWhere('game.igdb_id >= :base', { base: String(base) })
      .andWhere('game.igdb_id < :limit', {
        limit: String(base + 1_000_000_000),
      })
      .orderBy('product.store_product_id', 'ASC')
      .getMany();
  }

  /**
   * Vuelve a pedir el precio de las ofertas ya gestionadas. Para Steam se
   * consulta `appdetails`; para Nintendo se busca por titulo en el buscador
   * de la tienda (no hay consulta directa por NSUID). Si la tienda no
   * responde, se conservan los valores ya almacenados.
   */
  private async refreshCandidates(
    platform: SyncPlatform,
    products: StoreProduct[],
  ): Promise<SyncCandidate[]> {
    if (products.length === 0) {
      return [];
    }
    const cc = this.config.get<string>('steam.countryCode') ?? 'us';
    const language = this.config.get<string>('steam.language') ?? 'es';
    const candidates: SyncCandidate[] = [];

    for (const product of products) {
      const stored = await this.loadStoredCandidate(product);
      if (!stored) {
        continue;
      }
      let refreshed = stored;
      if (platform === 'steam') {
        const appId = Number(product.storeProductId);
        if (Number.isInteger(appId) && appId > 0) {
          const detail = await this.fetchSteamAppDetails(appId, cc, language);
          if (detail) {
            refreshed = { ...stored, ...detail };
          }
        }
      } else {
        const detail = await this.fetchNintendoByTitle(stored.title);
        if (detail) {
          refreshed = { ...stored, ...detail };
        }
      }
      candidates.push(refreshed);
    }
    return candidates;
  }

  /** Reconstruye un candidato con los valores ya persistidos. */
  private async loadStoredCandidate(
    product: StoreProduct,
  ): Promise<SyncCandidate | null> {
    const game = await this.games.findOne({ where: { id: product.gameId } });
    if (!game) {
      return null;
    }
    return {
      storeName: product.storeName as SyncPlatform,
      storeProductId: product.storeProductId,
      title: game.title,
      summary: game.summary,
      description: game.description,
      coverUrl: game.coverUrl,
      genres: game.genres,
      platforms: game.platforms,
      releaseDate: game.releaseDate,
      metacriticScore: game.metacriticScore,
      currentPrice: product.currentPrice,
      regularPrice: product.regularPrice,
      discountPercent: product.discountPercent,
      currency: product.currency,
      url: product.url ?? '',
      isAvailable: product.isAvailable,
      ratingPercent: null,
    };
  }

  // ---------------------------------------------------------------------
  // Fuentes externas
  // ---------------------------------------------------------------------

  /**
   * Busca juegos de PC en Steam: listado aleatorio (`search/results`) y
   * despues detalle y precio de cada appid (`api/appdetails`).
   */
  private async fetchSteamCandidates(
    count: number,
    random: () => number,
    exclude: Set<string> = new Set<string>(),
  ): Promise<SyncCandidate[]> {
    const cc = this.config.get<string>('steam.countryCode') ?? 'us';
    const language = this.config.get<string>('steam.language') ?? 'es';
    const appIds = new Set<number>();

    // El listado devuelve ~25-50 resultados por pagina; se barrenan varias
    // paginas aleatorias hasta tener suficientes appids validos. Se piden
    // mas de los necesarios porque despues se descartan los juegos gratuitos
    // (sin precio no aportan al catalogo de prueba).
    const wanted = count * 6;
    for (let attempt = 0; attempt < 8 && appIds.size < wanted; attempt++) {
      const start = Math.floor(random() * 200_000);
      const url = STEAM_SEARCH_URL.replace('{start}', String(start))
        .replace('{cc}', cc)
        .replace('{l}', language);
      const payload = await this.getJson<SteamSearchResponse>(url);
      const html = payload?.results_html ?? '';
      const matches = html.matchAll(
        /data-ds-appid="(\d+)"[\s\S]{0,2000}?<span class="title">([\s\S]*?)<\/span>/g,
      );
      for (const match of matches) {
        const appId = Number(match[1]);
        if (
          Number.isInteger(appId) &&
          appId > 0 &&
          !exclude.has(String(appId))
        ) {
          appIds.add(appId);
        }
      }
    }

    if (appIds.size === 0) {
      return [];
    }

    const candidates: SyncCandidate[] = [];
    for (const appId of shuffle(Array.from(appIds), random)) {
      if (candidates.length >= count) {
        break;
      }
      const candidate = await this.fetchSteamAppDetails(appId, cc, language);
      // Se descartan los juegos gratuitos: con precio 0 las graficas de
      // descuento no aportan nada al catalogo de prueba.
      if (candidate && candidate.currentPrice > 0) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  /** Detalle y precio de un appid de Steam (un appid por llamada). */
  private async fetchSteamAppDetails(
    appId: number,
    cc: string,
    language: string,
  ): Promise<SyncCandidate | null> {
    const url = STEAM_APPDETAILS_URL.replace('{appid}', String(appId))
      .replace('{cc}', cc)
      .replace('{l}', language);
    const payload =
      await this.getJson<Record<string, SteamAppDetailsResponse>>(url);
    const envelope = payload?.[String(appId)];
    if (!envelope || envelope.success !== true || !envelope.data) {
      return null;
    }
    const data = envelope.data;
    // Se descartan DLC, soundtracks y demos: el catalogo es de juegos.
    if (data.type !== undefined && data.type !== 'game') {
      return null;
    }
    const price = data.price_overview;
    const currentPrice = (price?.final ?? 0) / 100;
    const regularPrice = (price?.initial ?? price?.final ?? 0) / 100;
    const discountPercent = price?.discount_percent ?? 0;
    const recommendations = data.recommendations;
    const totalVotes = recommendations?.total ?? 0;
    const positiveVotes = recommendations?.total_positive;
    const ratingPercent =
      positiveVotes !== undefined && totalVotes > 0
        ? Number(((positiveVotes / totalVotes) * 100).toFixed(2))
        : null;

    return {
      storeName: 'steam',
      storeProductId: String(appId),
      title: (data.name ?? `Steam ${appId}`).trim(),
      summary: data.short_description ?? null,
      description: stripHtml(data.detailed_description ?? null),
      coverUrl: data.header_image ?? data.capsule_image ?? null,
      genres: (data.genres ?? []).map((genre) => genre.description),
      platforms: ['PC', ...steamPlatformLabels(data.platforms ?? {})],
      releaseDate: parseSteamReleaseDate(
        data.release_date?.date,
        data.release_date?.coming_soon,
      ),
      metacriticScore: data.metacritic?.score ?? null,
      currentPrice: round2(currentPrice),
      regularPrice: round2(regularPrice),
      discountPercent: round2(discountPercent),
      currency: price?.currency ?? 'USD',
      url: `https://store.steampowered.com/app/${appId}`,
      isAvailable: true,
      ratingPercent,
    };
  }

  /**
   * Busca un juego de Switch por titulo en el buscador publico. Se usa para
   * refrescar el precio de las ofertas ya sincronizadas (no hay consulta
   * directa por NSUID).
   */
  private async fetchNintendoByTitle(
    title: string,
  ): Promise<Partial<SyncCandidate> | null> {
    const url = NINTENDO_SEARCH_URL.replace('{q}', encodeURIComponent(title))
      .replace('{country}', 'DE')
      .replace('{locale}', 'en-US');
    const payload = await this.getJson<NintendoSearchResponse>(url);
    const docs = payload?.response?.docs ?? [];
    for (const doc of docs) {
      const nsuid = (doc.nsuid_txt ?? [])
        .concat(doc.related_nsuids_txt ?? [])
        .find((value) => /^7001\d+$/.test(value));
      const regular = doc.price_regular_f;
      if (!nsuid || !regular || regular <= 0) {
        continue;
      }
      const discount = doc.price_discount_percentage_f ?? 0;
      return {
        currentPrice: round2(regular * (1 - discount / 100)),
        regularPrice: round2(regular),
        discountPercent: round2(discount),
        title: (doc.title ?? title).trim(),
        coverUrl: doc.image_url ?? null,
        summary: doc.excerpt ?? doc.product_catalog_description_s ?? null,
        genres: doc.pretty_game_categories_txt ?? doc.game_categories_txt ?? [],
        releaseDate: (doc.dates_released_dts ?? [])[0]?.slice(0, 10) ?? null,
      };
    }
    return null;
  }

  /**
   * Descarga juegos de Switch del buscador publico de la tienda de Nintendo.
   * Si el buscador no responde o no devuelve nada utilizable, se recurre a la
   * lista curada documentada (`NINTENDO_CURATED`).
   */
  private async fetchNintendoCandidates(
    count: number,
    random: () => number,
    exclude: Set<string> = new Set<string>(),
  ): Promise<{ candidates: SyncCandidate[]; source: SyncSource }> {
    const country = 'DE';
    const locale = 'en-US';
    const terms = shuffle([...NINTENDO_QUERY_TERMS], random);
    const byNsuid = new Map<string, SyncCandidate>();

    for (const term of terms) {
      if (byNsuid.size >= count * 3) {
        break;
      }
      const url = NINTENDO_SEARCH_URL.replace('{q}', encodeURIComponent(term))
        .replace('{country}', country)
        .replace('{locale}', locale);
      let payload: NintendoSearchResponse | null = null;
      try {
        payload = await this.getJson<NintendoSearchResponse>(url);
      } catch (error) {
        this.logger.warn(
          `El buscador de Nintendo fallo para "${term}": ${describeError(error)}`,
        );
        continue;
      }
      const docs = payload?.response?.docs ?? [];
      for (const doc of docs) {
        const nsuid = (doc.nsuid_txt ?? [])
          .concat(doc.related_nsuids_txt ?? [])
          .find((value) => /^7001\d+$/.test(value));
        if (!nsuid || byNsuid.has(nsuid) || exclude.has(nsuid)) {
          continue;
        }
        const regular = doc.price_regular_f;
        if (!regular || regular <= 0) {
          continue;
        }
        const discount = doc.price_discount_percentage_f ?? 0;
        const current = round2(regular * (1 - discount / 100));
        byNsuid.set(nsuid, {
          storeName: 'nintendo',
          storeProductId: nsuid,
          title: (doc.title ?? `Nintendo ${nsuid}`).trim(),
          summary: doc.excerpt ?? doc.product_catalog_description_s ?? null,
          description: doc.product_catalog_description_s ?? doc.excerpt ?? null,
          coverUrl: doc.image_url ?? null,
          genres:
            doc.pretty_game_categories_txt ?? doc.game_categories_txt ?? [],
          platforms: ['Nintendo Switch'],
          releaseDate: (doc.dates_released_dts ?? [])[0]?.slice(0, 10) ?? null,
          metacriticScore: null,
          currentPrice: current,
          regularPrice: round2(regular),
          discountPercent: round2(discount),
          currency: 'EUR',
          url: doc.url
            ? `https://www.nintendo.com${doc.url}`
            : `https://www.nintendo.com/eu-gb/store/products/${nsuid}/`,
          isAvailable: true,
          ratingPercent: null,
        });
      }
    }

    if (byNsuid.size === 0) {
      this.logger.warn(
        'El buscador publico de Nintendo no devolvio juegos utilizables: se usa la lista curada.',
      );
      const curated = shuffle([...NINTENDO_CURATED], random)
        .slice(0, count)
        .map<SyncCandidate>((item) => ({
          storeName: 'nintendo',
          storeProductId: item.nsuid,
          title: item.title,
          summary: null,
          description: null,
          coverUrl: null,
          genres: item.categories,
          platforms: ['Nintendo Switch'],
          releaseDate: null,
          metacriticScore: null,
          currentPrice: round2(item.price * (1 - item.discount / 100)),
          regularPrice: round2(item.price),
          discountPercent: round2(item.discount),
          currency: 'EUR',
          url: `https://www.nintendo.com/eu-gb/store/products/${item.nsuid}/`,
          isAvailable: true,
          ratingPercent: null,
        }));
      return { candidates: curated, source: 'curated' };
    }

    const candidates = shuffle([...byNsuid.values()], random).slice(0, count);
    return { candidates, source: 'nintendo-api' };
  }

  // ---------------------------------------------------------------------
  // Persistencia
  // ---------------------------------------------------------------------

  /**
   * Crea o actualiza el juego y su oferta, y genera el historico.
   * Idempotente: las claves naturales son `games.igdb_id` y
   * `(store_products.store_name, store_products.store_product_id)`.
   */
  private async persistCandidate(candidate: SyncCandidate): Promise<{
    gameUpserted: boolean;
    historyInserted: number;
  }> {
    // Si el producto ya existe se reutiliza SIEMPRE su juego: la FK
    // `store_products.game_id` no se reescribe y no se crea un juego
    // duplicado para el mismo producto de tienda.
    const existingProduct = await this.storeProducts.findOne({
      where: {
        storeName: candidate.storeName as StoreName,
        storeProductId: candidate.storeProductId,
      },
    });
    let game = existingProduct
      ? await this.games.findOne({ where: { id: existingProduct.gameId } })
      : null;
    let gameCreated = false;

    if (!game) {
      const igdbId = await this.resolveIgdbId(candidate);
      game = await this.games.findOne({ where: { igdbId } });
      if (!game) {
        game = this.games.create({
          igdbId,
          title: candidate.title,
          slug: await this.resolveSlug(candidate),
          summary: candidate.summary,
          description: candidate.description,
          coverUrl: candidate.coverUrl,
          screenshots: [],
          genres: candidate.genres,
          platforms: candidate.platforms,
          releaseDate: candidate.releaseDate,
          metacriticScore: candidate.metacriticScore,
          qualityScore: estimateQualityScore(candidate),
        });
        await this.games.save(game);
        gameCreated = true;
      }
    }

    if (!gameCreated) {
      game.title = candidate.title;
      game.summary = candidate.summary ?? game.summary;
      game.description = candidate.description ?? game.description;
      game.coverUrl = candidate.coverUrl ?? game.coverUrl;
      game.genres =
        candidate.genres.length > 0 ? candidate.genres : game.genres;
      game.platforms =
        candidate.platforms.length > 0 ? candidate.platforms : game.platforms;
      game.releaseDate = candidate.releaseDate ?? game.releaseDate;
      game.metacriticScore = candidate.metacriticScore ?? game.metacriticScore;
      game.qualityScore = estimateQualityScore(candidate);
      await this.games.save(game);
    }

    const storeName = candidate.storeName as StoreName;
    let product = await this.storeProducts.findOne({
      where: { storeName, storeProductId: candidate.storeProductId },
    });

    if (!product) {
      product = this.storeProducts.create({
        gameId: game.id,
        storeName,
        storeProductId: candidate.storeProductId,
        currentPrice: candidate.currentPrice,
        regularPrice: candidate.regularPrice,
        discountPercent: candidate.discountPercent,
        currency: candidate.currency,
        url: candidate.url,
        isAvailable: candidate.isAvailable,
        lastCheckedAt: new Date(),
        historicalLowPrice: candidate.currentPrice,
        dealScore: estimateQualityScore(candidate),
      });
      await this.storeProducts.save(product);
    } else {
      product.gameId = game.id;
      product.currentPrice = candidate.currentPrice;
      product.regularPrice = candidate.regularPrice;
      product.discountPercent = candidate.discountPercent;
      product.currency = candidate.currency;
      product.url = candidate.url;
      product.isAvailable = candidate.isAvailable;
      product.lastCheckedAt = new Date();
      product.historicalLowPrice = Math.min(
        product.historicalLowPrice ?? candidate.currentPrice,
        candidate.currentPrice,
      );
      product.dealScore = estimateQualityScore(candidate);
      await this.storeProducts.save(product);
    }

    const historyInserted = await this.insertHistory(product, candidate);
    return { gameUpserted: gameCreated, historyInserted };
  }

  /**
   * Inserta 30 dias de historico (variacion diaria suave) con
   * `ON CONFLICT (store_product_id, recorded_at) DO NOTHING`, de modo que la
   * segunda ejecucion no anade filas nuevas.
   */
  private async insertHistory(
    product: StoreProduct,
    candidate: SyncCandidate,
  ): Promise<number> {
    const rows: {
      storeProductId: string;
      price: number;
      regularPrice: number;
      discountPercent: number;
      source: string;
      recordedAt: Date;
    }[] = [];

    const today = startOfUtcDay(new Date());
    let price = candidate.currentPrice;
    // Se recorre el historico hacia atras: el precio de ayer se deriva del
    // de hoy con una variacion pequeña y determinista.
    for (let daysAgo = 0; daysAgo < HISTORY_DAYS; daysAgo++) {
      const recordedAt = new Date(
        today.getTime() - daysAgo * 24 * 60 * 60 * 1000,
      );
      if (daysAgo > 0) {
        const noise = mulberry32(
          hashString(`${product.storeProductId}:${recordedAt.toISOString()}`),
        )();
        const delta = (noise - 0.5) * 0.06;
        price = Math.max(0, price * (1 + delta));
      }
      const value = round2(price);
      const regular = candidate.regularPrice;
      const discount =
        regular > 0
          ? round2(
              Math.min(100, Math.max(0, ((regular - value) / regular) * 100)),
            )
          : 0;
      rows.push({
        storeProductId: product.id,
        price: value,
        regularPrice: regular,
        discountPercent: discount,
        source: PriceHistorySource.SYNC,
        recordedAt,
      });
    }

    if (rows.length === 0) {
      return 0;
    }

    const values: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, index) => {
      const offset = index * 6;
      values.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
      );
      params.push(
        row.storeProductId,
        row.price,
        row.regularPrice,
        row.discountPercent,
        row.source,
        row.recordedAt,
      );
    });

    // `RETURNING id` solo devuelve las filas realmente insertadas: las que
    // ya existian se descartan por el ON CONFLICT.
    const inserted = await this.priceHistory.query<unknown[]>(
      `INSERT INTO price_history
         (store_product_id, price, regular_price, discount_percent, source, recorded_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (store_product_id, recorded_at) DO NOTHING
       RETURNING id`,
      params,
    );
    return Array.isArray(inserted) ? inserted.length : 0;
  }

  /**
   * Calcula un `igdb_id` sintetico UNICO y estable por juego. Se apoya en el
   * hash del id de producto y comprueba contra la base de datos para no
   * violar el UNIQUE ni colisionar con los ids sembrados por otros agentes.
   */
  private async resolveIgdbId(candidate: SyncCandidate): Promise<string> {
    const base = SYNTHETIC_IGDB_BASE[candidate.storeName];
    const offset = hashString(candidate.storeProductId) % 900_000_000;
    let igdbId = String(base + offset);
    // El rango esta reservado para esta herramienta, pero si el id ya lo
    // ocupa OTRO juego (por ejemplo, sembrado por otra) se avanza hasta
    // encontrar uno libre.
    let attempt = 0;
    while (attempt < 50 && (await this.games.exists({ where: { igdbId } }))) {
      attempt += 1;
      igdbId = String(base + offset + attempt);
    }
    return igdbId;
  }

  /** Genera un slug normalizado y UNIQUE a partir del titulo. */
  private async resolveSlug(candidate: SyncCandidate): Promise<string> {
    const base =
      slugify(candidate.title).slice(0, 180) ||
      `${candidate.storeName}-${candidate.storeProductId}`;
    let slug = base;
    let suffix = 1;
    while (await this.games.exists({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  // ---------------------------------------------------------------------
  // Utilidades HTTP
  // ---------------------------------------------------------------------

  /** GET JSON con timeout y reintentos acotados ante fallo de red o 5xx. */
  private async getJson<T>(url: string): Promise<T | null> {
    const maxRetries = 2;
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': 'GoRoDeals/1.0 (catalogo de prueba)',
            accept: 'application/json,text/plain,*/*',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.ok) {
          this.logger.warn(`HTTP ${response.status} en ${url}`);
          return null;
        }
        const text = await response.text();
        return JSON.parse(text) as T;
      } catch (error) {
        lastError = error;
        await delay(300 * (attempt + 1));
      }
    }
    this.logger.warn(`Fallo la peticion a ${url}: ${describeError(lastError)}`);
    return null;
  }
}

// -----------------------------------------------------------------------
// Helpers puros
// -----------------------------------------------------------------------

/** Convierte el HTML de las fichas de Steam en texto plano. */
function stripHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text.length > 0 ? text.slice(0, 2000) : null;
}

function steamPlatformLabels(platforms: Record<string, boolean>): string[] {
  const labels: Record<string, string> = {
    windows: 'Windows',
    mac: 'macOS',
    linux: 'Linux',
  };
  return Object.entries(platforms)
    .filter(([, enabled]) => enabled === true)
    .map(([platform]) => labels[platform] ?? platform);
}

/**
 * La fecha de Steam viene en formato texto ("25 Oct, 2019"). Se convierte a
 * ISO; los juegos sin fecha ("Coming soon") se ignoran.
 */
function parseSteamReleaseDate(
  date: string | undefined,
  comingSoon: boolean | undefined,
): string | null {
  if (!date || comingSoon === true) {
    return null;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Calidad estimada 0-10: base por disponibilidad y valoracion, con bonuses
 * por descuento. Es una aproximacion para poder ordenar el catalogo.
 */
function estimateQualityScore(candidate: SyncCandidate): number {
  let score = 5;
  if (candidate.ratingPercent !== null) {
    score += ((candidate.ratingPercent - 70) / 30) * 2.5;
  }
  score += Math.min(2, candidate.discountPercent / 25);
  if (candidate.currentPrice <= 0) {
    score -= 1.5;
  }
  return round1(Math.min(10, Math.max(0, score)));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/** PRNG determinista (mulberry32) para que la semilla fije el resultado. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    const tmp = copy[index];
    copy[index] = copy[target];
    copy[target] = tmp;
  }
  return copy;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
