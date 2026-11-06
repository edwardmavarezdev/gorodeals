# GoRoDeals API

API NestJS + PostgreSQL para seguimiento de precios de videojuegos y rutas de sagas.

Estado actual: **Fases 1, 2 y 3 del roadmap completas** (configuración, modelo de datos e ingesta de IGDB, Steam y sincronización de precios). No hay autenticación ni endpoints públicos de catálogo todavía (Fases 4 y 5).

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 20 LTS o superior | API |
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
npm run start:dev
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs` (JSON en `/docs-json`)

En los logs debe aparecer el registro del cron del PriceSyncModule y las rutas mapeadas (`/igdb/...`, `/steam/...`, `/price-sync/...`).

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

## 3.4 Catalogo para el frontend (Fase 5)

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

### 3.5 Seed del catalogo

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

### 3.6 Sincronizar juegos de prueba (Steam y Nintendo Switch)

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
npm run test:cov     # cobertura
npm run format       # prettier
npm run seed         # seed idempotente del catalogo (Fase 5)
```

---

## 6. Estructura del proyecto

```
api/src/
├── config/          configuration.ts + validation.ts (Joi)
├── database/        data-source.ts, migraciones, transformers de TypeORM
├── games/           entidad Game
├── store-products/  entidad StoreProduct
├── prices/          entidad PriceHistory
├── franchises/      entidades Franchise y FranchisePlayOrder
├── igdb/            IgdbModule: OAuth Twitch, Apicalypse, mapeo a Game
├── steam/           SteamModule: appdetails, upsert en StoreProduct
└── price-sync/      PriceSyncModule: cron diario y registro en PriceHistory
├── app.controller.ts  endpoint de salud GET /health
tools/igdb-stub.mjs  stub local de Twitch + IGDB para desarrollo
```

---

## 7. Problemas frecuentes

**La CLI de TypeORM se queda colgada.** En este entorno `typeorm-ts-node-commonjs` entra en recursion infinita (por eso los scripts usan la CLI sobre `dist/`). Usa siempre `npm run migration:run`, que compila y aplica. No uses `npx` para los comandos de TypeORM.

**El endpoint de IGDB devuelve 500 `IgdbConfigurationError`.** Faltan `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` en `.env`. La API arranca igual; solo fallan las llamadas a IGDB.

**`POST /igdb/sync`, `POST /steam/sync`, `POST /steam/batch` o `POST /price-sync/run` devuelven 403.** El endpoint está cerrado si el secreto correspondiente está vacío. Define `IGDB_ADMIN_SECRET` (y/o `STEAM_ADMIN_SECRET` / `PRICE_SYNC_ADMIN_SECRET`) y envía la cabecera `x-admin-secret`.

**El navegador recibe un error de CORS.** `CORS_ORIGIN` no incluye el origen
del frontend. La lista va separada por comas; si se deja vacía, la API no
acepta peticiones desde el navegador (pero `curl` sigue funcionando).

**Steam devuelve 422.** Ese appid no publica precio en la region configurada (juegos gratis, o sin precio en `cc=us`). Cambia `STEAM_COUNTRY_CODE` para probar otra region.

**El puerto 3000 está ocupado.** Arranca con `PORT=3010 npm run start:dev`.

**`synchronize` está en `false` a propósito.** El esquema solo cambia por migraciones; no lo actives.
