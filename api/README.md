# GoRoDeals API

API **Fastify 5** + PostgreSQL para seguimiento de precios de videojuegos y rutas de sagas.

Estado actual: **Fase 7 del roadmap completada**: el backend es **Fastify 5**
de punta a punta (controladores, servicios, esquemas TypeBox, hooks, plugins
y planificador). La capa de datos sigue intacta (TypeORM, entidades y
migraciones sin cambios).

> El contrato de la API esta congelado en `test/fixtures/contract.json`: guarda
> la forma (estado, claves y tipos) de la respuesta de cada endpoint y se
> capturo del backend de NestJS antes de retirarlo. La suite de contrato
> (`npm run test:e2e`) compara la respuesta real con esos fixtures.

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22 LTS o superior | API |
| npm | 10 o superior | Dependencias |
| Docker | con Docker Compose | PostgreSQL 16 local |

No hace falta ninguna credencial externa para probar Steam: la API pública de la tienda no requiere API key. IGDB sí la requiere en producción, pero para desarrollo hay un stub local incluido.

---

## 2. Puesta en marcha

### 2.1 Base de datos

```bash
cd ..
docker compose up -d
docker compose ps          # espera a "healthy"
```

PostgreSQL queda en `127.0.0.1:5432` con base, usuario y password `gorodeals`.

### 2.2 Dependencias y variables de entorno

```bash
cd api
npm install
cp .env.example .env       # solo la primera vez
```

`.env` ya viene con los valores por defecto de desarrollo (BD local included). Las variables que importan:

| Variable | Defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `DB_*` | `127.0.0.1:5432/gorodeals` | Conexión a PostgreSQL |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | vacío | Credenciales de Twitch Developer (IGDB) |
| `IGDB_ADMIN_SECRET` | vacío | Secreto para `POST /igdb/sync` |
| `IGDB_API_URL` / `IGDB_TOKEN_URL` | endpoints reales | Solo para apuntar al stub local |
| `STEAM_COUNTRY_CODE` / `STEAM_LANGUAGE` | `us` / `es` | Región y moneda de los precios de Steam |
| `STEAM_CACHE_MAX_ENTRIES` | `10000` | Tope de entradas de la cache en memoria de la API de Steam (TTL + LRU) |
| `STEAM_ADMIN_SECRET` | vacío (reutiliza `IGDB_ADMIN_SECRET`) | Secreto para `POST /steam/sync` y `POST /steam/batch` (cabecera `x-admin-secret`) |
| `PRICE_SYNC_CRON` | `0 6 * * *` | Cron diario del sync de precios (UTC) |
| `PRICE_SYNC_ENABLED` | `true` | Permite desactivar el cron |
| `PRICE_SYNC_ADMIN_SECRET` | vacío (reutiliza `IGDB_ADMIN_SECRET`) | Secreto para `POST /price-sync/run` |
| `PRICE_SYNC_REQUEST_DELAY_MS` | `50` | Pausa entre peticiones consecutivas a la API de la tienda |
| `DB_POOL_MAX` | `20` | Conexiones máximas del pool de PostgreSQL |
| `DB_POOL_IDLE_TIMEOUT_MS` | `30000` | Tiempo que se mantiene ociosa una conexión del pool |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | `5000` | Espera máxima al tomar una conexión del pool |
| `IGDB_TIMEOUT_MS` | `10000` | Timeout de las peticiones a IGDB (token, API y renovación) |
| `PRICE_SYNC_MAX_FAILURE_RATE` | `0.5` | Umbral (0-1) de fallos técnicos por lote que aborta el ciclo de una tienda |
| `CORS_ORIGIN` | `http://localhost:4321` | Orígenes permitidos por CORS, separados por comas. Vacío desactiva el acceso desde el navegador |

Si `IGDB_ADMIN_SECRET`, `STEAM_ADMIN_SECRET` o `PRICE_SYNC_ADMIN_SECRET` están vacíos, los endpoints administrativos correspondientes responden `403` y quedan cerrados.

