#!/usr/bin/env node
/**
 * Compara la respuesta de dos instancias de la API (por ejemplo, la de
 * NestJS y la de Fastify) endpoint por endpoint.
 *
 * Uso:
 *   node tools/compare-parity.mjs http://127.0.0.1:3031 http://127.0.0.1:3032
 *
 * No imprime ni un solo valor de respuesta: solo dice si coinciden. Asi no
 * se filtran tokens ni datos personales por la consola.
 */

const [, , baseA, baseB] = process.argv;

if (!baseA || !baseB) {
  console.error(
    'Uso: node tools/compare-parity.mjs <url-a> <url-b>',
  );
  process.exit(2);
}

/** Extrae los datos que se necesitan para construir las rutas de prueba. */
async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} respondio ${response.status}`);
  }
  return response.json();
}

/**
 * Normaliza un valor para comparar: ordena las claves de los objetos y
 * redondea los numeros a 6 decimales (las consultas a PostgreSQL pueden
 * devolver `numeric` con distinta precision en cada motor).
 */
function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalize(value[key]);
        return acc;
      }, {});
  }
  if (typeof value === 'number') {
    return Math.round(value * 1e6) / 1e6;
  }
  return value;
}

/** Compara dos estructuras y devuelve la ruta de la primera diferencia. */
function diff(a, b, path = '') {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return `${path || '/'}: uno es una lista y el otro no`;
    }
    if (a.length !== b.length) {
      return `${path || '/'}: distinto numero de elementos (${a.length} vs ${b.length})`;
    }
    for (let i = 0; i < a.length; i += 1) {
      const found = diff(a[i], b[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!(key in a)) return `${path}.${key}: falta en A`;
      if (!(key in b)) return `${path}.${key}: falta en B`;
      const found = diff(a[key], b[key], `${path}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return a === b ? null : `${path || '/'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

const catalog = await getJson(`${baseA}/catalog?limit=3`);
const franchises = await getJson(`${baseA}/franchises`);
const publications = await getJson(`${baseA}/publications`);

const gameSlug = catalog.items?.[0]?.slug;
const gameId = catalog.items?.[0]?.id;
const franchiseSlug = franchises?.[0]?.slug;
const publicationSlug = publications.items?.[0]?.slug;

/**
 * Rutas a comparar.
 *
 * Cada entrada es una cadena (GET sin cuerpo) o un objeto con el metodo, la
 * ruta, el cuerpo opcional y las claves que se ignoran al comparar (por
 * ejemplo, la marca de tiempo de `/health`).
 */
const paths = [
  { path: '/health', ignore: ['timestamp'] },
  '/catalog?page=1&limit=5',
  '/catalog?sort=discount&store=steam&limit=5',
  '/catalog?sort=quality&q=a&limit=5',
  '/deals/hottest?limit=5',
  '/deals/hottest',
  '/franchises',
  `/franchises/${franchiseSlug}/route`,
  `/games/${gameSlug}`,
  `/games/${gameSlug}?months=6`,
  `/games/${gameId}/price-history`,
  `/games/${gameId}/price-history?months=3`,
  '/publications',
  '/publications?limit=2&category=ruta',
  '/publications/categories',
  `/publications/${publicationSlug}`,
  '/price-sync/status',
  { method: 'POST', path: '/admin/sync/random?count=1&platforms=steam' },
  { method: 'GET', path: '/auth/me' },
  { method: 'POST', path: '/auth/login', body: { email: 'nadie@example.com', password: 'Contrasena1!' } },
  { method: 'POST', path: '/auth/register', body: { email: 'no-es-un-email', password: 'corta', displayName: 'X' } },
  { method: 'GET', path: '/auth/google' },
  '/steam/app/1091500',
  '/steam/product/1091500',
  '/igdb/search?q=zelda&limit=3',
];

let failures = 0;
for (const entry of paths) {
  const {
    path,
    method = 'GET',
    body,
    ignore = [],
  } = typeof entry === 'string' ? { path: entry } : entry;

  const request = (base) =>
    fetch(`${base}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });

  const [responseA, responseB] = await Promise.all([
    request(baseA),
    request(baseB),
  ]);

  if (responseA.status !== responseB.status) {
    failures += 1;
    console.log(
      `DIFIERE ${method} ${path}: estado ${responseA.status} vs ${responseB.status}`,
    );
    continue;
  }

  const strip = (value) => {
    const normalized = normalize(value);
    if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
      for (const key of ignore) {
        delete normalized[key];
      }
    }
    return normalized;
  };

  const bodyA = strip(await responseA.json());
  const bodyB = strip(await responseB.json());
  const difference = diff(bodyA, bodyB);

  if (difference) {
    failures += 1;
    console.log(`DIFIERE ${method} ${path}: ${difference}`);
  } else {
    console.log(`OK      ${method} ${path}`);
  }
}

console.log(
  failures === 0
    ? `\nParidad completa: ${paths.length} endpoints coinciden`
    : `\n${failures} de ${paths.length} endpoints difieren`,
);
process.exit(failures === 0 ? 0 : 1);
