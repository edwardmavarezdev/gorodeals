/**
 * Sincronizacion de juegos de prueba contra el panel de administracion.
 *
 * El secreto de administracion NUNCA se incluye en el bundle: se pide al
 * usuario y se guarda solo en `sessionStorage` (se pierde al cerrar la pestaña).
 */

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './api';

const SECRET_STORAGE_KEY = 'gorodeals.adminSecret';

export interface SyncRequest {
  requested: {
    count: number;
    platforms: string[];
  };
  games: number;
  offers: number;
  history: number;
  durationMs: number;
  sources: Record<string, string>;
}

export class SyncError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

export function getStoredSecret(): string {
  try {
    return window.sessionStorage.getItem(SECRET_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeSecret(secret: string): void {
  try {
    window.sessionStorage.setItem(SECRET_STORAGE_KEY, secret);
  } catch {
    // Si sessionStorage no esta disponible, el secreto solo vive en memoria.
  }
}

export function clearStoredSecret(): void {
  try {
    window.sessionStorage.removeItem(SECRET_STORAGE_KEY);
  } catch {
    // sin accion
  }
}

export async function triggerRandomSync(
  secret: string,
  count = 10,
  platforms: string[] = ['steam', 'nintendo'],
): Promise<SyncRequest> {
  const params = new URLSearchParams();
  params.set('count', String(count));
  params.set('platforms', platforms.join(','));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/admin/sync/random?${params.toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'x-admin-secret': secret,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 5),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new SyncError('La sincronizacion tardo demasiado y se cancelo.', 0);
    }
    throw new SyncError('No se pudo contactar con la API.', 0);
  }

  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : raw.trim() || `Error ${response.status}`;
    throw new SyncError(`${response.status}: ${message}`, response.status);
  }

  return payload as SyncRequest;
}

export function formatSyncResult(result: SyncRequest): string {
  const parts = [
    `${result.games} juegos`,
    `${result.offers} ofertas`,
    `${result.history} registros de precio`,
  ];
  return parts.join(', ');
}