### 2.3 Migraciones

```bash
npm run migration:run
```

Compila el proyecto y aplica las migraciones pendientes. La primera vez aplica `1762000000000-CreateInitialSchema` (tablas `games`, `store_products`, `price_history`, `franchises`, `franchise_play_order`). Cuando ya no hay nada pendiente responde `No migrations are pending`.

### 2.4 Arrancar la API

```bash
npm run build
npm start                 # o: npm run start:dev (recompila y reinicia al guardar)
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs` (JSON en `/docs/json`)

En los logs debe aparecer el registro del cron de precios
(`Cron de sincronizacion de precios registrado: "0 6 * * *" (UTC)`) y las
rutas mapeadas (`/catalog`, `/games`, `/auth`, `/wishlist`, `/steam/...`,
`/igdb/...`, `/price-sync/...`).

#### Arquitectura del proyecto

```
src/
  server.ts        buildServer(): plugins, hooks y rutas (funcion pura)
  index.ts         listen() y apagado ordenado
  config.ts        configuracion tipada desde process.env + dotenv
  context.ts       buildServices(): grafo de servicios construido a mano
  errors.ts        excepciones HTTP (BadRequest, NotFound, Unauthorized, ...)
  logger.ts        createLogger('<Servicio>'): logger con contexto
  plugins/         database, core, cors, rate-limit, swagger, scheduler
  hooks/           auth (deny by default), admin, timing, error
  schemas/         esquemas TypeBox (body, query, params, response)
  controllers/     un plugin de rutas por dominio
  <dominio>/       servicios, entidades y migraciones por dominio
  seed/            scripts de CLI (seed, seed:publications, sync:random)
```

- La autenticacion es **deny by default**: toda ruta exige access token
  salvo las que declaran `config: { auth: 'disabled' }`.
- La validacion la hace **Ajv** con los esquemas de TypeBox: los mismos
  esquemas validan y documentan (OpenAPI en `/docs`) y de sus tipos salen los
  de entrada y de salida de los servicios (`Static<typeof Esquema>`).
- Los errores se lanzan con las excepciones de `src/errors.ts` y se devuelven
  como `{ statusCode, message, error }`, el mismo cuerpo que devolvia NestJS.
- Los endpoints administrativos exigen la cabecera `x-admin-secret` y, si
  el secreto no esta configurado, quedan cerrados (403). El hook va en
  `preValidation` para comprobar el secreto **antes** de validar el cuerpo,
  que era el orden del guard en NestJS.

#### Paridad de contrato

```bash
npm run test:e2e
```

La suite de contrato (`test/contract.e2e-spec.ts`) recorre los endpoints
declarados en `test/contract.json` y compara la respuesta real con la forma
guardada en `test/fixtures/contract.json` (estado, claves y tipos). No imprime
valores de respuesta, solo diferencias, para no filtrar tokens ni datos
personales.

Para regenerar los fixtures contra otra base de desarrollo:

```bash
node tools/capture-fixtures.mjs http://127.0.0.1:3000 > test/fixtures/contract.json
```

Para comparar dos instancias de la API entre si (por ejemplo, la local y la
desplegada):

```bash
node tools/compare-parity.mjs http://127.0.0.1:3031 http://127.0.0.1:3032
```

---

## 3. Probar la API

### 3.1 Steam (precios reales, sin credenciales)

```bash
# Precio actual de un juego (no persiste nada)
curl -s localhost:3000/steam/app/1091500 | jq
# {"appId":1091500,"name":"Cyberpunk 2077","currency":"USD",
#  "currentPrice":59.99,"regularPrice":59.99,"discountPercent":0,...}

# Precios de varios appids sin persistir (requiere x-admin-secret)
curl -s -X POST localhost:3000/steam/batch \
  -H 'Content-Type: application/json' \
  -H 'x-admin-secret: TU_SECRETO' \
  -d '{"appIds":[1091500,275850,730]}'

# Fila persistida de una oferta
curl -s localhost:3000/steam/product/1091500 | jq
```

