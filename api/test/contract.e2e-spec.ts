import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HTTPMethods } from 'fastify';
import { buildServer } from '../src/server.js';
import { appConfig } from '../src/config.js';
import { diferencia, forma, type Forma } from './contract-shape.js';

/**
 * Fixtures de contrato (golden JSON).
 *
 * `test/fixtures/contract.json` guarda la *forma* de la respuesta de cada
 * endpoint: el estado, las claves y los tipos. Se capturaron del backend de
 * NestJS antes de retirarlo, asi que son el contrato de referencia.
 *
 * `test/contract.json` guarda como se llama a cada endpoint: el metodo, la
 * ruta, el cuerpo y si exige token o secreto de administracion.
 */

/** Entrada del contrato: como se llama al endpoint. */
interface EntradaContrato {
  method: HTTPMethods;
  path: string;
  body?: Record<string, unknown>;
  auth?: boolean;
  admin?: boolean;
}

/** Entrada del fixture: la forma que se espera de la respuesta. */
interface EntradaFixture {
  method: HTTPMethods;
  path: string;
  status: number;
  shape: Forma;
}

interface Contrato {
  endpoints: EntradaContrato[];
}

interface Fixtures {
  endpoints: EntradaFixture[];
}

/** Parametros dinamicos de la ruta, resueltos con datos reales. */
type Parametros = Record<string, string>;

/**
 * Rutas que dependen de un proveedor externo (Steam, IGDB).
 *
 * Su respuesta puede fallar por causas que no tienen que ver con el
 * contrato (la API de Steam devuelve 503 a menudo). Cuando el proveedor no
 * esta disponible, el endpoint se informa como omitido en lugar de romper
 * la suite.
 */
const RUTAS_EXTERNAS = ['/steam', '/igdb', '/admin/sync'];

/** Estados que significan "el proveedor externo no esta disponible". */
const ESTADOS_DE_PROVEEDOR = [500, 502, 503];

/** Raiz del proyecto: los fixtures cuelgan de `test/`. */
const RAIZ = join(process.cwd(), 'test');

function leerJson<T>(ruta: string): T {
  return JSON.parse(readFileSync(ruta, 'utf8')) as T;
}

/**
 * Lee el cuerpo de una respuesta como JSON, o `null` si no lo es.
 *
 * Las redirecciones (302) no llevan cuerpo: el fixture las guarda como
 * `null` y no hay nada que parsear.
 */
function cuerpoJson(respuesta: { body: string }): unknown {
  if (!respuesta.body) {
    return null;
  }
  try {
    return JSON.parse(respuesta.body) as unknown;
  } catch {
    return null;
  }
}

/**
 * Secreto de administracion que aplica a cada ruta.
 *
 * El reparto es el mismo que usaba la captura de fixtures: cada dominio
 * tiene su propio secreto, con un respaldo comun en `IGDB_ADMIN_SECRET`.
 */
function secretoDe(ruta: string): string {
  if (ruta.startsWith('/price-sync')) {
    return appConfig.priceSync.adminSecret;
  }
  if (ruta.startsWith('/steam')) {
    return appConfig.steam.adminSecret;
  }
  if (ruta.startsWith('/igdb')) {
    return appConfig.igdb.adminSecret;
  }
  return appConfig.adminSync.secret;
}

