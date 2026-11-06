/**
 * Utilidades de identificadores de Steam.
 *
 * El `SteamID64` es un entero de 64 bits. En JavaScript no cabe en `number`
 * sin perder precision, asi que se manipula siempre como `string` o `bigint`.
 * En la base de datos se almacena en `text`.
 */

/** Constante que Steam usa como base de las cuentas individuales. */
const STEAMID64_BASE = 76561197960265728n;

/**
 * Convierte un SteamID64 a SteamID2 (`STEAM_0:Y:Z`).
 * Solo tiene sentido para cuentas individuales de 32 bits.
 */
export function steamId64ToSteamId2(steamId64: string): string {
  const id = BigInt(steamId64);
  const accountId = id - STEAMID64_BASE;
  if (accountId < 0n) {
    throw new RangeError(`SteamID64 invalido: ${steamId64}`);
  }
  const y = (accountId >> 1n) & 0x7fffffffn;
  const z = accountId & 1n;
  return `STEAM_0:${y}:${z}`;
}

/**
 * Convierte un SteamID64 a SteamID3 (`[U:1:xxxxxxx]`).
 */
export function steamId64ToSteamId3(steamId64: string): string {
  const id = BigInt(steamId64);
  const accountId = id - STEAMID64_BASE;
  if (accountId < 0n) {
    throw new RangeError(`SteamID64 invalido: ${steamId64}`);
  }
  return `[U:1:${accountId}]`;
}

/**
 * Extrae el SteamID64 de una `claimed_id` o `identity` de OpenID.
 * Formato esperado: `https://steamcommunity.com/openid/id/<steamid64>`.
 */
export function extractSteamId64(openIdUrl: string): string | null {
  const match = /steamcommunity\.com\/openid\/id\/(\d+)/.exec(openIdUrl);
  return match ? match[1] : null;
}

/** URL del avatar de Steam a partir del SteamID64. */
export function steamAvatarUrl(steamId64: string): string {
  return `https://avatars.steamstatic.com/${steamId64}.jpg`;
}
