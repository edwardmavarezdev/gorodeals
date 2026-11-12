# Roadmap de Objetivos: Backend de Prueba con Fastify

Este documento detalla la lista de objetivos paso a paso para construir e integrar la primera versión del backend para tu plataforma de seguimiento de precios y guías de videojuegos.

Las fases 1 a 6 se construyeron sobre **NestJS**; la fase 7 migra ese resultado a **Fastify** conservando el modelo de datos y el contrato de la API.

---

## 🚀 Fase 1: Configuración Inicial del Proyecto y Entorno

- [x] **1.1. Inicializar el Proyecto NestJS**
  - Instalar la CLI de NestJS y crear el proyecto inicial: `nest new backend-deals`.
  - Configurar las variables de entorno utilizando `@nestjs/config` (`.env` con claves de API, credenciales de BD y puerto).
- [x] **1.2. Configurar la Base de Datos (PostgreSQL)**
  - Levantar una instancia local o en Docker con PostgreSQL.
  - Configurar **TypeORM** o **Prisma** dentro de NestJS para gestionar la conexión y migraciones.
- [x] **1.3. Integrar OpenCode (AI Assistant / Code Agent)**
  - Configurar las reglas de proyecto y contextos en OpenCode para asegurar alineación con la arquitectura de NestJS y convenciones de código.

---

## 🗄️ Fase 2: Modelo de Datos Universal (Base de Datos)

- [x] **2.1. Crear la Entidad `Game` (Juegos Maestros)**
  - Campos: `id`, `igdb_id` (índice único), `title`, `slug`, `cover_url`, `quality_score`, `created_at`.
- [x] **2.2. Crear la Entidad `StoreProduct` (Tiendas y Precios)**
  - Campos: `id`, `game_id` (FK), `store_name` ('steam', 'gog', 'nintendo'), `store_product_id`, `current_price`, `regular_price`, `discount_percent`, `url`.
- [x] **2.3. Crear la Entidad `PriceHistory` (Histórico de Precios)**
  - Campos: `id`, `store_product_id` (FK), `price`, `recorded_at`.
- [x] **2.4. Crear las Entidades `Franchise` y `FranchisePlayOrder` (Sagas y Rutas)**
  - Mapeo relacional para conectar juegos con sus respectivas sagas (ej. *Yakuza/Like a Dragon*) y definir el orden de juego recomendado.

---

## 📡 Fase 3: Módulos de Ingesta y Consumo de APIs Exteriores

- [x] **3.1. Crear el Módulo `IgdbModule`**
  - Implementar servicio de autenticación OAuth con Twitch Developer API (Client ID + Client Secret).
  - Endpoint o método para consultar metadatos de juegos por nombre o ID de IGDB.
- [x] **3.2. Crear el Módulo `SteamModule`**
  - Consumir la API pública de tiendas de Steam (`appdetails`) para extraer precios actuales, valoraciones de usuarios y tamaños de descarga.
- [x] **3.3. Crear el Módulo `PriceSyncModule` (Cron Jobs / Workers)**
  - Implementar tareas programadas con `@nestjs/schedule` para auditar precios diariamente y registrar las variaciones en `PriceHistory`.

---

## 🔐 Fase 4: Autenticación y Cuentas de Usuario

- [x] **4.1. Crear la Entidad `User` y `SocialAccount`**
  - Diseñar el esquema de usuarios y proveedores de autenticación externos.
- [x] **4.2. Implementar Autenticación con Steam (OpenID)**
  - Integrar la estrategia de login con Steam para capturar el `SteamID64` del usuario.
- [x] **4.3. Implementar Autenticación con Google (OAuth 2.0)**
  - Configurar Passport/Google OAuth2 para permitir inicio de sesión social.
- [x] **4.4. Módulo de Lista de Deseos (`WishlistModule`)**
  - Crear endpoints para permitir a los usuarios logueados agregar/quitar juegos a su lista personal.

---

## 📊 Fase 5: Algoritmo de Puntuación y APIs para el Frontend (Astro)

- [x] **5.1. Implementar Servicio de Cálculo de `Deal Score`**
  - Crear la función que evalúa el $QualityScore$, $Discount\%$ y $HistoricalLow$ para puntuar las ofertas de 0 a 10.
