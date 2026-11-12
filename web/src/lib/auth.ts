/**
 * Cliente de autenticacion del frontend.
 *
 * La web es estatica: el estado de sesion vive en `localStorage` y los
 * tokens viajan en la cabecera `Authorization: Bearer`. El access token es
 * de corta duracion, asi que se renueva con el refresh token cuando la API
 * responde 401.
 */

import { API_BASE_URL, describeError, request } from './api';

const ACCESS_TOKEN_KEY = 'gorodeals.accessToken';
const REFRESH_TOKEN_KEY = 'gorodeals.refreshToken';
const USER_KEY = 'gorodeals.user';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  providers: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

/** Callback invocado cuando la sesion deja de ser valida. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function storeSession(response: AuthResponse): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Ejecuta una peticion autenticada. Si la API responde 401, renueva el
 * access token con el refresh token y reintenta una sola vez.
 */
export async function authRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error(describeError(error));
  }

  if (response.status === 401 && retry && getRefreshToken()) {
    const renewed = await renewSession();
    if (renewed) {
      return authRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join('. ');
      else if (body.message) message = body.message;
    } catch {
      // La respuesta no traia JSON: se deja el mensaje generico.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Renueva el access token usando el refresh token. */
async function renewSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    storeSession(response);
    return true;
  } catch {
    clearSession();
    onSessionExpired?.();
    return false;
  }
}

export function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(): Promise<AuthUser> {
  return authRequest<AuthUser>('/auth/me');
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await authRequest<{ revoked: number }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Si la API no responde, la sesion local se borra igualmente.
  }
  clearSession();
}

export async function logoutAll(): Promise<void> {
  try {
    await authRequest<{ revoked: number }>('/auth/logout-all', { method: 'POST' });
  } catch {
    // Idem: la sesion local se limpia siempre.
  }
  clearSession();
}

/** URL de inicio del login social con Google. */
export function googleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google`;
}

/** URL de inicio del login social con Steam. */
export function steamLoginUrl(): string {
  return `${API_BASE_URL}/auth/steam`;
}

/**
 * Canjea el codigo de traspaso de un login social por la sesion.
 *
 * El callback de Google o de Steam redirige a `/cuenta?social=<codigo>`.
 * El codigo es de un solo uso y caduca a los dos minutos: los tokens no
 * viajan nunca en la URL.
 */
export function exchangeSocialCode(code: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/social/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