`POST /steam/batch` acepta hasta 100 appids y lanza esa cantidad de peticiones
salientes a la API de la tienda. **Requiere la cabecera `x-admin-secret`**
(cabecera obligatoria desde la revision de calidad; sin ella la API responde
`403`): sin el guard, el endpoint serviria como proxy amplificador contra Steam.

`POST /steam/sync` persiste la oferta y necesita el UUID de un juego existente en `games`.
**Requiere la cabecera `x-admin-secret`** (cabecera obligatoria desde la revision de
performance; sin ella la API responde `403`):

```bash
GAME_ID=$(docker exec gorodeals-postgres psql -U gorodeals -d gorodeals \
  -tAc "select id from games limit 1")

curl -s -X POST localhost:3000/steam/sync \
  -H 'Content-Type: application/json' \
  -H 'x-admin-secret: TU_SECRETO' \
  -d "{\"gameId\":\"$GAME_ID\",\"appIds\":[1091500,275850]}" | jq
```

El secreto se lee de `STEAM_ADMIN_SECRET` y, si no esta definido, de `IGDB_ADMIN_SECRET`
(ver `.env.example`). Si ninguno de los dos esta configurado, el endpoint queda
**cerrado**: responde `403` aunque se envie la cabecera.

El `upsert` es idempotente: repetirlo actualiza la fila, no la duplica.

### 3.2 IGDB (con el stub local, sin credenciales)

En otra terminal:

```bash
cd api
npm run stub:igdb            # 127.0.0.1:3100
```

Y en `api/.env`:

```
IGDB_CLIENT_ID=stub
IGDB_CLIENT_SECRET=stub
IGDB_ADMIN_SECRET=dev-secret
IGDB_API_URL=http://127.0.0.1:3100/v4/games
IGDB_TOKEN_URL=http://127.0.0.1:3100/oauth2/token
```

Reinicia la API (`npm run start:dev`) y:

```bash
# Buscar por nombre
curl -s 'localhost:3000/igdb/search?q=witcher&limit=5' | jq

# Metadatos por ID de IGDB
curl -s localhost:3000/igdb/games/1942 | jq

# Sincronizar el catalogo contra la tabla games (requiere x-admin-secret)
curl -s -X POST localhost:3000/igdb/sync \
  -H 'Content-Type: application/json' \
  -H 'x-admin-secret: dev-secret' \
  -d '{"limit":50,"offset":0}' | jq
```

El sync es idempotente por `igdb_id`: repetirlo no crea filas duplicadas en `games`. Sin la cabecera `x-admin-secret` responde `403`.

Para usar IGDB de verdad, sustituye `IGDB_API_URL` e `IGDB_TOKEN_URL` por los valores reales y rellena las credenciales de <https://dev.twitch.tv/console>.

### 3.3 Sincronización de precios (PriceSync)

```bash
# Estado del modulo y del ultimo job
curl -s localhost:3000/price-sync/status | jq

# Lanzar el sync a mano (requiere x-admin-secret)
curl -s -X POST localhost:3000/price-sync/run \
  -H 'Content-Type: application/json' \
  -H "x-admin-secret: $PRICE_SYNC_ADMIN_SECRET" \
  -d '{}' | jq

# Historico de un producto
curl -s localhost:3000/price-sync/history/<storeProductId> | jq
```

El cron diario (`PRICE_SYNC_CRON`, UTC) hace lo mismo de forma automática. Cada ejecución escribe en `price_history` una fila por producto y día (`recorded_at` truncado al día, `ON CONFLICT DO NOTHING`): **ejecutarlo dos veces el mismo día no duplica el histórico**.