describe('Contrato de la API (golden JSON)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let token: string;
  let parametros: Parametros;

  const contrato = leerJson<Contrato>(join(RAIZ, 'contract.json'));
  const fixtures = leerJson<Fixtures>(join(RAIZ, 'fixtures', 'contract.json'));

  beforeAll(async () => {
    app = await buildServer();

    // Sesion de prueba: las credenciales se manejan enteramente en el
    // proceso, no se imprimen ni se guardan en ningun fichero.
    const email = `contrato-${Date.now()}@example.com`;
    const password = 'Contrasena1!';
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password, displayName: 'Contrato' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    token = login.json<{ accessToken: string }>().accessToken;

    parametros = await resolverParametros();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Resuelve los marcadores de la ruta con datos reales de la base.
   */
  async function resolverParametros(): Promise<Parametros> {
    const catalogo = await app.inject({
      method: 'GET',
      url: '/catalog?limit=1',
    });
    const franchises = await app.inject({ method: 'GET', url: '/franchises' });
    const publicaciones = await app.inject({
      method: 'GET',
      url: '/publications',
    });
    const steam = await app.inject({
      method: 'GET',
      url: '/steam/product/1091500',
    });
    const igdb = await app.inject({
      method: 'GET',
      url: '/igdb/search?q=zelda&limit=1',
    });

    const item = catalogo.json<{ items: { id: string; slug: string }[] }>()
      .items?.[0];
    const franchise = franchises.json<{ slug: string }[]>()?.[0];
    const publicacion = publicaciones.json<{ items: { slug: string }[] }>()
      .items?.[0];
    const producto = steam.json<{ id: string } | null>();
    const juegoIgdb = igdb.json<{ igdbId: number }[]>()?.[0];

    return {
      gameSlug: item?.slug ?? 'no-existe',
      gameId: item?.id ?? '00000000-0000-0000-0000-000000000000',
      franchiseSlug: franchise?.slug ?? 'no-existe',
      publicationSlug: publicacion?.slug ?? 'no-existe',
      storeProductId: producto?.id ?? '00000000-0000-0000-0000-000000000000',
      igdbId: String(juegoIgdb?.igdbId ?? 1),
      appId: '1091500',
    };
  }

  /** Sustituye los marcadores `{parametro}` por valores reales. */
  function resolverRuta(ruta: string): string {
    return ruta.replace(
      /\{(\w+)\}/g,
      (_: string, clave: string) => parametros[clave] ?? '',
    );
  }

  for (const entrada of fixtures.endpoints) {
    it(`${entrada.method} ${entrada.path} coincide con el fixture`, async () => {
      const definicion = contrato.endpoints.find(
        (e) => e.method === entrada.method && e.path === entrada.path,
      );
      expect(definicion).toBeDefined();
      if (!definicion) {
        return;
      }

      const ruta = resolverRuta(entrada.path);
      const headers: Record<string, string> = {};
      if (definicion.auth) {
        headers.authorization = `Bearer ${token}`;
      }
      const secreto = definicion.admin ? secretoDe(ruta) : '';
      if (secreto) {
        headers['x-admin-secret'] = secreto;
      }

      const respuesta = await app.inject({
        method: entrada.method,
        url: ruta,
        headers,
        ...(definicion.body !== undefined ? { payload: definicion.body } : {}),
      });

      /**
       * El fixture se capturo con los secretos de administracion vacios, de
       * modo que esas rutas respondian 403. Si ahora hay un secreto
       * configurado, la respuesta es distinta por diseno y el fixture ya no
       * describe esa situacion: se omite en lugar de fallar.
       */
      if (secreto && entrada.status === 403) {
        console.warn(
          `OMITIDO ${entrada.method} ${entrada.path}: hay un secreto de ` +
            'administracion configurado y el fixture se capturo sin el',
        );
        return;
      }

      /**
       * Las rutas que dependen de un proveedor externo fallan cuando ese
       * proveedor no esta disponible. Es un fallo del entorno, no del
       * contrato.
       */
      if (
        RUTAS_EXTERNAS.some((prefijo) => ruta.startsWith(prefijo)) &&
        respuesta.statusCode !== entrada.status &&
        ESTADOS_DE_PROVEEDOR.includes(respuesta.statusCode)
      ) {
        console.warn(
          `OMITIDO ${entrada.method} ${entrada.path}: el proveedor externo ` +
            `respondio ${respuesta.statusCode}`,
        );
        return;
      }

      expect(respuesta.statusCode).toBe(entrada.status);

      const cuerpo = cuerpoJson(respuesta);
      const d = diferencia(entrada.shape, forma(cuerpo));
      expect(d).toBeNull();
    });
  }
});
