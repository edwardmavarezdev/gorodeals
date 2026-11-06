---
description: Implementa la Fase 4 del roadmap (autenticación y cuentas de usuario) en api/ del proyecto gorodeals: entidad User y SocialAccount, login con email, login social con Steam y Google, JWT con refresh tokens. Orquestra auth-expert (implementación) → nestjs-qa (calidad) → security-reviewer (seguridad) → nestjs-performance-reviewer (escalabilidad).
argument-hint: <registro | login por email | login con Google | login con Steam | sesiones o refresh tokens>
---

Vas a ejecutar el siguiente pipeline en `api/` para la Fase 4 (autenticación y cuentas de usuario) del proyecto gorodeals, con la tarea: "$ARGUMENTS".

Los pasos son **secuenciales y obligatorios**. No los ejecutes en paralelo, no te saltes ninguno, y no reemplaces a los agentes haciendo tú el trabajo directamente.

Si la tarea es **solo** la parte de OpenID de Steam (el login con Steam en sí, sin emisión de tokens ni account linking), el agente `steam-expert` es el indicado y este orquestador no es el adecuado. Este orquestador cubre el flujo completo de identidad.

## Paso 1 — Implementación (`auth-expert`)

Invoca el agente `auth-expert` (foreground) con el contexto completo de la tarea: "$ARGUMENTS". Debe implementar:

- Las entidades `User`, `SocialAccount` y `UserSession`, con sus constraints e índices.
- El registro con email y contraseña (argon2id) y el login con email.
- Los flujos sociales de **Google (OAuth 2.0)** y **Steam (OpenID 2.0)**, con validación de `state` y account linking seguro.
- La emisión de **access token JWT** y **refresh tokens opacos hasheados** en `user_sessions`, con rotación y revocación.
- Los guards (`JwtAuthGuard`, `OptionalJwtAuthGuard`) y los endpoints del `AuthModule`.

Pasa al agente explícitamente:

- La decisión de sesión acordada: **JWT + Passport + refresh tokens persistidos**.
- La decisión de producto pendiente sobre el email de los usuarios que solo entran con Steam: el agente debe **aplicar** la estrategia de email sintético (`steam_<steamid64>@users.gorodeals.local`) y señalarla como pendiente de confirmación, en lugar de dejar el schema inconsistente.
- Que el `user_id` sale siempre de `req.user.sub`.

Si el login con Steam es parte de la tarea, el agente debe apoyarse en la implementación OpenID de `steam-expert`. Si esa parte aún no existe, invoca primero a `steam-expert` (foreground) para que la entregue, y luego continúa con `auth-expert`.

## Paso 2 — Auditoría de calidad (`nestjs-qa`)

Invoca el agente `nestjs-qa` (foreground) sobre los archivos creados en el paso 1. Pídele que verifique:

- Que la entidad y la migración **coinciden campo a campo**, y que la migración es reversible.
- Que `password_hash` es nullable (los usuarios solo sociales no tienen contraseña) y que `provider_account_id` es `text` (el SteamID64 no cabe en un `number`).
- Que existe **UNIQUE (`provider`, `provider_account_id`)** en `social_accounts`.
- Que los DTOs están en archivos propios con `class-validator` y `@ApiProperty`.
- Que el guard global es **deny-by-default** y que las rutas públicas están marcadas explícitamente con `@Public()`.
- Que no hay secretos con valor por defecto y que `JWT_SECRET` está en el `validationSchema`.

## Paso 3 — Revisión de seguridad (`security-reviewer`)

Este es el paso crítico de esta fase. Invoca al agente `security-reviewer` (foreground) sobre los mismos archivos. Pídele que revise con foco:

- **Refresh tokens**: que se persista solo el **hash SHA-256**, que roten en cada refresh, que el token anterior se revoque, y que exista **detección de reutilización** que revoque todas las sesiones del usuario.
- **Contraseñas**: argon2id con los parámetros por defecto, email normalizado, y **timing constante** en el login (usuario inexistente hashea una contraseña dummy).
- **OAuth**: `state` validado, `redirect_uri` con allowlist, PKCE en Google, y **account linking solo con email verificado**.
- **Enumeración de cuentas**: que el login y el registro no confirmen si un email existe.
- **Rate limiting** en login, register y refresh.
- **JWT**: `algorithms: ['HS256']` explícito, expiración <= 15-60 min, payload mínimo sin datos sensibles.
- **Autorización**: que ningún endpoint tome el `user_id` del body o de los query params.
- **Ceroización de sesión**: que cambiar la contraseña revoque todas las sesiones y que el logout revoque la actual.

## Paso 4 — Revisión de performance (`nestjs-performance-reviewer`)

Invoca el agente `nestjs-performance-reviewer` (foreground) sobre los mismos archivos. Pídele que evalúe:

- Que la verificación de refresh token **no recorre todas las sesiones** del usuario, sino que va por `token_hash` indexado.
- Que existe un **índice** en `user_sessions (token_hash)` y en `user_sessions (user_id)`, y que el índice parcial `WHERE revoked_at IS NULL` está justificado.
- Que la tabla `user_sessions` **no crece sin control**: debe haber un cron de purga de sesiones expiradas.
- Que la búsqueda de email usa `citext` para que el índice unique se aplique también con mayúsculas distintas.
- Que la carga de las sessions de un usuario está **paginada** si el endpoint devuelve la lista.

## Paso 5 — Correcciones (si aplica)

Si los revisores reportaron hallazgos Críticos o Altos, invoca nuevamente a `auth-expert` (foreground) pasándole la lista concreta de hallazgos. Una segunda pasada de corrección es suficiente salvo que el usuario pida lo contrario.

Si algún hallazgo Crítico requiere una decisión de producto (por ejemplo, la política de verificación de email o el tratamiento de cuentas sin email real), **no lo resuelvas por tu cuenta**: repórtalo al final.

## Paso 6 — Verificación

Invoca a `auth-expert` (foreground) para que ejecute y reporte la salida real de `npm run build`, `npm run lint` y los tests aplicables. Si puedes, pide un **test de humo del flujo completo**: registro → login → refresh → logout, y un test de que un refresh token reutilizado es rechazado.

Si los flujos OAuth no se pueden probar sin credenciales externas configuradas (Google Cloud, dominio de Steam OpenID), dilo explícitamente en lugar de afirmar que funcionan.

## Paso 7 — Resumen final

Preséntale al usuario, en un solo mensaje breve:

- Qué se implementó y en qué archivos (entidades, módulo, strategies, guards, endpoints).
- Flujos de autenticación soportados y cómo se combinan.
- Modelo de sesión: access, refresh, rotación, revocación y purga.
- Hallazgos de `nestjs-qa`, `security-reviewer` y `nestjs-performance-reviewer` (y si se corrigieron).
- Estado de la verificación con el resultado real.
- **Configuración externa pendiente**: credenciales de Google Cloud, `realm` de Steam OpenID, `JWT_SECRET`, servicio de envío de emails de verificación.
- Decisiones de producto que requieren tu confirmación.
- Estado final: listo / requiere revisión manual del usuario.
