/**
 * Cliente de la lista de deseos.
 *
 * Todos los endpoints requieren sesion iniciada: se usan `authRequest` para
 * que el token se renueve solo cuando caduca.
 */

import { authRequest } from './auth';

export interface WishlistItem {
  id: string;
  gameId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  store: string | null;
  storeItemId: string | null;
  note: string | null;
  createdAt: string;
}

export interface WishlistResponse {
  page: number;
  limit: number;
  total: number;
  items: WishlistItem[];
}

export function getWishlist(params: {
  page?: number;
  limit?: number;
  store?: string;
} = {}): Promise<WishlistResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 24));
  if (params.store) search.set('store', params.store);
  return authRequest<WishlistResponse>(`/wishlist?${search.toString()}`);
}

export function addToWishlist(input: {
  gameId?: string;
  slug?: string;
  store?: string;
  note?: string;
}): Promise<WishlistItem> {
  const body: Record<string, string> = {};
  if (input.gameId) body.gameId = input.gameId;
  if (input.slug) body.slug = input.slug;
  if (input.store) body.store = input.store;
  if (input.note) body.note = input.note;
  return authRequest<WishlistItem>('/wishlist', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function removeFromWishlist(gameId: string): Promise<void> {
  return authRequest<void>(`/wishlist/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
  });
}

export interface WishlistSyncResult {
  store: string;
  status: 'ok' | 'not_configured';
  imported: number;
  exported: number;
  message: string;
}

/** Sincroniza la lista con una tienda externa. */
export function syncWishlist(store: string): Promise<WishlistSyncResult> {
  return authRequest<WishlistSyncResult>(
    `/wishlist/sync/${encodeURIComponent(store)}`,
    { method: 'POST' },
  );
}
