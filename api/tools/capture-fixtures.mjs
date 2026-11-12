#!/usr/bin/env node
/**
 * Captura los fixtures de contrato (golden JSON) de la API.
 *
 * Uso:
 *   node tools/capture-fixtures.mjs <url-base> [fichero-salida]
 *
 * Los fixtures se capturaron del backend de NestJS antes de retirarlo, de
 * modo que guardan la forma exacta de la respuesta: el mismo estado, las
 * mismas claves y los mismos tipos. Desde la retirada de NestJS el fichero
 * esta congelado: solo se regenera si el contrato cambia de verdad.
 *
 * El fixture NO guarda valores, solo la *forma* de la respuesta: el tipo de
 * cada campo y, en los objetos, la lista de claves. Asi el fixture no
 * depende de los datos del momento (precios, marcas de tiempo, ids) y el
 * test puede compararlo contra cualquier base de datos.
 *
 * No imprime tokens ni contrasenas: las credenciales de prueba se manejan
 * enteramente en el proceso.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [, , baseUrl, salidaArg] = process.argv;
if (!baseUrl) {
  console.error('Uso: node tools/capture-fixtures.mjs <url-base> [salida]');
  process.exit(2);
}
const salida = resolve(
  salidaArg ?? new URL('../test/fixtures/contract.json', import.meta.url).pathname,
);

/** Secretos de administracion tomados del `.env` de desarrollo. */
async function leerSecretos() {
  const contenido = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const mapa = new Map();
  for (const linea of contenido.split('\n')) {
    const coincide = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (coincide) mapa.set(coincide[1], coincide[2]);
  }
  return mapa;
}

/**
 * Describe la forma de un valor: el tipo y, si es un objeto, las claves con
 * la forma de su valor. Las listas se describen por su primer elemento.
 */
function forma(valor) {
  if (valor === null) return { type: 'null' };
  if (Array.isArray(valor)) {
    return {
      type: 'array',
      items: valor.length > 0 ? forma(valor[0]) : null,
    };
  }
  switch (typeof valor) {
    case 'object':
      return {
        type: 'object',
        keys: Object.keys(valor)
          .sort()
          .reduce((acc, key) => {
            acc[key] = forma(valor[key]);
            return acc;
          }, {}),
      };
    case 'number':
      return { type: 'number' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: typeof valor };
  }
}

async function pedir(metodo, ruta, opciones = {}) {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      ...(opciones.body ? { 'content-type': 'application/json' } : {}),
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.adminSecret
        ? { 'x-admin-secret': opciones.adminSecret }
        : {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    redirect: 'manual',
  });
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  return { status: respuesta.status, cuerpo };
}

/** Resuelve los parametros dinamicos con datos reales de la base. */
async function resolverParametros() {
  const catalog = (await pedir('GET', '/catalog?limit=1')).cuerpo;
  const franchises = (await pedir('GET', '/franchises')).cuerpo;
  const publications = (await pedir('GET', '/publications')).cuerpo;

  const item = catalog?.items?.[0];
  const steam = (await pedir('GET', '/steam/product/1091500')).cuerpo;
  const igdb = (await pedir('GET', '/igdb/search?q=zelda&limit=1')).cuerpo;

  return {
    gameSlug: item?.slug ?? 'no-existe',
    gameId: item?.id ?? '00000000-0000-0000-0000-000000000000',
    franchiseSlug: franchises?.[0]?.slug ?? 'no-existe',
    publicationSlug: publications?.items?.[0]?.slug ?? 'no-existe',
    storeProductId: steam?.id ?? '00000000-0000-0000-0000-000000000000',
    igdbId: String(igdb?.[0]?.igdbId ?? 1),
    appId: '1091500',
  };
}

/** Sustituye los marcadores de la ruta por valores reales. */
function resolverRuta(ruta, parametros) {
  return ruta.replace(/\{(\w+)\}/g, (_, clave) => parametros[clave] ?? '');
}

async function main() {
  const secretos = await leerSecretos();
  const adminSecret =
    secretos.get('ADMIN_SYNC_SECRET') ||
    secretos.get('IGDB_ADMIN_SECRET') ||
    '';
  const priceSyncSecret =
    secretos.get('PRICE_SYNC_ADMIN_SECRET') ||
    secretos.get('IGDB_ADMIN_SECRET') ||
    '';
  const steamSecret =
    secretos.get('STEAM_ADMIN_SECRET') || secretos.get('IGDB_ADMIN_SECRET') || '';
  const igdbSecret = secretos.get('IGDB_ADMIN_SECRET') || '';

  const parametros = await resolverParametros();

  // Sesion de prueba: se registra un usuario temporal. Sus credenciales y sus
  // tokens no salen del proceso: solo se usan para las rutas autenticadas.
  const email = `fixtures-${Date.now()}@example.com`;
  const password = 'Contrasena1!';
  const registro = await pedir('POST', '/auth/register', {
    body: { email, password, displayName: 'Fixtures' },
  });
  const login = await pedir('POST', '/auth/login', {
    body: { email, password },
  });
  const token = login.cuerpo?.accessToken ?? null;
  if (!token) {
    throw new Error(
      `No se pudo iniciar sesion con el usuario de prueba (estado ${login.status}).`,
    );
  }
  if (!token) {
    throw new Error(
      'No se pudo iniciar sesion con el usuario de prueba: ' +
        `estado ${login.status}.`,
    );
  }

  const definicion = JSON.parse(
    await readFile(new URL('../test/contract.json', import.meta.url), 'utf8'),
  );

  const resultados = [];
  for (const entrada of definicion.endpoints) {
    const ruta = resolverRuta(entrada.path, parametros);
    const opciones = { body: entrada.body };
    if (entrada.auth) opciones.token = token;
    if (entrada.admin) {
      if (ruta.startsWith('/price-sync')) opciones.adminSecret = priceSyncSecret;
      else if (ruta.startsWith('/steam')) opciones.adminSecret = steamSecret;
      else if (ruta.startsWith('/igdb')) opciones.adminSecret = igdbSecret;
      else opciones.adminSecret = adminSecret;
    }
    const { status, cuerpo } = await pedir(entrada.method, ruta, opciones);
    resultados.push({
      method: entrada.method,
      path: entrada.path,
      status,
      shape: forma(cuerpo),
    });
  }

  await mkdir(dirname(salida), { recursive: true });
  await writeFile(
    salida,
    `${JSON.stringify(
      {
        description:
          'Fixtures de contrato: forma de la respuesta de cada endpoint ' +
          '(estado, claves y tipos). Capturados del backend de NestJS.',
        endpoints: resultados,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    `Capturados ${resultados.length} endpoints en ${salida} ` +
      `(registro de prueba: ${registro.status}, login: ${login.status})`,
  );
}

await main();
