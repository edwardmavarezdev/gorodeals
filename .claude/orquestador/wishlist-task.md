---
description: Implementa el WishlistModule y la sincronización de wishlist con tiendas externas (GOG, Nintendo) en api/ del proyecto gorodeals. Orquestra wishlist-expert (implementación) → nestjs-qa (calidad) → security-reviewer (tokens cifrados y autorización) → nestjs-performance-reviewer (N+1 y paginación).
argument-hint: <wishlist propia | conectar GOG | conectar Nintendo | sincronizar wishlist con tiendas>
---

Vas a ejecutar el siguiente pipeline en `api/` para la Fase 4.4 (módulo de lista de deseos) y su extensión de sincronización con tiendas externas, con la tarea: "$ARGUMENTS".

Los pasos son **secuenciales y obligatorios**. No los ejecutes en paralelo, no te saltes ninguno, y no reemplaces a los agentes haciendo tú el trabajo directamente.

## Paso 0 — Verificación de viabilidad (obligatorio, antes de implementar)

Las wishlists de las tiendas externas **no ofrecen un contrato público estable**. Antes de invocar al agente de implementación, determina qué se puede hacer realmente:

| Tienda | ¿API de wishlist utilizable? | Alcance realista |
|---|---|---|
| **GOG** | Parcialmente. Existe un endpoint de wishlist que consume la propia web de GOG, pero no es un contrato público estable. Verifícalo en vivo. | Importación desde GOG (verificable) y, si funciona, exportación. Si el endpoint no es reproducible, **solo** importa los juegos comprados (`getFilteredProducts`) y deja la wishlist de GOG documentada como pendiente. |
| **Nintendo** | No. No hay API pública del eShop; la wishlist exige sesión de Nintendo Account con MFA. | **No implementes sincronización con Nintendo.** La vía defendible es la incorporación asistida: un catálogo curado del eShop de Nintendo con su `nsuid`, sobre el que el usuario marca sus títulos. Documenta la limitación. |
| **Steam** | No. | **Descartada.** La wishlist de Steam solo es accesible por scraping autenticado, que es frágil y va en contra de sus términos. |

Si la tarea pide explícitamente una sincronización imposible (Steam o Nintendo), **no inventes una implementación que no va a funcionar**. Dilo al usuario, propón la alternativa defendible y pide confirmación antes de seguir. Esta es la parte del pipeline donde ser honesto importa más que cumplir.

## Paso 1 — Implementación (`wishlist-expert`)

Invoca el agente `wishlist-expert` (foreground) con el contexto completo de la tarea: "$ARGUMENTS". Debe implementar:

- La entidad `wishlist_items` y `store_connections`, con sus constraints e índices.
- Los endpoints CRUD de la wishlist propia (añadir, quitar, listar, consultar si un juego está en la lista), **todos con JWT** y `user_id` desde `req.user.sub`.
- El `POST` **idempotente** con `ON CONFLICT (user_id, game_id) DO UPDATE`.
- La resolución del precio actual de cada item en **batch**, sin N+1.
- La conexión y desconexión de tiendas, con el token **cifrado en reposo** y el `state` del callback validado.
- La sincronización como **tarea asíncrona con estado consultable**, no un request bloqueante.
- La resolución de títulos con umbral de confianza, dejando los casos ambiguos como "sin match" en vez de enlazarlos mal.

Pasa al agente explícitamente el resultado del paso 0: qué proveedores se implementan de verdad y cuáles quedan fuera y por qué.

## Paso 2 — Auditoría de calidad (`nestjs-qa`)

Invoca el agente `nestjs-qa` (foreground) sobre los archivos del paso 1. Pídele que verifique:

- Que la entidad y la migración coinciden, y que la migración es reversible.
- Que existe **UNIQUE (`user_id`, `game_id`)** y que el `POST` no duplica.
- Que el `user_id` sale de `req.user.sub` y **nunca** del body.
- Que los DTOs están en archivos propios con validaciones y `@ApiProperty`.
- Que el `CHECK` de `external_id` para `source != 'manual'` está presente.
- Que los endpoints de sincronización manual están protegidos.

## Paso 3 — Revisión de seguridad (`security-reviewer`)

Invoca el agente `security-reviewer` (foreground) sobre los mismos archivos. Pídele que revise con foco:

- Que los tokens de terceros se **cifran en reposo** (AES-256-GCM) con la clave en `ConfigService`, y que **no se devuelven al frontend** ni se registran en logs.
- Que la clave de cifrado **no está** en la base de datos ni hardcodeada.
- Que el `state` OAuth se valida en los callbacks (CSRF).
- Que `redirect_uri` de las tiendas externas está en una allowlist.
- Que la **autorización** es correcta: un usuario solo puede ver y modificar su propia wishlist y sus propias conexiones.
- Que los datos que llegan de la tienda externa **no pueden escribir campos del usuario** (mass assignment): en particular, nada de `user_id` o `status` desde la respuesta de la tienda.
- Que el scope solicitado a la tienda es el mínimo y que el estado de conexión maneja correctamente los tokens caducados.

## Paso 4 — Revisión de performance (`nestjs-performance-reviewer`)

Invoca el agente `nestjs-performance-reviewer` (foreground) sobre los mismos archivos. Pídele que evalúe:

- Que la wishlist está **paginada** y que el índice `(user_id, added_at DESC)` está presente.
- Que el precio actual se resuelve en **batch** (una query con `IN` o un JOIN), y no con una consulta por item.
- Que la sincronización **no hace una llamada HTTP por item** de la wishlist.
- Que el recorrido de la wishlist de la tienda está **paginado en cursor**.
- Que la tabla `store_connections` y `wishlist_items` tienen los índices que necesitan sus queries.

## Paso 5 — Correcciones (si aplica)

Si los revisores reportaron hallazgos Críticos o Altos, invoca nuevamente a `wishlist-expert` (foreground) pasándole la lista concreta de hallazgos. Una segunda pasada de corrección es suficiente salvo que el usuario pida lo contrario.

## Paso 6 — Verificación

Invoca a `wishlist-expert` (foreground) para que ejecute y reporte la salida real de `npm run build`, `npm run lint` y los tests aplicables.

Pide un test de humo del flujo local: añadir un juego, listar la wishlist, comprobar que aparece "en tu wishlist", quitarlo y comprobar que desaparece. Y, si la sincronización con GOG quedó implementada, un test de **doble ejecución** que demuestre que no duplica items.

Si la conexión con GOG requiere credenciales que el usuario no tiene, dilo explícitamente en lugar de afirmar que la sincronización funciona.

## Paso 7 — Resumen final

Preséntale al usuario, en un solo mensaje breve:

- Qué se implementó y en qué archivos (entidades, endpoints, proveedores de tienda).
- **Viabilidad por tienda**: para cada una de GOG, Nintendo y Steam, qué quedó implementado, qué se verificó en vivo y qué quedó fuera y por qué. Esta sección es obligatoria y debe ser explícita.
- Modelo de datos, constraints e índices.
- Política de sincronización y de resolución de títulos.
- Hallazgos de `nestjs-qa`, `security-reviewer` y `nestjs-performance-reviewer` (y si se corrigieron).
- Estado de la verificación con el resultado real.
- **Configuración externa pendiente**: app en GOG Developer, `STORE_TOKEN_ENCRYPTION_KEY`, URLs de las APIs externas.
- Estado final: listo / requiere revisión manual del usuario.