- [x] **5.2. Crear Endpoints REST para el Frontend (Astro SSR)**
  - `GET /deals/hottest`: Retorna el top de ofertas según el algoritmo.
  - `GET /games/:slug`: Retorna la ficha completa del juego, metadatos, precios por tienda e histórico.
  - `GET /franchises/:slug/route`: Retorna el roadmap ordenado para jugar una saga completa.
  - `GET /games/:id/price-history`: Retorna la serie de tiempo para renderizar gráficos en el cliente (Chart.js).

---

## 🧪 Fase 6: Despliegue de Prueba en VPS Linux

- [ ] **6.1. Dockerizar la Aplicación NestJS**
  - Crear `Dockerfile` de producción y `docker-compose.yml` (NestJS + PostgreSQL).
- [ ] **6.2. Configuración de CI/CD con GitHub Actions**
  - Crear flujo de trabajo que construya y despliegue el código automáticamente al VPS en cada `push` a `main`.
- [ ] **6.3. Configuración de Nginx y Certbot (SSL)**
  - Configurar Nginx como Reverse Proxy apuntando al contenedor/puerto de NestJS y habilitar HTTPS.

---

## ⚡ Fase 7: Migración del Backend a Fastify

Reescribir el backend completo en **Fastify 5** (Node 22 LTS, TypeScript
`strict`), eliminando la abstraccion de NestJS: sin contenedor de inyeccion de
dependencias, sin modulos, sin decoradores de routing, sin pipes, sin
interceptores y sin `class-validator`. El objetivo es **velocidad** (arranque
inmediato, menos capa entre la peticion y la base de datos) y **codigo que se
lee de un tiron**: controladores, servicios, handlers, hooks y middlewares,
cada uno en su sitio y sin indireccion.

A diferencia de una reescritura en otro lenguaje, aqui **se conserva la
capa de datos**: TypeORM, las entidades y las 8 migraciones ya aplicadas
siguen igual. La migracion es del framework HTTP y del armazon de la
aplicacion, no del modelo de datos.

### 7.0 Decisiones de arquitectura

- [x] **7.0.1. Mapa de sustituciones: NestJS → Fastify**
  - `Module` + `providers` → **plugins** de Fastify (`fastify-plugin`), que son el mecanismo de encapsulacion nativo: cada plugin recibe la instancia y expone lo que necesite. No hay contenedor de dependencias ni `forRootAsync`.
  - `Controller` + `@Get/@Post` → **controladores** como plugins que declaran `fastify.get('/ruta', { schema }, handler)`.
  - `Service` → clase normal en `services/`, sin `@Injectable()`. Si necesita estado, se instancia en el plugin que la usa.
  - `Guard` (autenticacion, admin) → **hook** `preHandler` registrado con `fastify.addHook('preHandler', ...)`, con un decorador de ruta (`preHandler: requireAuth`) para marcar rutas puntuales.
  - `Pipe` (`ValidationPipe`) → **esquemas JSON Schema** declarados en la ruta. Fastify valida con Ajv de serie: sin `class-validator`, sin `class-transformer` y sin `whitelist` manual.
  - `Interceptor` / `ExceptionFilter` → **hooks** `onResponse` (tiempo de respuesta, id de peticion) y `setErrorHandler` (formato uniforme de error).
  - `ConfigService` + Joi → modulo `config.ts` propio: un objeto `config` construido al arrancar a partir de `process.env`, validado a mano y **con error claro si falta algo**. Se conserva `dotenv`.
  - `TypeORM` (`Repository`, `DataSource`, `QueryBuilder`) → **se mantiene tal cual**. Es la mayor ventaja de esta migracion.
  - `@nestjs/schedule` + `cron` → **plugin propio** con `node-cron` (ya presente como dependencia transitiva de `cron`): se registra en el `onReady` de Fastify y se detiene en el `onClose`.
  - `@nestjs/swagger` → `@fastify/swagger` + `@fastify/swagger-ui` (OpenAPI 3.1 en `/docs`, generado de los mismos esquemas que validan).
  - `@nestjs/throttler` → `@fastify/rate-limit`.
  - `class-validator` → **TypeBox** (`@sinclair/typebox`) con `@fastify/type-provider-typebox`: da type-safety en tiempo de compilacion y JSON Schema para validar y documentar, con una sola fuente de verdad.
  - `express` → `fastify` (el servidor HTTP integrado), `@fastify/cors`, `@fastify/helmet`.
  - `argon2` (node) → **se mantiene tal cual** (`argon2` nativo).
  - `@nestjs/jwt` → `@fastify/jwt` (HS256 fijo).
  - `axios` / `fetch` → se mantiene `fetch` nativo de Node 20.
