# GoRoDeals — Reglas de proyecto

Backend Fastify 5 + PostgreSQL para seguimiento de precios de videojuegos y rutas de sagas.

## Estructura

```
gorodeals/
├── api/                 API Fastify (backend)
│   ├── src/
│   │   ├── server.ts    buildServer(): plugins, hooks y rutas (función pura)
│   │   ├── index.ts     listen() y apagado ordenado
│   │   ├── config.ts    configuración tipada desde process.env + dotenv
│   │   ├── context.ts   buildServices(): grafo de servicios construido a mano
│   │   ├── errors.ts    excepciones HTTP (BadRequest, NotFound, ...)
│   │   ├── logger.ts    logger con contexto por servicio
│   │   ├── config/      configuration.ts (estructura y nombres del .env)
│   │   ├── database/    data-source.ts y migraciones TypeORM
│   │   ├── plugins/     database, core, cors, rate-limit, swagger, scheduler
│   │   ├── hooks/       auth, admin, timing, error
│   │   ├── schemas/     esquemas TypeBox (body, query, params, response)
│   │   ├── controllers/ un plugin de rutas por dominio
│   │   ├── seed/        scripts de CLI (seed, seed:publications, sync:random)
│   │   └── <dominio>/   servicios, entidades y migraciones por dominio
├── docker-compose.yml   PostgreSQL 16 en localhost:5432
└── roadmap_backend_test_nestjs.md
```

## Stack y convenciones

| Elemento | Decisión |
|---|---|
| Framework | Fastify 5, Node 22 LTS, TypeScript `strict` |
| Base de datos | PostgreSQL 16 (Docker, puerto local 5432) |
| ORM | TypeORM 0.3 con `SnakeNamingStrategy`, `synchronize: false` |
| Migraciones | TypeORM CLI, reversibles, patrón expand/contract |
| Configuración | `src/config.ts` (dotenv + validación a mano) |
| Validación | TypeBox (`@sinclair/typebox`) con Ajv: los esquemas validan y documentan |
| Errores | `src/errors.ts` (excepciones HTTP) + `src/hooks/error.ts` (traductor) |
| Logging | `src/logger.ts` (pino con contexto por servicio) |
| Documentación | `@fastify/swagger` + `@fastify/swagger-ui` (documento en `/docs`) |
| Tareas programadas | `cron` desde `src/plugins/scheduler.ts` (UTC) |
| Estilo | Sin emojis. Español técnico. Nombres en inglés para el código. |

## Reglas obligatorias

1. **Nunca** poner `synchronize: true`. El esquema solo cambia por migraciones.
2. Toda FK declara `onDelete` explícito e índice.
3. Dinero en `numeric`; IDs de proveedor no numéricos (SteamID64) en `text`.
4. Índices sobre toda columna usada en `WHERE`, `JOIN` u `ORDER BY` frecuente.
5. Todo endpoint valida la entrada con un esquema de TypeBox y declara su `response`.
   Los esquemas de respuesta deben enumerar **todos** los campos que devuelve
   el servicio: si falta uno, Fastify lo descarta al serializar.
6. Toda llamada a API externa pasa por la configuración (`src/config.ts`), con
   throttling y reintentos acotados.
7. Las tareas programadas deben ser idempotentes y paginar el catálogo.
8. Sin secretos en el código: solo `.env` (no versionado) y `.env.example`.
9. La autenticación es **deny by default**: toda ruta exige access token
   salvo las que declaran `config: { auth: 'disabled' }`. Las rutas
   administrativas usan `preValidation: requireAdminSecret(...)`: el hook va
   en `preValidation` y no en `preHandler` para que el secreto se compruebe
   **antes** de validar el cuerpo, que es el orden que tenía el guard en
   NestJS.
10. Los errores se lanzan con las excepciones de `src/errors.ts`
    (`BadRequestException`, `NotFoundException`, ...); el manejador de
    `src/hooks/error.ts` las traduce al cuerpo `{ statusCode, message, error }`.
    Cada servicio usa `createLogger('<Servicio>')` de `src/logger.ts` para los
    avisos; no se escribe en `console` directamente.
11. Los parámetros de ruta se escriben `:param` (no `{param}`): `find-my-way`
    solo reconoce los dos puntos.
12. Los tipos de entrada y de salida de un servicio salen de los esquemas
    TypeBox (`Static<typeof Esquema>`): los esquemas validan, documentan y
    tipan, de modo que no hay una segunda fuente de verdad.

## Comandos

```bash
cd api
npm run build              # compilación (tsc)
npm start                  # servidor en http://localhost:3000
npm run start:dev          # compila y reinicia al guardar
npm run lint               # eslint
npm test                   # tests unitarios y de hooks
npm run test:e2e           # tests de extremo a extremo con fastify.inject()
npm run migration:generate # genera migración a partir de las entidades
npm run migration:run      # aplica migraciones
npm run migration:revert   # revierte la última migración
npm run seed               # carga el catálogo y el histórico
docker compose up -d       # PostgreSQL local
```

### Paridad de contrato

El contrato de la API está congelado en los *fixtures* de `api/test/fixtures/contract.json`:
guardan la forma (estado, claves y tipos) de la respuesta de cada endpoint.
El test de contrato los compara con la respuesta real:

```bash
cd api
npm run test:e2e            # incluye la suite de contrato
```

Los *fixtures* se capturaron del backend de NestJS antes de retirarlo: son la
referencia del contrato que el frontend ya consume.
