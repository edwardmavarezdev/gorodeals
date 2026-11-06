/**
 * Cliente HTTP de la API GoRoDeals y tipos del contrato.
 *
 * La web es totalmente estatica: estas funciones se ejecutan en el navegador.
 * El build de Astro no las invoca, por lo que no depende de que la API este viva.
 */

export const API_BASE_URL: string = (
  import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

export const REQUEST_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/* Tipos del contrato                                                 */
/* ------------------------------------------------------------------ */

export interface Offer {
  storeName: string;
  storeProductId: string;
  currentPrice: number;
  regularPrice: number;
  discountPercent: number;
  currency: string;
  url: string;
  dealScore: number | null;
}

export interface CatalogItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  genres: string[];
  platforms: string[];
  releaseDate: string | null;
  metacriticScore: number | null;
  qualityScore: number | null;
  bestOffer: Offer | null;
}

export interface CatalogResponse {
  page: number;
  limit: number;
  total: number;
  items: CatalogItem[];
}

export interface HotDealsResponse {
  items: CatalogItem[];
}

export interface GameDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  screenshots: string[];
  genres: string[];
  platforms: string[];
  releaseDate: string | null;
  metacriticScore: number | null;
  qualityScore: number | null;
}

export interface GameOffer {
  storeName: string;
  storeProductId: string;
  currentPrice: number;
  regularPrice: number;
  discountPercent: number;
  currency: string;
  url: string;
  isAvailable: boolean;
  historicalLowPrice: number | null;
  dealScore: number | null;
  lastCheckedAt: string | null;
}

export interface PriceHistoryPoint {
  storeProductId: string;
  storeName: string;
  price: number;
  regularPrice: number;
  discountPercent: number;
  recordedAt: string;
}

export interface RouteEntry {
  position: number;
  note: string | null;
  game: {
    slug: string;
    title: string;
    coverUrl: string | null;
    releaseDate: string | null;
    qualityScore: number | null;
  };
}

export interface FranchiseRoute {
  name: string;
  slug: string;
  description: string | null;
  route: RouteEntry[];
}

export interface GameDetailResponse {
  game: GameDetail;
  offers: GameOffer[];
  priceHistory: PriceHistoryPoint[];
  franchise: FranchiseRoute | null;
}

export interface PriceHistorySeriesPoint {
  recordedAt: string;
  price: number;
  regularPrice: number;
  discountPercent: number;
}

export interface PriceHistoryResponse {
  storeProductId: string;
  points: PriceHistorySeriesPoint[];
}

export interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

export type CatalogSort = 'recent' | 'quality' | 'discount';
export type CatalogStore = 'steam' | 'gog' | 'epic';

/* ------------------------------------------------------------------ */
/* Errores                                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'No se pudo contactar con la API. Comprueba que este levantada y que PUBLIC_API_URL es correcta.';
    }
    return `La API respondio con un error (HTTP ${error.status}).`;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'La API no respondio a tiempo (tiempo de espera agotado).';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido al consultar la API.';
}

/* ------------------------------------------------------------------ */
/* Peticiones                                                          */
/* ------------------------------------------------------------------ */

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('Timeout esperando a la API', 0);
    }
    throw new ApiError('Fallo de red al consultar la API', 0);
  }

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status} en ${path}`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('La API devolvio una respuesta no valida', response.status);
  }
}

export function getCatalog(params: {
  page?: number;
  limit?: number;
  q?: string;
  sort?: CatalogSort;
  store?: CatalogStore;
}): Promise<CatalogResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 24));
  if (params.q) search.set('q', params.q);
  if (params.sort) search.set('sort', params.sort);
  if (params.store) search.set('store', params.store);
  return request<CatalogResponse>(`/catalog?${search.toString()}`);
}

export function getGame(slug: string): Promise<GameDetailResponse> {
  return request<GameDetailResponse>(`/games/${encodeURIComponent(slug)}`);
}

export function getPriceHistory(id: string, months = 12): Promise<PriceHistoryResponse> {
  return request<PriceHistoryResponse>(
    `/games/${encodeURIComponent(id)}/price-history?months=${months}`,
  );
}

export function getHottestDeals(limit = 20): Promise<HotDealsResponse> {
  return request<HotDealsResponse>(`/deals/hottest?limit=${limit}`);
}

export function getFranchiseRoute(slug: string): Promise<FranchiseRoute> {
  return request<FranchiseRoute>(`/franchises/${encodeURIComponent(slug)}/route`);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}