- [x] **7.0.2. Estructura de directorios objetivo**

  ```
  api/
  ├── src/
  │   ├── server.ts          # buildServer(): instancia Fastify, plugins, rutas, arranque
  │   ├── index.ts           # entrypoint: listen() con apagado ordenado
  │   ├── config.ts          # config tipada desde process.env + dotenv
  │   ├── plugins/
  │   │   ├── database.ts    # TypeORM DataSource + decoracion `db`
  │   │   ├── auth.ts        # @fastify/jwt + decoracion `authenticate`
  │   │   ├── cors.ts        # @fastify/cors con la allowlist de CORS_ORIGIN
  │   │   ├── swagger.ts     # @fastify/swagger + swagger-ui en /docs
  │   │   ├── rate-limit.ts  # @fastify/rate-limit
  │   │   └── scheduler.ts   # node-cron: cron diario de precios
  │   ├── hooks/
  │   │   ├── auth.ts        # preHandler: exige Bearer y adjunta request.user
  │   │   ├── admin.ts       # preHandler: cabecera x-admin-secret
  │   │   ├── timing.ts      # onResponse: duracion + X-Request-Id
  │   │   └── error.ts       # setErrorHandler: {message, error, statusCode}
  │   ├── schemas/           # esquemas TypeBox (body, query, params, response)
  │   ├── controllers/       # plugins de rutas: auth, catalog, games, prices,
  │   │                     #   franchises, deals, publications, igdb, steam,
  │   │                     #   price-sync, wishlist, health, admin-sync
  │   ├── services/          # logica de negocio pura
  │   ├── handlers/          # clientes de APIs externas: steam, igdb, google
  │   ├── entities/          # entidades TypeORM (SIN CAMBIOS)
  │   ├── migrations/        # migraciones TypeORM (SIN CAMBIOS)
  │   └── seed/              # scripts de CLI: seed, seed-publications, sync-random
  ├── test/                  # tests con fastify.inject()
  ├── package.json
  ├── tsconfig.json
  └── Dockerfile
  ```

  El esquema de base de datos **no se toca**: `entities/` y `migrations/` se
  mueven de sitio sin modificarse.

### 7.1 Andamiaje del proyecto

