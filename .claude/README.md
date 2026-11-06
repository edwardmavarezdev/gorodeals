# claudeNestPostgres

Sistema de agentes y orquestadores para la creación, mantenimiento y despliegue del backend **gorodeals**: una API **NestJS + PostgreSQL** para seguimiento de precios de videojuegos y guías.

El backend vive en `api/` del repo `gorodeals`. Las fases del roadmap funcional están en `roadmap_backend_test_nestjs.md`.

## Estructura

```
claudeNestPostgres/
├── agents/         Agentes especializados invocables
├── orquestador/    Comandos que orquestan pipelines de agentes
└── settings.local.json
```

## Stack

| Elemento | Decisión |
|---|---|
| Framework | NestJS 11, Node 20 LTS, TypeScript 5 `strict` |
| Base de datos | PostgreSQL 16 (Docker) |
| ORM | TypeORM 0.3 con `SnakeNamingStrategy`, `synchronize: false` |
| Migraciones | TypeORM CLI, reversibles, patrón expand/contract |
| Configuración | `@nestjs/config` + Joi, `ConfigService` |
| Validación | `class-validator` + `class-transformer`, `ValidationPipe` global con `whitelist` |
| Documentación | `@nestjs/swagger` |
| Tareas programadas | `@nestjs/schedule` (+ BullMQ si se requiere cola) |
| Sesiones | JWT (Passport) + refresh tokens rotativos en Postgres, argon2id |
| Convenciones | Sin emojis. Español técnico. Frontmatter YAML en todos los `.md`. |

## Agentes

### N núcleo backend

| Agente | Rol |
|---|---|
| `nestjs-expert` | Implementador senior de features, endpoints, módulos y entidades TypeORM en `api/`. |
| `postgres-expert` | Arquitecto de datos: modelo, índices, queries, migraciones y performance de PostgreSQL. |
| `nestjs-qa` | Auditor de calidad de código y adherencia a las convenciones del proyecto. |
| `nestjs-performance-reviewer` | Revisión de escalabilidad: paginación, índices, N+1, crons y pool de conexiones. |
| `security-reviewer` | Auditor de seguridad: auth, OAuth, tokens, SQL injection, autorización y secretos. |

### Especialistas por fase del roadmap

| Agente | Rol | Fases |
|---|---|---|
| `igdb-expert` | OAuth de Twitch, queries Apicalypse, mapeo a `games`, sync del catálogo, rate limit de 4 req/s. | 3.1 |
| `steam-expert` | API `appdetails` en lotes, precios y descuentos, OpenID 2.0 y manejo del SteamID64. | 3.2 y 4.2 |
| `price-sync-expert` | Cron diario idempotente, `price_history`, paginación del catálogo, deal score e histórico. | 3.3 |
| `auth-expert` | `User` / `SocialAccount` / `UserSession`, login por email, Google OAuth 2.0, Steam, refresh tokens rotativos. | 4.1, 4.3 y login global |
| `wishlist-expert` | Wishlist propia y sincronización con tiendas externas (GOG, Nintendo). | 4.4 y extensión |

## Orquestadores

| Comando | Pipeline |
|---|---|
| `fase-task` | Detecta la fase del roadmap y enruta al orquestador correspondiente. Punto de entrada recomendado. |
| `backend-task` | `nestjs-expert` → `nestjs-qa` → `nestjs-performance-reviewer` → `security-reviewer` → correcciones → verificación. |
| `schema-task` | `postgres-expert` → `nestjs-expert` → `nestjs-qa` → `nestjs-performance-reviewer` → verificación con migración reversible. |
| `ingesta-task` | Enruta a `igdb-expert`, `steam-expert` o `price-sync-expert` según la tarea, y valida el resultado. |
| `auth-task` | `auth-expert` → `nestjs-qa` → `security-reviewer` → `nestjs-performance-reviewer` → verificación. |
| `wishlist-task` | Viabilidad por tienda → `wishlist-expert` → `nestjs-qa` → `security-reviewer` → `nestjs-performance-reviewer`. |

Todos los orquestadores ejecutan los agentes **en foreground y secuencialmente**, con una pasada de correcciones y una verificación real (`npm run build`, `npm run lint`) antes de declarar el trabajo terminado.

## Modelo de datos de referencia

| Tabla | Propósito |
|---|---|
| `games` | Maestro de juegos. `igdb_id` unique, `slug` unique, `quality_score`. |
| `store_products` | Precios actuales por tienda. `UNIQUE (game_id, store_name, store_product_id)`. |
| `price_history` | Histórico append-only. Índice `(store_product_id, recorded_at DESC)`. |
| `franchises` | Sagas. |
| `franchise_play_order` | Orden recomendado de la saga. |
| `users` | Cuentas. `email` citext unique, `password_hash` nullable. |
| `social_accounts` | Cuentas sociales. `UNIQUE (provider, provider_account_id)`. |
| `user_sessions` | Refresh tokens hasheados, con expiración y revocación. |
| `wishlist_items` | `UNIQUE (user_id, game_id)`. |
| `store_connections` | Tokens de tiendas externas **cifrados en reposo**. |

Convenciones transversales: `numeric` para dinero, `citext` para emails, `text` para IDs de proveedor no numéricos (el SteamID64 excede los 53 bits de un `number` de JavaScript), `timestamptz` para fechas, `uuid` como PK, y `onDelete` explícito en toda FK.

## Limitaciones conocidas de las integraciones

Estas restricciones están incorporadas en los agentes para que no se prometan capacidades inexistentes:

- **Steam** no expone API de wishlist. No está implementado.
- **Nintendo** no tiene API pública del eShop ni de wishlist. Se cubre con un catálogo curado y marcado manual asistido, no con sincronización.
- **GOG** tiene endpoint de wishlist, pero es un contrato interno de su web, no una API pública estable. Hay que verificarlo en vivo antes de construir sobre él.
- **Steam `appdetails`** no incluye el tamaño de descarga; requiere la Steam Web API con key.
- **IGDB** limita a 4 peticiones por segundo y no tiene endpoint de búsqueda por slugs estables.

## Convenciones

- Sin emojis.
- Español técnico consistente en todos los agentes.
- Frontmatter YAML en todos los `.md` (`name`, `description`, `tools`).
- Cada agente tiene contexto del proyecto, reglas, checklist, antipatrones y formato de respuesta.
- Cada orquestador ejecuta agentes **en foreground y secuencialmente**.
- Los agentes nunca inventan capacidades de una API externa: si una vía no existe, la documentan.

## Permisos

`settings.local.json` permite sin confirmación los comandos de verificación habituales del ciclo de desarrollo (`npm run build`, `npm run lint`, `npm test`, comandos de migración de TypeORM y `docker compose`).
