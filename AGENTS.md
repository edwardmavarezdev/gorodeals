# GoRoDeals — Reglas de proyecto

Backend NestJS + PostgreSQL para seguimiento de precios de videojuegos y rutas de sagas.

## Estructura

```
gorodeals/
├── api/                 API NestJS (backend)
│   ├── src/
│   │   ├── config/      configuration.ts + validation.ts (Joi)
│   │   ├── database/    data-source.ts y migraciones TypeORM
│   │   └── <feature>/   módulos por dominio (igdb, steam, price-sync, ...)
├── docker-compose.yml   PostgreSQL 16 en localhost:5432
└── roadmap_backend_test_nestjs.md
```

## Stack y convenciones

| Elemento | Decisión |
|---|---|
| Framework | NestJS 11, Node 20 LTS, TypeScript `strict` |
| Base de datos | PostgreSQL 16 (Docker, puerto local 5432) |
| ORM | TypeORM 0.3 con `SnakeNamingStrategy`, `synchronize: false` |
| Migraciones | TypeORM CLI, reversibles, patrón expand/contract |
| Configuración | `@nestjs/config` + Joi, `ConfigService` |
| Validación | `class-validator` + `class-transformer`, `ValidationPipe` global con `whitelist` |
| Documentación | `@nestjs/swagger` (documento en `/docs`) |
| Tareas programadas | `@nestjs/schedule` |
| Estilo | Sin emojis. Español técnico. Nombres en inglés para el código. |

## Reglas obligatorias

1. **Nunca** poner `synchronize: true`. El esquema solo cambia por migraciones.
2. Toda FK declara `onDelete` explícito e índice.
3. Dinero en `numeric`; IDs de proveedor no numéricos (SteamID64) en `text`.
4. Índices sobre toda columna usada en `WHERE`, `JOIN` u `ORDER BY` frecuente.
5. Todo endpoint valida entrada con DTO y expone `@ApiResponse` en Swagger.
6. Toda llamada a API externa pasa por `ConfigService`, con throttling y reintentos acotados.
7. Las tareas programadas deben ser idempotentes y paginar el catálogo.
8. Sin secretos en el código: solo `.env` (no versionado) y `.env.example`.

## Comandos

```bash
cd api
npm run start:dev          # servidor en http://localhost:3000
npm run build              # compilación
npm run lint               # eslint
npm run migration:generate # genera migración a partir de las entidades
npm run migration:run      # aplica migraciones
npm run migration:revert   # revierte la última migración
docker compose up -d       # PostgreSQL local
```