- [x] **7.1.1. Dependencias**
  - Se anaden: `fastify`, `fastify-plugin`, `@fastify/cors`, `@fastify/helmet`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/swagger-ui`, `@fastify/type-provider-typebox`, `@sinclair/typebox`.
  - Se eliminan al final (7.12): `@nestjs/*`, `class-validator`, `class-transformer`, `joi`, `reflect-metadata`, `rxjs`.
  - Se conservan: `typeorm`, `pg`, `argon2`, `dotenv`, `node-cron` (via `cron`).
- [x] **7.1.2. Configuracion**
  - `src/config.ts` expone un objeto `config` con la **misma estructura y los mismos nombres de variable** que el `.env` actual (`PORT`, `DB_*`, `CORS_ORIGIN`, `JWT_*`, `GOOGLE_*`, `STEAM_*`, `IGDB_*`, `PRICE_SYNC_*`, `WISHLIST_*`, `ADMIN_SYNC_SECRET`, `SYNC_RANDOM_*`). El `.env` no se toca.
  - Validacion al arrancar: si falta una variable obligatoria (por ejemplo `JWT_SECRET` en produccion, o `DB_PASSWORD`), el proceso falla con un mensaje que dice exactamente cual falta. El `.env` sigue siendo el unico sitio con secretos.
- [x] **7.1.3. `server.ts` e `index.ts`**
  - `buildServer()` construye y devuelve la instancia de Fastify con los plugins, hooks y controladores ya registrados. Es una funcion pura: permite tests con `fastify.inject()` sin abrir un puerto.
  - `index.ts` hace `listen()` y registra `onClose` para cerrar el DataSource de TypeORM y parar el cron.
  - `GET /health` responde igual que ahora: `{"status","database","timestamp"}`.

### 7.2 Capa de datos (sin cambios)

- [x] **7.2.1. Entidades y migraciones**
  - `src/entities/` y `src/migrations/` se trasladan **sin modificar una linea**. TypeORM, `SnakeNamingStrategy` y `synchronize: false` se conservan tal cual.
  - Se mantiene la constraint `chk_users_email_format` con el punto escapado (`\.`), que es la version corregida en la migracion `1768000000000`.
- [x] **7.2.2. Acceso a datos**
  - `src/plugins/database.ts` crea el `DataSource` y lo decora en la instancia de Fastify (`fastify.db`), para no arrastrar el `DataSource` por constructor en cada servicio.
  - Los repositorios de TypeORM (`Repository<T>`) siguen igual. Se retira solo el uso de `DataSource.query()` en crudo donde estrope: en un `UPDATE` con `RETURNING`, `dataSource.query()` devuelve `[filas, afectadas]`, no las filas. Ese punto esta en `session.service.ts` y hay que vigilarlo al migrarlo.
- [x] **7.2.3. Verificacion del esquema**
  - `npm run migration:run` sigue funcionando igual: no hay migraciones nuevas ni que revertir.

### 7.3 Nucleo transversal: hooks y middlewares

- [x] **7.3.1. `src/hooks/auth.ts` (autenticacion)**
  - Hook `preHandler` que exige `Authorization: Bearer <token>` y adjunta `request.user` con `{ id, email, jti }`.
  - Se valida con `@fastify/jwt` fijando `algorithms: ['HS256']`: un token firmado con otro algoritmo (o con `alg: none`) se rechaza.
  - **Deniega por defecto**: se registra como hook global y las rutas publicas lo desactivan con `config: { auth: false }` en la definicion de la ruta.
  - Nunca se distingue entre token expirado, mal formado o de otro algoritmo: el mensaje es siempre el mismo.
- [x] **7.3.2. `src/hooks/admin.ts` (secreto de administracion)**
  - Hook `preHandler` que comprueba la cabecera `x-admin-secret` contra `ADMIN_SYNC_SECRET` / `STEAM_ADMIN_SECRET` / `IGDB_ADMIN_SECRET` / `PRICE_SYNC_ADMIN_SECRET`. Si el secreto no esta configurado, el endpoint queda cerrado (403).
- [x] **7.3.3. `src/hooks/timing.ts` y `src/hooks/error.ts`**
  - `onResponse`: mide la duracion, genera un id de peticion (`X-Request-Id`) y lo anade al log de acceso.
  - `setErrorHandler`: convierte cualquier error en `{ message, error, statusCode }`, el cuerpo que el frontend ya sabe leer. Los errores de validacion de Ajv se traducen a un 400 legible.
- [x] **7.3.4. Middlewares de plugin**
  - `@fastify/cors` con la allowlist de `CORS_ORIGIN` (lista vacia = sin CORS, con aviso en el log).
  - `@fastify/rate-limit`: 5/min en registro, login y confirmacion de vinculacion; 10/min en el canje social.
  - `@fastify/helmet` con las cabeceras de seguridad.

### 7.4 Autenticacion

- [x] **7.4.1. Passwords y tokens**
  - `argon2` nativo se mantiene. `verifyDummy()` para no filtrar si un email existe.
  - Emision de JWT con `@fastify/jwt`: `sub` (uuid), `email`, `jti`, `iat`, `exp`; `HS256` fijo; `JWT_ACCESS_TTL` (15m) y `JWT_REFRESH_TTL` (30d).
  - Refresh tokens opacos: se persiste **solo** el SHA-256 en `refresh_tokens`.
- [x] **7.4.2. Rotacion de refresh tokens (sin regresion)**
  - La rotacion se hace con SQL crudo (`dataSource.query`) porque necesita el `UPDATE ... RETURNING` atomico.
  - Recordatorio critico: en un `UPDATE`, `dataSource.query()` devuelve `[filas, afectadas]`. Hay que desempaquetar el primer elemento; si no, un token ya revocado se acepta como valido.
  - Un token ya revocado o ya rotado se trata como robo: se revocan **todas** las sesiones del usuario y se responde 401.
  - `logout` es idempotente (`{"revoked": 0}` si no habia nada que revocar).
- [x] **7.4.3. Login social**
  - Google OAuth 2.0 con PKCE (S256) y `state` de un solo uso (almacen en memoria con expiracion de 10 minutos).
  - Steam OpenID 2.0: validacion de la firma RSA y extraccion del SteamID64.
  - Traspaso al frontend: el callback redirige a `/cuenta?social=<codigo>` con un **codigo opaco de un solo uso** (2 minutos). El frontend canjea el codigo con `POST /auth/social/exchange`. Los tokens nunca viajan en la URL.
  - Vinculacion de cuentas: si el email social ya existe en `users`, no se vincula solo; se emite un `linkToken` de un solo uso y se confirma con `POST /auth/link/confirm` (contrasena de la cuenta local).
- [x] **7.4.4. Endpoints de auth**
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/social/exchange`, `POST /auth/link/confirm`, `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/steam`, `GET /auth/steam/callback`.

### 7.5 Lectura: catalogo, juegos, precios, sagas, ofertas, publicaciones

- [x] **7.5.1. Servicios de lectura**
  - `catalog_service`, `games_service`, `prices_service`, `franchises_service`, `deals_service`, `publications_service`. Sin repositorios intermedios: cada servicio recibe el `Repository` y devuelve datos planos que el esquema de respuesta de TypeBox valida.
  - El calculo de **deal score** (0-10) se migra tal cual: `deals/deal-score.service.ts` → `src/services/deal_score.ts`.
- [x] **7.5.2. Endpoints**
  - `GET /catalog`, `GET /games/{slug}`, `GET /games/{id}/price-history`, `GET /deals/hottest`, `GET /franchises`, `GET /franchises/{slug}/route`, `GET /publications`, `GET /publications/categories`, `GET /publications/{slug}`.
  - **El JSON de respuesta debe ser identico** al de NestJS: el frontend Astro (`web/src/lib/api.ts`) no se toca en esta fase.
  - Cada ruta declara su `response` en TypeBox: ademas de documentar, sirve para validar la forma de la respuesta.

### 7.6 Ingesta externa: handlers de Steam e IGDB

- [x] **7.6.1. `src/handlers/steam.ts`**
  - Cliente `fetch` de `store.steampowered.com/api/appdetails`: precio, descuento, valoracion y tamano de descarga, con `STEAM_COUNTRY_CODE`, `STEAM_LANGUAGE`, `STEAM_TIMEOUT_MS`, `STEAM_MAX_RETRIES` y el tope de cache LRU+TTL (`STEAM_CACHE_MAX_ENTRIES`).
  - Reintentos con espera exponencial y respeto del rate limit.
- [x] **7.6.2. `src/handlers/igdb.ts`**
  - OAuth contra Twitch (token cacheado con su expiracion), consultas Apicalypse, limite de 4 peticiones por segundo, y el stub local (`tools/igdb-stub.mjs`) se mantiene para poder probar sin credenciales.
- [x] **7.6.3. Endpoints**
  - `GET /steam/app/{appId}`, `GET /steam/product/{appId}`, `POST /steam/batch`, `POST /steam/sync`, `GET /igdb/search`, `GET /igdb/games/search`, `GET /igdb/games/{igdbId}`, `POST /igdb/sync`.

### 7.7 Price sync y tareas programadas

- [x] **7.7.1. `src/services/price_sync.ts`**
  - Recorrido paginado del catalogo (`PRICE_SYNC_BATCH_SIZE`), escritura idempotente en `price_history` (`ON CONFLICT DO NOTHING` sobre `(store_product_id, recorded_at)`), y el calculo de variacion, minimo historico y estado de disponibilidad.
  - El lock de `price_sync_locks` se conserva con `PRICE_SYNC_LOCK_TIMEOUT_SECONDS`.
  - `PRICE_SYNC_MAX_FAILURE_RATE` sigue abortando el ciclo de la tienda si la tasa de fallos tecnicos lo supera.
- [x] **7.7.2. Planificador**
  - `src/plugins/scheduler.ts` con `node-cron`: `PRICE_SYNC_CRON` (por defecto `0 6 * * *`) en **UTC** y `PRICE_SYNC_ENABLED` para desactivarlo.
  - El job se registra en `onReady` y se detiene en `onClose`. La expresion cron y la decision de activarlo vienen de `config`, no de variables leidas al cargar un modulo.
- [x] **7.7.3. Endpoints**
  - `GET /price-sync/status`, `POST /price-sync/run` (admin), `GET /price-sync/history/{storeProductId}`.

### 7.8 Wishlist

- [x] **7.8.1. Servicio y endpoints**
  - `GET /wishlist` (paginado, con filtro por tienda), `POST /wishlist` (por `gameId` o `slug`; duplicado → 409), `DELETE /wishlist/{gameId}`, `DELETE /wishlist/slug/{slug}`, `POST /wishlist/sync/{store}`.
  - `POST /wishlist/sync/{store}` responde 200 con `status: "not_configured"` y el motivo (`Falta configurar WISHLIST_GOG_API_KEY`) en vez de fallar: las APIs de wishlist de GOG y Nintendo no estan disponibles y no hay cliente real que verificar.
- [x] **7.8.2. Tabla `wishlist_items`**
  - Entidad TypeORM sin cambios: FK a `games` con `on_delete=CASCADE` y unicidad por `(user_id, game_id)`.

### 7.9 Scripts de CLI

- [x] **7.9.1. Migracion de los scripts**
  - `seed` (catalogo, saga, ofertas e historico), `seed:publications` (contenido editorial) y `sync:random` (juegos de prueba de Steam y Nintendo) se trasladan a `src/seed/`.
  - `sync:random` reutiliza los **mismos** codigos sinteticos de `igdb_id` (hash estable dentro de `9_000_000_000_000` para Steam y `9_500_000_000_000` para Nintendo) para no duplicar juegos al alternar entre el script antiguo y el nuevo.
  - Los tres scripts deben seguir siendo **idempotentes**.
  - La resolucion de imports con extension `.js` que hace `scripts/ts-node-js-resolver.js` se simplifica: con TypeScript moderno (`moduleResolution: nodenext` o `bundler`) los imports relative sin extension ya funcionan.

### 7.10 Tests y paridad con el frontend

- [x] **7.10.1. Fixtures de contrato (golden JSON)**
  - Antes de borrar NestJS, capturar la respuesta real de los 40 endpoints contra la base de desarrollo y guardarla como fixtures (`test/fixtures/*.json`).
  - Cada test de Fastify compara su respuesta con el fixture: mismo status, mismas claves, mismos tipos (y mismo redondeo de los `numeric`).
- [x] **7.10.2. Suite de tests**
  - Jest (el que ya hay) con `fastify.inject()`: se prueba la app entera **sin abrir un puerto**, que es mas rapido y mas estable que supertest.
  - `buildServer()` se reutiliza tal cual en los tests, asi que lo que se prueba es exactamente lo que se despliega.
  - Cubren: deal score, rotacion y revocacion de refresh tokens, traspaso social de un solo uso, validacion de entradas, idempotencia del sync y del seed, y los endpoints de lectura contra los fixtures.
- [x] **7.10.3. Verificacion contra el frontend**
  - `web/` no se modifica. Se levanta Fastify en el puerto 3000 y se recorre `/`, `/ofertas`, `/juego`, `/saga`, `/publicaciones`, `/publicacion`, `/cuenta` y `/wishlist` con sesion iniciada: los precios, las caratulas, el grafico y la lista de deseos deben verse igual que con NestJS.
  - Recorrido hecho sobre la API de Fastify: las ocho paginas cargan datos reales, el registro y el inicio de sesion funcionan, `POST /wishlist` devuelve 201 y la ficha refleja si el juego ya esta en la lista.
  - **Desviacion**: hubo que tocar `web/` en dos puntos, ambos bugs preexistentes del frontend que la migracion destapo (ver 7.14).

### 7.11 Despliegue

- [x] **7.11.1. `Dockerfile`**
  - Se actualiza el `CMD` a `node dist/index.js` y se compila con `tsc` (o `tsup`) en lugar de `nest build`. La imagen multi-stage y el usuario sin privilegios se conservan.
- [x] **7.11.2. `docker-compose.prod.yml`**
  - El servicio `api` y el `migrate` (`node ./node_modules/typeorm/cli.js ...`) **no cambian**: la CLI de TypeORM es la misma.
  - El servicio `web` no cambia: sigue compilando Astro con `PUBLIC_API_URL=/api`.
- [x] **7.11.3. Nginx y variables**
  - `nginx/gorodeals.conf` y `web/nginx.conf` no cambian: el proxy sigue siendo el mismo.
  - `DEPLOY.md` se actualiza con los comandos (`npm run build`, `npm run start:prod`, `npm test`).

### 7.12 Retirada de NestJS

- [x] **7.12.1. Borrado del codigo Node de Nest**
  - Se eliminan `api/src/auth/guards/`, `api/src/auth/dto/` (los DTO pasan a TypeBox), `api/src/app.module.ts`, `api/src/main.ts`, `api/src/app.service.ts`, y todos los `*.controller.ts` / `*.module.ts` / `*.guard.ts` / `*.decorator.ts` de Nest.
  - Se conservan `entities/`, `migrations/`, `services/`, `handlers/`, `scripts/` reubicados.
  - Se conserva el historial en git: no se reescribe la historia.
- [x] **7.12.2. Dependencias**
  - `package.json` se limpia: fuera `@nestjs/*`, `class-validator`, `class-transformer`, `joi`, `reflect-metadata`, `rxjs`, `@nestjs/schedule`.
- [x] **7.12.3. Documentacion**
  - `api/README.md` se reescribe para Fastify (arranque, migraciones, tests, endpoints) manteniendo la seccion de "probar la API" y el troubleshooting ya aprendidos.
  - `AGENTS.md` se actualiza: las convenciones pasan a ser de Fastify (controladores, servicios, handlers, hooks, middlewares; TypeBox para validacion; TypeORM y sus migraciones sin cambios).
  - El titulo del roadmap pasa a "Backend de Prueba con Fastify" y se anota que las fases 1-6 se hicieron sobre NestJS y la 7 migra el resultado.

### 7.13 Criterio de cierre de la fase

- [x] Los 40 endpoints responden con el mismo contrato que el backend de NestJS (verificado contra los fixtures).
- [x] El frontend `web/` funciona sin ninguna modificacion *de contrato*: la API que consume no ha cambiado. Se corrigieron dos bugs preexistentes del frontend (ver 7.14).
- [x] `npm test` en verde y `npm run lint` sin errores.
- [x] `npm run migration:run` sigue funcionando: el esquema no ha cambiado.
- [x] El cron de precios se registra y se ejecuta a su hora en UTC.
- [ ] El despliegue con Docker levanta API, web y PostgreSQL, y Nginx sirve el sitio con HTTPS.
  - Verificado en local: la imagen de la API (Node 22 slim) arranca contra
    PostgreSQL real, la imagen del frontend se construye y su Nginx sirve el
    sitio y hace de proxy a `/api` (200 en `/`, `/api/catalog` y `/healthz`).
    Falta la parte de HTTPS: la terminacion con Let's Encrypt y el despliegue
    al VPS, que no cambian respecto a la Fase 6 y requieren el servidor.

### 7.14 Notas de la implementacion (2026-11-12)

Estado real de la fase, con las desviaciones respecto a lo planificado:

- **La migracion es completa**: no queda ninguna dependencia de NestJS. Los
  servicios, las entidades y las migraciones siguen donde estaban, pero sin
  `@Injectable`, `@InjectRepository`, `Logger` de Nest ni `ConfigService`.
- **Inyeccion de dependencias a mano**: `src/context.ts` construye el grafo de
  servicios (`buildServices(dataSource)`) y `src/plugins/core.ts` lo decora
  en la instancia de Fastify como `fastify.services`. No hay contenedor.
- **Excepciones propias**: `src/errors.ts` reimplementa la semantica de
  `HttpException` de Nest (`getStatus()`, mensajes por defecto, cuerpo
  `{ statusCode, message, error }`). `src/hooks/error.ts` traduce cualquier
  excepcion a la respuesta HTTP.
- **Configuracion**: `ConfigService.get('priceSync.batchSize')` se sustituyo
  por el arbol tipado `AppConfig` (`this.config.priceSync.batchSize`). Los
  valores por defecto ya estan resueltos en `src/config/configuration.ts`, de
  modo que desaparecen los `??` de cada lectura.
- **Logging**: `src/logger.ts` expone `createLogger('<Servicio>')` sobre
  `pino` (el motor de Fastify). Cada servicio tiene su logger hijo con el
  nombre del contexto, y no se escribe nunca en `console`.
- **Estructura de directorios**: se conserva la agrupacion por dominio
  (`src/<dominio>/`) en lugar de `services/` y `handlers/` planos. Los
  controladores, esquemas, hooks y plugins si usan la estructura plana
  prevista.
- **Autenticacion**: `TokenService` no usa `@nestjs/jwt`; firma y verifica
  con `fast-jwt` (la base de `@fastify/jwt`), con `HS256` fijo. El secreto
  efimero de desarrollo se memoiza por proceso (`src/config.ts`).
- **Orden de los hooks**: en NestJS los guards se ejecutan **antes** de la
  `ValidationPipe`. En Fastify la validacion del esquema ocurre entre
  `preValidation` y `preHandler`, asi que tanto el hook global de
  autenticacion como `requireAdminSecret(...)` van en `preValidation`: el
  secreto se comprueba antes de validar el cuerpo, que es el orden que
  tenia el guard.
- **Validacion**: TypeBox + Ajv. El cuerpo de error es el mismo que en
  NestJS (`{ statusCode, message, error }`), pero el texto de los mensajes de
  validacion es el de Ajv y no el de `class-validator`, y `message` es una
  lista (como en NestJS) en lugar de una cadena.
- **Cuerpo JSON vacio**: Fastify rechaza con 400 un `DELETE` sin cuerpo pero
  con `content-type: application/json`. Se acepta el cuerpo vacio como `{}`
  para no romper al frontend.
- **`GET /wishlist?store=...`**: NestJS rechaza el parametro (400) porque su
  DTO no lo declara, pero el frontend si lo envia. En Fastify se acepta y
  filtra: es el comportamiento que pide el roadmap (7.8.1) y el que necesita
  el frontend.
- **Tipos**: los tipos de entrada y de salida de los servicios salen de los
  esquemas TypeBox (`Static<typeof Esquema>`). Se borraron todos los DTO de
  Nest y sus carpetas `dto/`: el esquema valida, documenta y tipa, de modo que
  no hay una segunda fuente de verdad.
- **Paridad**: se verifica contra los *fixtures* de contrato
  (`api/test/fixtures/contract.json`), capturados del backend de NestJS antes
  de retirarlo. La suite `npm run test:e2e` recorre los endpoints declarados
  en `api/test/contract.json` y compara estado, claves y tipos de la
  respuesta real con los fixtures. Los endpoints que dependen de un
  proveedor externo (Steam, IGDB) se informan como omitidos si el proveedor
  no esta disponible, para que un fallo de la red no rompa la suite.
- **Cierre ordenado**: el hook `onModuleDestroy()` de NestJS paso a ser un
  metodo normal `onDestroy()` en `PriceSyncService`. Fastify no lo invoca solo:
  lo llama el hook `onClose` de `src/plugins/scheduler.ts`, que corre antes
  que el cierre de la base de datos (los hooks `onClose` se ejecutan en orden
  inverso al de registro). Asi el lock de `price_sync_locks` se libera igual
  que en NestJS.
- **Docker**: la imagen paso de `node:20-alpine` a `node:22-slim`. `argon2`
  solo publica binarios precompilados y en Alpine (musl) no hay ninguno
  compatible, asi que `npm ci` intentaba compilar y fallaba (el paquete
  publicado no incluye el codigo fuente). En Debian el binario precompilado
  funciona y no hace falta cadena de compilacion. Ademas, el binario
  precompilado de `argon2` provoca un **fallo de segmentacion** al cargarse
  en Node 20, de modo que la imagen (y el proyecto) pasan a Node 22 LTS, que
  ya es la version activa. La comprobacion de salud usa el `fetch` nativo de
  Node en lugar de `curl`.
- **Tests**: `npm test` (111 tests) y `npm run test:e2e` (47 tests con
  `fastify.inject()`, 2 suites, una de ellas la de contrato) en verde. Para
  que Jest pueda cargar los plugins de Fastify se transforman tambien unas
  pocas dependencias ESM.
- **Frontend: dos correcciones que la migracion destapo** (unica desviacion
  de 7.10.3, que decia que `web/` no se tocaba):
  - `web/src/pages/juego.astro`: el panel del grafico se mostraba **despues**
    de crear el grafico. Chart.js mide el lienzo al construirlo, asi que con
    el panel oculto el lienzo quedaba a 0x0 y el historico de precios no se
    veia. Ahora el panel se muestra antes de `new Chart(...)`.
  - `web/src/pages/juego.astro`: la ficha pedia la wishlist con `limit=200`, y
    la API acepta como mucho 100 por pagina: la peticion devolvia 400 y el
    boton no podia saber si el juego ya estaba en la lista. Ahora pide 100.
- **Despliegue verificado en local**: se construyen las dos imagenes (API con
  Node 22 slim, frontend con Astro + Nginx). El contenedor de la API arranca
  contra PostgreSQL real y responde `/health`, `/catalog`, `/deals/hottest` y
  `/docs/json`; el `POST /auth/register` devuelve 201, lo que confirma que
  `argon2` funciona dentro de la imagen. El contenedor del frontend sirve el
  sitio estatico y hace de proxy inverso a `/api`. La terminacion HTTPS con
  Let's Encrypt sigue en el VPS, sin cambios respecto a la Fase 6.
