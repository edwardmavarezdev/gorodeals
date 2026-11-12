#!/usr/bin/env node
/**
 * Verifica que una instancia de la API responde con la misma forma que los
 * fixtures de contrato.
 *
 * Uso:
 *   node tools/verify-fixtures.mjs <url-base> [fixture.json]
 *
 * Imprime una linea por endpoint con la diferencia encontrada, si la hay.
 */
import { readFile } from 'node:fs/promises';

const [, , baseUrl, fixtureArg] = process.argv;
if (!baseUrl) {
  console.error('Uso: node tools/verify-fixtures.mjs <url-base> [fixture.json]');
  process.exit(2);
}
const rutaFixture =
  fixtureArg ?? new URL('../test/fixtures/contract.json', import.meta.url).pathname;

function forma(valor) {
  if (valor === null) return { type: 'null' };
  if (Array.isArray(valor)) {
    return { type: 'array', items: valor.length > 0 ? forma(valor[0]) : null };
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

/** Primera diferencia entre dos formas, con su ruta. */
function diferencia(a, b, camino = '') {
  if (a.type !== b.type) {
    return `${camino || '/'}: tipo ${a.type} vs ${b.type}`;
  }
  if (a.type === 'object') {
    const claves = new Set([...Object.keys(a.keys), ...Object.keys(b.keys)]);
    for (const clave of claves) {
      if (!(clave in a.keys)) return `${camino}.${clave}: sobra en la respuesta`;
      if (!(clave in b.keys)) return `${camino}.${clave}: falta en la respuesta`;
      const d = diferencia(a.keys[clave], b.keys[clave], `${camino}.${clave}`);
      if (d) return d;
    }
  }
  if (a.type === 'array') {
    if ((a.items === null) !== (b.items === null)) {
      return `${camino}: una lista tiene elementos y la otra no`;
    }
    if (a.items && b.items) {
      return diferencia(a.items, b.items, `${camino}[]`);
    }
  }
  return null;
}

async function pedir(metodo, ruta, opciones = {}) {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      ...(opciones.body ? { 'content-type': 'application/json' } : {}),
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.adminSecret ? { 'x-admin-secret': opciones.adminSecret } : {}),
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

async function leerSecretos() {
  const contenido = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const mapa = new Map();
  for (const linea of contenido.split('\n')) {
    const coincide = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (coincide) mapa.set(coincide[1], coincide[2]);
  }
  return mapa;
}

const definicion = JSON.parse(await readFile(rutaFixture, 'utf8'));
// Los cuerpos y las marcas de las peticiones viven en `contract.json`: el
// fixture solo guarda la forma esperada de la respuesta.
const contrato = JSON.parse(
  await readFile(new URL('../test/contract.json', import.meta.url), 'utf8'),
);
const cuerpos = new Map(
  contrato.endpoints.map((e) => [`${e.method} ${e.path}`, e]),
);
const secretos = await leerSecretos();
const adminSecret =
  secretos.get('ADMIN_SYNC_SECRET') || secretos.get('IGDB_ADMIN_SECRET') || '';
const priceSyncSecret =
  secretos.get('PRICE_SYNC_ADMIN_SECRET') ||
  secretos.get('IGDB_ADMIN_SECRET') ||
  '';
const steamSecret =
  secretos.get('STEAM_ADMIN_SECRET') || secretos.get('IGDB_ADMIN_SECRET') || '';
const igdbSecret = secretos.get('IGDB_ADMIN_SECRET') || '';

const catalog = (await pedir('GET', '/catalog?limit=1')).cuerpo;
const franchises = (await pedir('GET', '/franchises')).cuerpo;
const publications = (await pedir('GET', '/publications')).cuerpo;
const steam = (await pedir('GET', '/steam/product/1091500')).cuerpo;
const igdb = (await pedir('GET', '/igdb/search?q=zelda&limit=1')).cuerpo;
const parametros = {
  gameSlug: catalog?.items?.[0]?.slug ?? 'no-existe',
  gameId: catalog?.items?.[0]?.id ?? '00000000-0000-0000-0000-000000000000',
  franchiseSlug: franchises?.[0]?.slug ?? 'no-existe',
  publicationSlug: publications?.items?.[0]?.slug ?? 'no-existe',
  storeProductId: steam?.id ?? '00000000-0000-0000-0000-000000000000',
  igdbId: String(igdb?.[0]?.igdbId ?? 1),
  appId: '1091500',
};

const email = `verify-${Date.now()}@example.com`;
const password = 'Contrasena1!';
await pedir('POST', '/auth/register', {
  body: { email, password, displayName: 'Verify' },
});
const login = await pedir('POST', '/auth/login', { body: { email, password } });
const token = login.cuerpo?.accessToken ?? null;
if (!token) {
  console.error(
    `No se pudo iniciar sesion con el usuario de prueba (estado ${login.status}).`,
  );
  process.exit(2);
}

let fallos = 0;
for (const entrada of definicion.endpoints) {
  const ruta = entrada.path.replace(/\{(\w+)\}/g, (_, clave) => parametros[clave] ?? '');
  const definicionEndpoint = cuerpos.get(`${entrada.method} ${entrada.path}`);
  const opciones = { body: definicionEndpoint?.body };
  // Las marcas de autenticacion y de administracion estan en `contract.json`.
  if (definicionEndpoint?.auth) opciones.token = token;
  if (definicionEndpoint?.admin) {
    if (ruta.startsWith('/price-sync')) opciones.adminSecret = priceSyncSecret;
    else if (ruta.startsWith('/steam')) opciones.adminSecret = steamSecret;
    else if (ruta.startsWith('/igdb')) opciones.adminSecret = igdbSecret;
    else opciones.adminSecret = adminSecret;
  }
  const { status, cuerpo } = await pedir(entrada.method, ruta, opciones);
  if (process.env.DEBUG_FIXTURES) {
    console.log(
      'DEBUG',
      entrada.method,
      ruta,
      status,
      'token=' + (opciones.token ? 'si' : 'no'),
      'adminHeader=' + (opciones.adminSecret ? 'si' : 'no'),
      JSON.stringify(cuerpo).slice(0, 160),
    );
  }

  const esperado = definicion.endpoints.find(
    (e) => e.method === entrada.method && e.path === entrada.path,
  );
  if (status !== esperado.status) {
    fallos += 1;
    console.log(
      `DIFIERE ${entrada.method} ${entrada.path}: estado ${esperado.status} vs ${status}`,
    );
    continue;
  }
  const d = diferencia(esperado.shape, forma(cuerpo));
  if (d) {
    fallos += 1;
    console.log(`DIFIERE ${entrada.method} ${entrada.path}: ${d}`);
  } else {
    console.log(`OK      ${entrada.method} ${entrada.path}`);
  }
}

console.log(
  fallos === 0
    ? `\nLa forma de los ${definicion.endpoints.length} endpoints coincide con los fixtures`
    : `\n${fallos} de ${definicion.endpoints.length} endpoints difieren`,
);
process.exit(fallos === 0 ? 0 : 1);