El proveedor de precios distingue tres resultados: `ok` (la tienda publica
precio), `unavailable` (la tienda responde bien pero no publica datos para ese
producto) y `error` (fallo técnico: tienda caída, 403 por abuso, sin red).
**Solo `unavailable` marca la oferta como no disponible**: con Steam caído, el
catálogo entero no queda marcado como agotado. Si los fallos técnicos de un
lote superan `PRICE_SYNC_MAX_FAILURE_RATE`, se aborta el ciclo de esa tienda.

El parámetro `windowMonths` del histórico se valida: un valor fuera del rango
1-60 devuelve `400`.

---

### 3.4 Catalogo para el frontend (Fase 5)

Endpoints de lectura que consume el frontend Astro. Todos están documentados
en Swagger (`/docs`) y devuelven el contrato de JSON fijo del roadmap.

```bash
# Catalogo paginado (page, limit, q, sort=recent|quality|discount, store)
curl 'http://localhost:3000/catalog?page=1&limit=3&sort=discount'

# Ficha completa de un juego (metadatos, ofertas, historico y saga)
curl 'http://localhost:3000/games/like-a-dragon-infinite-wealth'

# Serie de precios de un juego (months=1..60)
curl 'http://localhost:3000/games/<gameId>/price-history?months=12'

# Top de ofertas por Deal Score
curl 'http://localhost:3000/deals/hottest?limit=5'

# Ruta recomendada de una saga
curl 'http://localhost:3000/franchises/like-a-dragon/route'

# Estado del servicio y de la base de datos
curl 'http://localhost:3000/health'
```

El Deal Score (0-10) se calcula en `src/deals/deal-score.service.ts` a partir
del score de calidad, el descuento y la cercanía al mínimo histórico. Cuando
`store_products.deal_score` es `NULL`, el score se calcula en memoria y no se
persiste.

### 3.5 Publicaciones (guias y rutas de saga)

Contenido editorial para responder a "por donde empiezo esta saga". Vive en las
tablas `publications` y `publication_games` y lo consume el frontend en
`/publicaciones` y `/publicacion?slug=<slug>`.

```bash
# Listado paginado con filtros (page, limit<=50, category, franchise, q)
curl 'http://localhost:3000/publications?page=1&limit=6'

# Categorias con el numero de publicaciones de cada una
curl 'http://localhost:3000/publications/categories'

# Publicacion completa (cuerpo, saga relacionada y juegos citados)
curl 'http://localhost:3000/publications/como-empezar-la-saga-like-a-dragon'
```

Categorias admitidas: `guia`, `ruta`, `analisis`, `noticia`. Una publicación
sin `is_published` o inexistente devuelve `404`.

El seed editorial se carga por separado y es idempotente (upsert por `slug`):

```bash
npm run seed:publications
```

### 3.6 Cuentas de usuario y wishlist (Fase 4)

Registro e inicio de sesion con email y contrasena. La contrasena se guarda
con argon2id; el `accessToken` es un JWT de vida corta (`JWT_ACCESS_TTL`, 15
minutos por defecto) y el `refreshToken` es opaco, se persiste solo su
SHA-256 y rota en cada uso.

```bash
# Registro (201)
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"UnaClaveLarga1","displayName":"Ana"}'

# Inicio de sesion (200)
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"UnaClaveLarga1"}'

# Sesion actual (200 con cabecera Bearer)
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"

# Renovar el access token (200)
curl -s -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"

# Cerrar la sesion actual (200) o todas las sesiones (200)
curl -s -X POST http://localhost:3000/auth/logout \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
curl -s -X POST http://localhost:3000/auth/logout-all -H "Authorization: Bearer $ACCESS_TOKEN"
```

Reglas de sesion:

- El `refreshToken` se rota en cada `POST /auth/refresh`: el anterior queda
  revocado y se emite uno nuevo.
- Presentar un token ya revocado se trata como robo de token: se revocan
  **todas** las sesiones del usuario y la respuesta es 401.
- `POST /auth/logout` es idempotente: si el token ya estaba revocado
  responde 200 con `{"revoked": 0}`.

