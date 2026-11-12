/**
 * Moneda ISO 4217 que publica la tienda de Steam en cada region, indexada
 * por codigo de pais (`STEAM_COUNTRY_CODE`). Los codigos no listados usan
 * USD como valor por defecto.
 */
const STEAM_CURRENCY_BY_COUNTRY_CODE: Record<string, string> = {
  us: 'USD',
  ca: 'CAD',
  mx: 'MXN',
  br: 'BRL',
  ar: 'ARS',
  cl: 'CLP',
  es: 'EUR',
  fr: 'EUR',
  de: 'EUR',
  it: 'EUR',
  pt: 'EUR',
  nl: 'EUR',
  be: 'EUR',
  at: 'EUR',
  fi: 'EUR',
  ie: 'EUR',
  uk: 'GBP',
  ru: 'RUB',
  pl: 'PLN',
  cz: 'CZK',
  tr: 'TRY',
  ua: 'UAH',
  se: 'SEK',
  no: 'NOK',
  dk: 'DKK',
  ch: 'CHF',
  jp: 'JPY',
  kr: 'KRW',
  cn: 'CNY',
  tw: 'TWD',
  th: 'THB',
  id: 'IDR',
  my: 'MYR',
  sg: 'SGD',
  in: 'INR',
  au: 'AUD',
  nz: 'NZD',
  za: 'ZAR',
};

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    poolMax: number;
    poolIdleTimeoutMs: number;
    poolConnectionTimeoutMs: number;
  };
  igdb: {
    clientId: string;
    clientSecret: string;
    adminSecret: string;
    apiUrl: string;
    tokenUrl: string;
    timeoutMs: number;
  };
  steam: {
    /**
     * RESERVADO para la Fase 4 (OpenID de Steam). Hoy no lo consume ningun
     * modulo: la API publica de la tienda no necesita clave.
     */
    apiKey: string;
    /**
     * RESERVADO para la Fase 4 (OpenID de Steam): realm de retorno de Steam.
     * Hoy no lo consume ningun modulo.
     */
    realmUri: string;
    baseUrl: string;
    countryCode: string;
    language: string;
    timeoutMs: number;
    maxRetries: number;
    cacheTtlMs: number;
    batchSize: number;
    concurrency: number;
    interBatchDelayMs: number;
    cacheMaxEntries: number;
    adminSecret: string;
    /** Moneda ISO 4217 de cada region de Steam, indexada por codigo de pais. */
    currencyByCountryCode: Record<string, string>;
  };
  priceSync: {
    cron: string;
    enabled: boolean;
    batchSize: number;
    storeNames: string;
    adminSecret: string;
    catalogPages: number;
    lockTimeoutSeconds: number;
    requestDelayMs: number;
    /**
     * Umbral (0-1) de fallos TECNICOS por lote a partir del cual se aborta
     * el ciclo de la tienda. Un fallo tecnico (Steam caido, 403 por abuso,
     * sin red) NO marca el catalogo como no disponible: solo un "sin datos"
     * real lo hace.
     */
    maxFailureRate: number;
  };
  adminSync: {
    /**
     * Secreto del endpoint `POST /admin/sync/random`. Si se omite, se
     * reutiliza `IGDB_ADMIN_SECRET`; sin ninguno, el endpoint queda cerrado
     * (403).
     */
    secret: string;
    /** Numero de juegos por tienda en la sincronizacion de prueba. */
    count: number;
    /** Tiendas incluidas en la sincronizacion de prueba, por defecto. */
    platforms: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUri: string;
  };
  auth: {
    /**
     * Secreto de firma del access token (JWT). Vacio significa "sin
     * configurar": en produccion el arranque falla y en desarrollo se
     * genera uno efimero con un aviso en el log.
     */
    jwtSecret: string;
    /** Vida del access token, en notacion de duracion (`15m`, `1h`). */
    accessTtl: string;
    /** Vida del refresh token, en notacion de duracion (`30d`). */
    refreshTtl: string;
    /**
     * Origenes a los que se puede redirigir tras un login social. Lista
     * separada por comas. Es la allowlist de `redirect_uri` del frontend.
     */
    frontendUrl: string;
    /** Origenes permitidos como `redirect_uri` de Google OAuth. */
    googleRedirectAllowlist: string[];
    /** Realm de retorno de Steam OpenID 2.0. */
    steamRealm: string;
    /** URL publica de la clave RSA de Steam para validar OpenID. */
    steamOpenIdKeyUrl: string;
    /** URL del endpoint OpenID 2.0 de Steam. */
    steamOpenIdUrl: string;
  };
  wishlist: {
    /** Credenciales de las tiendas externas con las que se sincroniza. */
    gog: { apiKey: string };
    nintendo: { apiKey: string };
  };
  cors: {
    /** Orígenes permitidos por CORS. Lista separada por comas. */
    origin: string[];
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'gorodeals',
    password: process.env.DB_PASSWORD ?? 'gorodeals',
    database: process.env.DB_NAME ?? 'gorodeals',
    ssl: process.env.DB_SSL === 'true',
    /**
     * Pool de conexiones de pg. El servidor PostgreSQL de desarrollo admite
     * 100 conexiones, asi que un maximo de 20 deja margen para el CLI de
     * migraciones y las sesiones de psql.
     */
    poolMax: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    poolIdleTimeoutMs: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000',
      10,
    ),
    poolConnectionTimeoutMs: parseInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? '5000',
      10,
    ),
  },
  igdb: {
    clientId: process.env.IGDB_CLIENT_ID ?? '',
    clientSecret: process.env.IGDB_CLIENT_SECRET ?? '',
    adminSecret: process.env.IGDB_ADMIN_SECRET ?? '',
    apiUrl: process.env.IGDB_API_URL ?? 'https://api.igdb.com/v4/games',
    tokenUrl: process.env.IGDB_TOKEN_URL ?? 'https://id.twitch.tv/oauth2/token',
    /**
     * Timeout de las peticiones a IGDB (token, API y renovacion). Sin el, un
     * socket colgado bloquea toda la cola de peticiones.
     */
    timeoutMs: parseInt(process.env.IGDB_TIMEOUT_MS ?? '10000', 10),
  },
  steam: {
    apiKey: process.env.STEAM_API_KEY ?? '',
    realmUri: process.env.STEAM_REALM_URI ?? 'http://localhost:3000',
    baseUrl:
      process.env.STEAM_API_BASE_URL ?? 'https://store.steampowered.com/api',
    /**
     * Region de referencia del catalogo. `us` publica precios en USD, que es
     * la moneda por defecto de `store_products`. `es` publica EUR.
     */
    countryCode: process.env.STEAM_COUNTRY_CODE ?? 'us',
    language: process.env.STEAM_LANGUAGE ?? 'es',
    timeoutMs: parseInt(process.env.STEAM_TIMEOUT_MS ?? '12000', 10),
    maxRetries: parseInt(process.env.STEAM_MAX_RETRIES ?? '3', 10),
    cacheTtlMs: parseInt(process.env.STEAM_CACHE_TTL_MS ?? '900000', 10),
    batchSize: parseInt(process.env.STEAM_BATCH_SIZE ?? '50', 10),
    concurrency: parseInt(process.env.STEAM_CONCURRENCY ?? '4', 10),
    interBatchDelayMs: parseInt(
      process.env.STEAM_INTER_BATCH_DELAY_MS ?? '250',
      10,
    ),
    /**
     * Tope de entradas de la cache en memoria del cliente de Steam. A 100k
     * appids el cache sin tope ocupaba ~174 MB y podia acabar en OOM.
     */
    cacheMaxEntries: parseInt(
      process.env.STEAM_CACHE_MAX_ENTRIES ?? '10000',
      10,
    ),
    /**
     * Secreto del endpoint `POST /steam/sync`. Si no se define (o se deja
     * vacio), se reutiliza `IGDB_ADMIN_SECRET`; si tampoco existe, el
     * endpoint queda cerrado.
     *
     * Se usa `||` y no `??` a proposito: `.env.example` declara
     * `STEAM_ADMIN_SECRET=` vacio, y con `??` ese valor vacio impediria el
     * fallback al secreto de IGDB.
     */
    adminSecret:
      process.env.STEAM_ADMIN_SECRET || process.env.IGDB_ADMIN_SECRET || '',
    /**
     * Moneda que publica Steam en cada region. Steam no publica
     * `price_overview` en los juegos gratis o sin precio en la region, y en
     * ese caso hay que deducir la moneda de la region en vez de fijar USD.
     */
    currencyByCountryCode: STEAM_CURRENCY_BY_COUNTRY_CODE,
  },
  priceSync: {
    /**
     * Expresion cron del sync diario de precios. El job se ejecuta siempre en
     * UTC para que el truncado al dia de `price_history` sea estable.
     */
    cron: process.env.PRICE_SYNC_CRON ?? '0 6 * * *',
    enabled: process.env.PRICE_SYNC_ENABLED !== 'false',
    batchSize: parseInt(process.env.PRICE_SYNC_BATCH_SIZE ?? '200', 10),
    /** Lista de tiendas sincronizadas, separadas por coma. */
    storeNames: process.env.PRICE_SYNC_STORE_NAMES ?? 'steam',
    /**
     * Secreto del endpoint de sincronizacion manual. Si no se define (o se
     * deja vacio), se reutiliza `IGDB_ADMIN_SECRET`.
     *
     * Se usa `||` y no `??` a proposito: `.env.example` declara
     * `PRICE_SYNC_ADMIN_SECRET=` vacio, y con `??` ese valor vacio
     * impediria el fallback al secreto de IGDB.
     */
    adminSecret:
      process.env.PRICE_SYNC_ADMIN_SECRET ||
      process.env.IGDB_ADMIN_SECRET ||
      '',
    /** Paginas de catalogo de IGDB a sincronizar antes de auditar precios. */
    catalogPages: parseInt(process.env.PRICE_SYNC_CATALOG_PAGES ?? '0', 10),
    /** Tiempo tras el cual un lock de sync se considera obsoleto. */
    lockTimeoutSeconds: parseInt(
      process.env.PRICE_SYNC_LOCK_TIMEOUT_SECONDS ?? '3600',
      10,
    ),
    /** Pausa entre peticiones consecutive a la API de la tienda. */
    requestDelayMs: parseInt(
      process.env.PRICE_SYNC_REQUEST_DELAY_MS ?? '50',
      10,
    ),
    /** Umbral de fallos tecnicos por lote que aborta el ciclo de la tienda. */
    maxFailureRate: parseFloat(
      process.env.PRICE_SYNC_MAX_FAILURE_RATE ?? '0.5',
    ),
  },
  adminSync: {
    /**
     * Se usa `||` y no `??` a proposito: `.env.example` declara
     * `ADMIN_SYNC_SECRET=` vacio y con `??` ese valor vacio impediria el
     * fallback al secreto de IGDB.
     */
    secret:
      process.env.ADMIN_SYNC_SECRET || process.env.IGDB_ADMIN_SECRET || '',
    /** Numero de juegos por tienda que se sincronizan por defecto. */
    count: parseInt(process.env.SYNC_RANDOM_COUNT ?? '10', 10),
    /** Tiendas sincronizadas por defecto (separadas por coma). */
    platforms: process.env.SYNC_RANDOM_PLATFORMS ?? 'steam,nintendo',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUri:
      process.env.GOOGLE_CALLBACK_URI ??
      'http://localhost:3000/auth/google/callback',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4321',
    /**
     * Allowlist de `redirect_uri` de Google OAuth. El valor tiene que estar
     * en la lista o el exchange del authorization code se rechaza.
     */
    googleRedirectAllowlist: (
      process.env.GOOGLE_REDIRECT_ALLOWLIST ??
      process.env.GOOGLE_CALLBACK_URI ??
      'http://localhost:3000/auth/google/callback'
    )
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    steamRealm: process.env.STEAM_REALM_URI ?? 'http://localhost:3000',
    steamOpenIdKeyUrl:
      process.env.STEAM_OPENID_KEY_URL ??
      'https://api.steampowered.com/SteamIDPubKey.pem',
    steamOpenIdUrl:
      process.env.STEAM_OPENID_URL ?? 'https://steamcommunity.com/openid/login',
  },
  wishlist: {
    gog: { apiKey: process.env.WISHLIST_GOG_API_KEY ?? '' },
    nintendo: { apiKey: process.env.WISHLIST_NINTENDO_API_KEY ?? '' },
  },
  cors: {
    /**
     * Orígenes permitidos por CORS. `CORS_ORIGIN` es una lista separada por
     * comas; vacio desactiva el navegador (la API sigue sirviendo curl).
     */
    origin: (process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  },
});
