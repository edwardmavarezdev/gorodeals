---
description: Detecta a qué fase del roadmap (roadmap_backend_test_nestjs.md) pertenece la tarea y enruta al orquestador correspondiente del proyecto gorodeals: backend-task, schema-task, ingesta-task, auth-task o wishlist-task. También detecta el estado del proyecto y propone el siguiente paso del roadmap.
argument-hint: <descripción de la tarea o intención a ejecutar>
---

Vas a clasificar la tarea: "$ARGUMENTS", determinar a qué fase del roadmap pertenece y enrutar al orquestador adecuado.

Este orquestador **NO ejecuta agentes por su cuenta**. Su rol es clasificar y delegar.

## Paso 0 — Detección del estado del proyecto

Antes de enrutar, inspecciona `api/` para saber en qué punto del roadmap estás:

1. **¿Existe `api/`?** Si no existe, el proyecto está en la **Fase 1** y el primer paso es el bootstrap: invoca `backend-task` con la tarea de crear el proyecto NestJS con TypeORM y PostgreSQL.
2. **¿Existe `api/src/database/migrations/` con migraciones?** Si no hay migraciones, el proyecto está en la **Fase 1.2 / Fase 2** (base de datos y modelo de datos): enruta a `schema-task`.
3. **¿Existe `api/src/igdb/`, `api/src/steam/` o `api/src/price-sync/`?** Determina qué parte de la **Fase 3** está implementada.
4. **¿Existe `api/src/auth/`?** Determina qué parte de la **Fase 4** está implementada.
5. **¿Existe `api/src/wishlist/`?** Determina el estado de la **Fase 4.4**.
6. **¿Existe `api/src/games/`, `api/src/franchises/` y endpoints de la Fase 5?** Determina el estado del algoritmo de puntuación y de los endpoints para el frontend.
7. **¿Existe `Dockerfile` y `.github/workflows/`?** Determina el estado de la **Fase 6**.

## Paso 1 — Enrutado por fase

| La tarea trata de... | Fase | Orquestador |
|---|---|---|
| Feature genérica de backend, endpoint, servicio, DTO, refactor | cualquiera | `backend-task` |
| Tablas, columnas, índices, entidades, migraciones, modelo de datos | 1.2 / 2 | `schema-task` |
| IGDB, Twitch, catálogo de juegos, metadatos, `igdb_id` | 3.1 | `ingesta-task` |
| Precios de Steam, `appdetails`, App IDs, descuentos | 3.2 | `ingesta-task` |
| Cron, `PriceSyncModule`, `price_history`, histórico, sincronización de precios, deal score | 3.3 | `ingesta-task` |
| `User`, `SocialAccount`, registro, login por email | 4.1 | `auth-task` |
| Login con Steam (OpenID) y captura del SteamID64 | 4.2 | `ingesta-task` (agente `steam-expert`) |
| Login con Google (OAuth 2.0) | 4.3 | `auth-task` |
| Wishlist propia: añadir, quitar, listar juegos | 4.4 | `wishlist-task` |
| Sincronización de wishlist con GOG o Nintendo | 4.4 (ext.) | `wishlist-task` |
| `quality_score`, deal score, `GET /deals/hottest` | 5.1 | `backend-task` |
| Endpoints para Astro: `/games/:slug`, `/franchises/:slug/route`, `/games/:id/price-history` | 5.2 | `backend-task` |
| Dockerfile, `docker-compose.yml`, GitHub Actions, Nginx, Certbot | 6 | `backend-task` |

Si la tarea **cruza varias fases**, ejecuta los orquestadores **en el orden de dependencia del roadmap**, uno después del otro, y reporta cada bloque por separado. Ejemplo típico: "sincronizar precios de Steam" necesita Fase 3.2 antes que Fase 3.3.

## Paso 2 — Detección de caso especial: proyecto nuevo

Si `api/` no existe todavía:

1. Informa al usuario de que el proyecto está en la **Fase 1**.
2. Propón el orden de arranque respecting el roadmap:
   - Fase 1.1 y 1.2: bootstrap de NestJS + PostgreSQL + TypeORM (orquestador `backend-task`).
   - Fase 2: modelo de datos completo (`schema-task`).
   - Fase 3.1, 3.2, 3.3: ingesta (`ingesta-task`).
   - Fase 4: auth (`auth-task`) y wishlist (`wishlist-task`).
   - Fase 5: endpoints y deal score (`backend-task`).
   - Fase 6: despliegue (`backend-task`).
3. Pregunta al usuario por dónde quiere empezar en lugar de asumir.

## Paso 3 — Recomendación del siguiente paso

Si el usuario no da una tarea concreta ("¿qué sigue?") o la tarea es ambigua, reporta:

- **Fase actual** y **puntos completados** del roadmap.
- **Siguiente paso recomendado**, con el orquestador a invocar.
- **Bloqueos**: credenciales o decisiones de producto necesarias para avanzar (Client ID de Twitch, credenciales de Google OAuth, `JWT_SECRET`, decisión sobre el email de los usuarios de Steam, viabilidad de la wishlist de Nintendo).

## Paso 4 — Reporte al usuario

Mensaje breve:

- Fase detectada y subpunto del roadmap.
- Estado actual del proyecto en `api/`.
- Orquestador invocado y por qué.
- Advertencias si aplica (dependencias entre fases, credenciales faltantes, limitaciones conocidas de las APIs externas).