Login social (ambos necesitan credenciales en `.env`):

| Variable | Endpoint de inicio | Callback |
|---|---|---|
| Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URI`) | `GET /auth/google` | `GET /auth/google/callback` |
| Steam OpenID 2.0 (`STEAM_OPENID_KEY_URL` opcional) | `GET /auth/steam` | `GET /auth/steam/callback` |

Google usa OAuth 2.0 con PKCE (S256) y un `state` de un solo uso. Si la
identidad social corresponde a una cuenta local existente, la API responde
409 con un `linkToken` que debe confirmarse en `POST /auth/confirm-link`
(enviando la contrasena de la cuenta local) para vincular ambas identidades.

La lista de deseos exige sesion:

```bash
# Listar (200). Acepta page, limit y store
curl -s "http://localhost:3000/wishlist?page=1&limit=24" -H "Authorization: Bearer $ACCESS_TOKEN"

# Anadir por gameId o por slug (201). Repetir el mismo juego devuelve 409
curl -s -X POST http://localhost:3000/wishlist \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"slug":"like-a-dragon-island"}'

# Quitar (204), por id de juego o por slug
curl -s -X DELETE "http://localhost:3000/wishlist/$GAME_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
curl -s -X DELETE "http://localhost:3000/wishlist/slug/like-a-dragon-island" -H "Authorization: Bearer $ACCESS_TOKEN"

# Sincronizar con una tienda externa (200)
curl -s -X POST http://localhost:3000/wishlist/sync/gog -H "Authorization: Bearer $ACCESS_TOKEN"
```

La sincronizacion con GOG y Nintendo devuelve `status: "not_configured"` con
el motivo (por ejemplo, `Falta configurar WISHLIST_GOG_API_KEY`) en vez de
fallar: las APIs de wishlist de esas tiendas no estan disponibles y sin un
cliente real y credenciales de prueba no es verificable.

### 3.7 Seed del catalogo

```bash
npm run seed
```

Inserta un catálogo real (saga Like a Dragon / Yakuza, Skyrim, Fallout 4,
Resident Evil 2 y 4, God of War), la saga `like-a-dragon` con su ruta
recomendada, las ofertas de Steam y 30 días de histórico de precios por oferta.

Es idempotente: los juegos se localizan por `igdb_id` o `slug`, las ofertas
por `(store_name, store_product_id)` y el histórico usa
`ON CONFLICT DO NOTHING` sobre `(store_product_id, recorded_at)`. Repetir el
seed no duplica filas ni toca los datos ajenos.

---

### 3.8 Sincronizar juegos de prueba (Steam y Nintendo Switch)

Herramienta de carga de datos para probar el catálogo y las gráficas: trae
juegos aleatorios de PC (Steam) y de Nintendo Switch, crea el juego y su
oferta en el catálogo y genera 30 días de histórico de precios.

Fuentes (ambas públicas, sin credenciales):

| Tienda | Fuente | Notas |
|---|---|---|
| Steam | `store.steampowered.com/search/results` (listado) + `store.steampowered.com/api/appdetails` (precio) | `appdetails` acepta un solo appid por llamada; el lote por comas responde HTTP 400. Región `us` (USD). |
| Nintendo | `searching.nintendo-europe.com/en/select` (buscador Solr de la tienda) | El host-US `searching.nintendo.com` no resuelve por DNS desde el entorno de desarrollo. La tienda europea publica los precios en EUR, así que las ofertas de Switch se guardan con `currency = 'EUR'`. Si el buscador no responde, el script usa la lista curada de 20 títulos documentada en `src/sync/sync-random-games.service.ts`. |

#### Script de CLI

```bash
npm run sync:random
npm run sync:random -- --pc=10 --switch=10 --seed=42
npm run sync:random -- --platforms=steam --count=5
npm run sync:random -- --new          # anade juegos nuevos sin refrescar los yasyncronizados
```

Variables de entorno equivalentes: `SYNC_RANDOM_PC`, `SYNC_RANDOM_SWITCH`,
`SYNC_RANDOM_COUNT`, `SYNC_RANDOM_PLATFORMS` y `SYNC_RANDOM_SEED`. El script
solo necesita la base de datos y las APIs públicas: la API puede estar apagada.

Por defecto la sincronización **refresca** las ofertas que ya gestiona la
herramienta (identificadas por su `igdb_id` sintético) y solo busca juegos
aleatorios nuevos cuando faltan para llegar al número pedido. Con `--new` se
eligen siempre juegos nuevos. Así, repetir la sincronización no cambia los
conteos del catálogo ni el histórico.

#### Endpoint de administración

```bash
# Sin cabecera: 403
curl -i -X POST "http://localhost:3000/admin/sync/random"

