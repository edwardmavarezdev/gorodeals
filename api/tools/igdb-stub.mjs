/**
 * Stub local de Twitch Developer + IGDB v4.
 *
 * Permite ejercitar el modulo IgdbModule sin credenciales reales. Simula:
 *   - POST /oauth2/token  -> token de Twitch (mismo formato que id.twitch.tv)
 *   - POST /v4/games       -> catalogo de IGDB (mismo formato que api.igdb.com)
 *
 * Uso:
 *   npm run stub:igdb                 # escucha en 127.0.0.1:3100
 *   STUB_PORT=3200 npm run stub:igdb
 *
 * En api/.env hay que apuntar el modulo a este stub:
 *   IGDB_API_URL=http://127.0.0.1:3100/v4/games
 *   IGDB_TOKEN_URL=http://127.0.0.1:3100/oauth2/token
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 3100);
const HOST = process.env.STUB_HOST ?? '127.0.0.1';
const TOKEN = 'stub-access-token';

/**
 * Catalogo de ejemplo con la misma forma que devuelve IGDB v4. Los campos
 * exigidos por las queries Apicalypse del modulo son: id, name, slug, summary,
 * storyline, cover, screenshots, genres, platforms, first_release_date,
 * aggregated_rating, aggregated_rating_count, total_rating, total_rating_count,
 * rating y rating_count.
 */
const CATALOG = [
  {
    id: 1020,
    name: 'Grand Theft Auto V',
    slug: 'grand-theft-auto-v',
    summary: 'Grand Theft Auto V es un juego de accion y mundo abierto.',
    storyline: 'Tres Nenastados ejecutan un golpe planeado en Liberty City.',
    cover: { id: 1, image_id: 'co1x0h' },
    screenshots: [{ id: 11, image_id: 'ss1x0h' }],
    genres: [{ id: 5, name: 'Adventure' }, { id: 31, name: 'Role-Playing' }],
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
    first_release_date: 1379635200,
    aggregated_rating: 86.0,
    aggregated_rating_count: 42,
    total_rating: 90.4,
    total_rating_count: 812345,
    rating: 90.481,
    rating_count: 812345,
  },
  {
    id: 1942,
    name: 'The Witcher 3: Wild Hunt',
    slug: 'the-witcher-3-wild-hunt',
    summary: 'Un cazador de monstruos recorre un mundo abierto.',
    storyline: 'Geralt de Rivia busca a su hija adoptiva.',
    cover: { id: 2, image_id: 'co2x0h' },
    screenshots: [{ id: 12, image_id: 'ss2x0h' }],
    genres: [{ id: 1, name: 'Role-Playing' }],
    platforms: [{ id: 48, name: 'PlayStation 5' }],
    first_release_date: 1425168000,
    aggregated_rating: 92.0,
    aggregated_rating_count: 55,
    total_rating: 93.0,
    total_rating_count: 654321,
    rating: 93.128,
    rating_count: 654321,
  },
  {
    id: 3000,
    name: 'Like a Dragon: Infinite Wealth',
    slug: 'like-a-dragon-infinite-wealth',
    summary: 'Kasuga y su grupo viajan a un archipelago en busca del tesoro.',
    storyline: 'Una aventura más de una saga criminal japonesa.',
    cover: null,
    screenshots: [],
    genres: [{ id: 1, name: 'Role-Playing' }],
    platforms: [{ id: 49, name: 'PlayStation 4' }],
    first_release_date: 1672531200,
    aggregated_rating: 87.0,
    aggregated_rating_count: 30,
    total_rating: 88.1,
    total_rating_count: 4321,
    rating: 88.2,
    rating_count: 4321,
  },
];

/**
 * Interpreta la query Apicalypse que el modulo envia como cuerpo de texto
 * plano. Solo se implementan las operaciones que usa el modulo: busqueda por
 * nombre, filtro por id, limit, offset y orden por nombre.
 */
function applyQuery(query) {
  const search = /search\s+"([^"]+)"/i.exec(query);
  const id = /\bid\s*=\s*(\d+)/i.exec(query);
  const limit = /\blimit\s+(\d+)/i.exec(query);
  const offset = /\boffset\s+(\d+)/i.exec(query);

  let rows = [...CATALOG];

  if (id) {
    rows = rows.filter((game) => game.id === Number(id[1]));
  }

  if (search) {
    const term = search[1].toLowerCase();
    rows = rows.filter((game) => game.name.toLowerCase().includes(term));
  }

  if (/sort\s+name\s+asc/i.test(query)) {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  const start = offset ? Number(offset[1]) : 0;
  const size = limit ? Number(limit[1]) : rows.length;

  return rows.slice(start, start + size);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === 'POST' ? await readBody(req) : '';

  const json = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  // Token de Twitch. El cliente espera { access_token, expires_in, token_type }.
  if (url.pathname === '/oauth2/token') {
    if (!body.includes('client_credentials')) {
      return json(400, { error: 'invalid_request' });
    }
    return json(200, {
      access_token: TOKEN,
      expires_in: 5184000,
      token_type: 'bearer',
    });
  }

  // Catalogo de IGDB. El cuerpo es la query Apicalypse en texto plano.
  if (url.pathname === '/v4/games') {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' });
    }
    if (!req.headers['client-id']) {
      return json(401, { error: 'ClientID is missing' });
    }
    return json(200, applyQuery(body));
  }

  return json(404, { error: 'Not Found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Stub de IGDB escuchando en http://${HOST}:${PORT}`);
  console.log(`  token  -> http://${HOST}:${PORT}/oauth2/token`);
  console.log(`  juegos -> http://${HOST}:${PORT}/v4/games`);
});
