import type { Repository } from 'typeorm';
import { Game } from '../games/entities/game.entity.js';
import { IgdbClient } from './igdb.client.js';
import { IgdbService } from './igdb.service.js';

interface UpsertPayload {
  igdbId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  genres: string[];
  metacriticScore: number | null;
}

interface UpsertOptions {
  conflictPaths: string[];
}

class FakeIgdbClient {
  queries: string[] = [];
  response: unknown[] = [];

  query(query: string): Promise<unknown[]> {
    this.queries.push(query);
    return Promise.resolve(this.response);
  }
}

class FakeGameRepository {
  upserts: Array<{ payload: UpsertPayload; options: UpsertOptions }> = [];
  existingBySlug = new Map<string, string>();
  /** Filas realmente persistidas, indexadas por `igdb_id` (clave unica). */
  rows = new Map<string, UpsertPayload>();

  upsert(payload: UpsertPayload, options: UpsertOptions): Promise<void> {
    this.upserts.push({ payload, options });
    // El repositorio real aplica la restriccion UNIQUE sobre `igdb_id`:
    // el upsert actualiza la fila existente en lugar de insertar otra.
    this.rows.set(payload.igdbId, payload);
    return Promise.resolve();
  }

  findOne(options: {
    where: { slug: string };
  }): Promise<{ igdbId: string } | null> {
    const igdbId = this.existingBySlug.get(options.where.slug);
    return Promise.resolve(igdbId ? { igdbId } : null);
  }
}

/**
 * Extrae el literal de la clausula `search "..."` de una query Apicalypse.
 * Devuelve el contenido literal (con las secuencias de escape tal cual) y
 * el resto de la query que le sigue.
 */
function parseSearchLiteral(query: string): {
  literal: string;
  rest: string;
} {
  const start = query.indexOf('search "');
  if (start < 0) {
    throw new Error(`La query no contiene una clausula search: ${query}`);
  }
  let index = start + 'search "'.length;
  let literal = '';
  while (index < query.length) {
    const char = query[index];
    if (char === '\\' && index + 1 < query.length) {
      literal += char + query[index + 1];
      index += 2;
      continue;
    }
    if (char === '"') {
      return { literal, rest: query.slice(index + 1) };
    }
    literal += char;
    index += 1;
  }
  throw new Error(`El literal de busqueda no se cierra: ${query}`);
}

/** Revierte el escapado de Apicalypse (barra invertida y comilla). */
function unescapeApicalypse(literal: string): string {
  return literal.replace(/\\(.)/g, '$1');
}

describe('IgdbService', () => {
  let service: IgdbService;
  let client: FakeIgdbClient;
  let repository: FakeGameRepository;

  const rawGame = {
    id: 1020,
    name: 'Grand Theft Auto V',
    slug: 'grand-theft-auto-v',
    cover: { image_id: 'co1x0h' },
    genres: [{ name: 'Action' }],
    platforms: [{ name: 'PC' }],
    first_release_date: 1379635200,
    aggregated_rating: 96.4,
    aggregated_rating_count: 42,
  };

  beforeEach(() => {
    client = new FakeIgdbClient();
    repository = new FakeGameRepository();

    // El grafo de servicios se construye a mano: aqui solo hacen falta el
    // cliente y el repositorio, con dobles propios.
    service = new IgdbService(
      client as unknown as IgdbClient,
      repository as unknown as Repository<Game>,
    );
  });

  describe('searchByName', () => {
    it('construye una query Apicalypse con search y limit', async () => {
      client.response = [rawGame];

      const result = await service.searchByName('grand theft auto', 20);

      expect(client.queries).toHaveLength(1);
      expect(client.queries[0]).toContain('fields id, name, slug');
      expect(client.queries[0]).toContain('search "grand theft auto"');
      expect(client.queries[0]).toContain('limit 20');
      // `metacritic` ya no existe en IGDB v4: debe pedirse `aggregated_rating`.
      expect(client.queries[0]).toContain('aggregated_rating');
      expect(client.queries[0]).not.toContain('metacritic');
      expect(result).toHaveLength(1);
      expect(result[0].igdbId).toBe('1020');
    });

    it('escapa la barra invertida y la comilla del termino de busqueda', async () => {
      client.response = [];
      const term = 'hola\\" limit 500; fields hacked';

      await service.searchByName(term, 20);

      // El literal de busqueda se cierra donde debe: el texto del usuario
      // queda dentro de las comillas y no puede abrir una nueva clausula.
      const { literal, rest } = parseSearchLiteral(client.queries[0]);
      expect(unescapeApicalypse(literal)).toBe(term);
      expect(rest.startsWith('; limit 20;')).toBe(true);
    });

    it('limita el numero de resultados a 50', async () => {
      await service.searchByName('x', 500);
      expect(client.queries[0]).toContain('limit 50');
    });

    it('descarta respuestas crudas invalidas', async () => {
      client.response = [{ id: 'no-numero' }, rawGame];
      const result = await service.searchByName('x');
      expect(result).toHaveLength(1);
    });
  });

  describe('findByIgdbId', () => {
    it('consulta por id y devuelve el juego mapeado', async () => {
      client.response = [rawGame];

      const result = await service.findByIgdbId(1020);

      expect(client.queries[0]).toContain('id = 1020');
      expect(result?.title).toBe('Grand Theft Auto V');
    });

    it('devuelve null si IGDB no devuelve el juego', async () => {
      client.response = [];
      await expect(service.findByIgdbId(999999)).resolves.toBeNull();
    });
  });

  describe('sync', () => {
    it('hace upsert por igdb_id', async () => {
      client.response = [rawGame];

      const result = await service.sync({});

      expect(result).toEqual({ fetched: 1, upserted: 1, skipped: 0 });
      expect(repository.upserts).toHaveLength(1);
      expect(repository.upserts[0].payload.igdbId).toBe('1020');
      expect(repository.upserts[0].payload.coverUrl).toBe(
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x0h.jpg',
      );
      // La puntuacion de criticos de IGDB se persiste en `metacritic_score`.
      expect(repository.upserts[0].payload.metacriticScore).toBe(96);
      expect(repository.upserts[0].options.conflictPaths).toEqual(['igdbId']);
    });

    it('es idempotente: repetir el sync no duplica filas', async () => {
      client.response = [rawGame];

      await service.sync({});
      await service.sync({});

      // Ambas ejecuciones emiten un upsert, pero la clave unica `igdb_id`
      // deja una sola fila en la tabla.
      expect(repository.upserts).toHaveLength(2);
      expect(repository.rows.size).toBe(1);
      expect(repository.rows.has('1020')).toBe(true);
    });

    it('desambigua slugs duplicados entre juegos distintos', async () => {
      client.response = [
        rawGame,
        { ...rawGame, id: 3000, name: 'GTA V Legacy' },
      ];
      repository.existingBySlug.set('grand-theft-auto-v', '1020');

      await service.sync({});

      const slugs = repository.upserts.map((upsert) => upsert.payload.slug);
      expect(slugs).toEqual(['grand-theft-auto-v', 'grand-theft-auto-v-2']);
    });

    it('cuenta como skipped las respuestas invalidas', async () => {
      client.response = [{ id: null }, rawGame];

      const result = await service.sync({});

      expect(result.fetched).toBe(2);
      expect(result.upserted).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('acepta una query Apicalypse explicita', async () => {
      client.response = [rawGame];
      await service.sync({ query: 'fields id; search "x";' });
      expect(client.queries).toEqual(['fields id; search "x";']);
    });
  });
});