# Con secreto incorrecto: 403
curl -i -X POST -H "x-admin-secret: malo" "http://localhost:3000/admin/sync/random?count=10&platforms=steam,nintendo"

# Con secreto correcto: 200
curl -s -X POST -H "x-admin-secret: $ADMIN_SYNC_SECRET" \
  "http://localhost:3000/admin/sync/random?count=10&platforms=steam,nintendo"
```

```json
{
  "requested": { "count": 10, "platforms": ["steam", "nintendo"] },
  "games": 20,
  "offers": 20,
  "history": 600,
  "durationMs": 6807,
  "sources": { "steam": "steam-search", "nintendo": "nintendo-api" }
}
```

`x-admin-secret` es obligatorio: si `ADMIN_SYNC_SECRET` (o, en su defecto,
`IGDB_ADMIN_SECRET`) no está configurado, el endpoint responde 403
("Sincronizacion deshabilitada: ADMIN_SYNC_SECRET no esta configurado").

La lógica vive en `src/sync/sync-random-games.service.ts` y la comparten el
script y el endpoint, de modo que no hay duplicación. Es idempotente: los
juegos se localizan por `igdb_id` sintético, las ofertas por
`(store_name, store_product_id)` y el histórico usa
`ON CONFLICT (store_product_id, recorded_at) DO NOTHING`. Repetir la
sincronización no duplica juegos, ofertas ni filas de histórico.

El `igdb_id` sintético se deriva del identificador de producto de la tienda
(hash estable) dentro de un rango reservado (`9_000_000_000_000` para Steam y
`9_500_000_000_000` para Nintendo), de modo que no colisiona con los ids reales
de IGDB ni con los sembrados por otras herramientas.

---

## 4. Verificar en la base de datos

```bash
docker exec -it gorodeals-postgres psql -U gorodeals -d gorodeals
```

```sql
-- Catalogo importado de IGDB
select igdb_id, title, slug, release_date from games order by title;

-- Ofertas y su ultimo precio conocido
select store_name, store_product_id, current_price, regular_price,
       discount_percent, currency, last_checked_at
from store_products order by store_name, store_product_id;

-- Historico de precios (una fila por producto y dia)
select sp.store_product_id, ph.price, ph.discount_percent, ph.recorded_at
from price_history ph
join store_products sp on sp.id = ph.store_product_id
order by ph.recorded_at desc;

-- Comprobacion de idempotencia: el historico no debe crecer al repetir el sync
select count(*) from price_history;
```

---

## 5. Comandos de calidad

```bash
npm run build        # compilacion (tsc)
npm run lint         # eslint
npm test             # tests unitarios (jest)
npm run test:e2e     # tests de extremo a extremo con fastify.inject()
                     #   (incluye la suite de contrato)
npm run test:cov     # cobertura
npm run format       # prettier
npm run seed         # seed idempotente del catalogo (Fase 5)
```

---

## 6. Estructura del proyecto

```
api/src/
├── server.ts        buildServer(): plugins, hooks y rutas (funcion pura)
├── index.ts         listen() y apagado ordenado
├── config.ts        configuracion tipada desde process.env + dotenv
├── context.ts       buildServices(): grafo de servicios construido a mano
├── errors.ts        excepciones HTTP propias (BadRequest, NotFound, ...)
├── logger.ts        createLogger('<Servicio>'): logger con contexto
├── config/          configuration.ts (estructura y nombres del .env)
├── database/        data-source.ts, migraciones y transformers de TypeORM
├── plugins/         database, core, cors, rate-limit, swagger, scheduler
├── hooks/           auth (deny by default), admin, timing, error
├── schemas/         esquemas TypeBox (body, query, params, response)
├── controllers/     un plugin de rutas por dominio
├── games/           entidad Game, catalogo, ficha y resumen de sagas
├── store-products/  entidad StoreProduct
├── prices/          entidad PriceHistory
├── franchises/      entidades Franchise y FranchisePlayOrder, ruta de saga
├── igdb/            cliente OAuth Twitch, consultas Apicalypse, mapeo a Game
├── steam/           cliente appdetails, cache y upsert en StoreProduct
├── price-sync/      cron diario, proveedores de precios y PriceHistory
├── publications/    publicaciones editoriales (guias y rutas de saga)
├── auth/            registro, login, JWT, refresh, Steam y Google
├── users/           entidades User y SocialAccount
├── wishlist/        lista de deseos y sincronizacion con tiendas
├── seed/            scripts de CLI (seed, seed:publications, sync:random)
tools/igdb-stub.mjs  stub local de Twitch + IGDB para desarrollo
```

No queda ninguna dependencia de NestJS: los servicios se construyen a mano en
`src/context.ts` y se inyectan en los plugins de rutas con `fastify-plugin`.

---

## 7. Problemas frecuentes

**La CLI de TypeORM se queda colgada.** En este entorno `typeorm-ts-node-commonjs` entra en recursion infinita (por eso los scripts usan la CLI sobre `dist/`). Usa siempre `npm run migration:run`, que compila y aplica. No uses `npx` para los comandos de TypeORM.

**El endpoint de IGDB devuelve 500 `IgdbConfigurationError`.** Faltan `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` en `.env`. La API arranca igual; solo fallan las llamadas a IGDB.

**`POST /igdb/sync`, `POST /steam/sync`, `POST /steam/batch` o `POST /price-sync/run` devuelven 403.** El endpoint está cerrado si el secreto correspondiente está vacío. Define `IGDB_ADMIN_SECRET` (y/o `STEAM_ADMIN_SECRET` / `PRICE_SYNC_ADMIN_SECRET`) y envía la cabecera `x-admin-secret`.

**El navegador recibe un error de CORS.** `CORS_ORIGIN` no incluye el origen
del frontend. La lista va separada por comas; si se deja vacía, la API no
acepta peticiones desde el navegador (pero `curl` sigue funcionando).

**Steam devuelve 422.** Ese appid no publica precio en la region configurada (juegos gratis, o sin precio en `cc=us`). Cambia `STEAM_COUNTRY_CODE` para probar otra region.

**El puerto 3000 está ocupado.** Arranca con `PORT=3010 npm start`.

**Jest no puede cargar un modulo ESM de `node_modules`.** Para que los tests
de Fastify (`fastify.inject()`) funcionen, `transformIgnorePatterns` deja
transformar unas pocas dependencias ESM (`cookie`, `content-disposition`). Si
anades un plugin nuevo de Fastify que traiga ESM, ampliable esa lista.

**`synchronize` está en `false` a propósito.** El esquema solo cambia por migraciones; no lo actives.

**`POST /auth/refresh` devuelve 401 aunque el refresh token sea válido.** Se
presenta un token ya rotado o revocado: la API lo trata como robo de token y
revoca todas las sesiones del usuario. Vuelve a iniciar sesion.

**El frontend no puede llamar a la API desde el navegador.** Revisa
`CORS_ORIGIN` (debe incluir el origen del frontend, por ejemplo
`http://localhost:4321`) y `PUBLIC_API_URL` del lado del frontend.
