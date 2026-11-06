---
description: Implementa la Fase 3 del roadmap (ingesta de APIs exteriores) en api/ del proyecto gorodeals: enruta a igdb-expert (IGDB/Twitch), steam-expert (tienda de Steam) o price-sync-expert (PriceSyncModule y cron jobs) según la tarea, y valida con nestjs-qa, nestjs-performance-reviewer y security-reviewer.
argument-hint: <IGDB | Steam | PriceSync | sincronización de precios o catálogo>
---

Vas a ejecutar el siguiente pipeline en `api/` para la Fase 3 (módulos de ingesta y consumo de APIs exteriores) del proyecto gorodeals, con la tarea: "$ARGUMENTS".

Los pasos son **secuenciales y obligatorios**. No los ejecutes en paralelo, no te saltes ninguno, y no reemplaces a los agentes haciendo tú el trabajo directamente.

## Paso 0 — Enrutado al agente de integración (obligatorio)

Clasifica la tarea y elige **un** agente principal. Si la tarea abarca varias integraciones, ejecuta el pipeline completo una vez por cada integración, en el orden de dependencias del roadmap.

| La tarea habla de... | Agente principal | Ámbito |
|---|---|---|
| Metadatos de juegos, catálogo, IGDB, Twitch, `igdb_id`, Apicalypse, calidad o puntuación del juego | `igdb-expert` | Fase 3.1 |
| Precios de la tienda de Steam, `appdetails`, App IDs, descuentos, login con Steam OpenID, SteamID64 | `steam-expert` | Fase 3.2 y 4.2 |
| Tareas programadas, cron, `price_history`, histórico de precios, sincronización diaria, `PriceSyncModule`, deal score | `price-sync-expert` | Fase 3.3 |

Reglas de enrutado:

- **Fase 3.3 (PriceSync) depende de 3.1 y 3.2.** Si la tarea es implementar el `PriceSyncModule` y las integraciones de Steam o IGDB no existen todavía, implementa primero el proveedor que necesita el sync. Si el usuario solo pide el sync, invoca `steam-expert` o `igdb-expert` primero para asegurar el contrato del proveedor, y luego `price-sync-expert`.
- **El login con Steam (Fase 4.2) lo implementa `steam-expert`**, pero la emisión de tokens y el account linking los hace `auth-expert`. Si la tarea incluye ambos, invoca `steam-expert` para la parte de OpenID y luego el orquestador `auth-task` para la parte de sesiones.
- Si la tarea no encaja en ninguna de las tres y es una feature genérica de backend, usa el orquestador `backend-task`.

## Paso 1 — Implementación de la integración

Invoca el agente principal elegido (foreground) con el contexto completo de la tarea: "$ARGUMENTS".

Pasale explícitamente:

- La fase del roadmap que corresponde y su alcance exacto.
- Las entidades y tablas destino ya definidas en el roadmap (`games`, `store_products`, `price_history`).
- La exigencia de respetar los rate limits: **IGDB 4 req/s**, Steam sin límite documentado (usa lotes).
- La configuración por `ConfigService` de las credenciales (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, y las que apliquen).

El agente debe entregar el módulo completo: cliente HTTP con auth y throttling, mapeo a entidades, persistencia idempotente, errores tipados y endpoints.

## Paso 2 — Auditoría de calidad (`nestjs-qa`)

Invoca el agente `nestjs-qa` (foreground) sobre los archivos creados en el paso 1. Pídele que verifique de forma específica:

- Que el módulo declara correctamente sus `providers`, `exports` y `controllers`.
- Que el DTO está en su propio archivo, con `class-validator` y `@ApiProperty`.
- Que el error de la API externa se traduce a una excepción tipada y no a un `throw new Error`.
- Que los secretos se leen del `ConfigService` y no aparecen en el código ni en los logs.
- Que el token de OAuth se cachea y no se pide uno por petición.

## Paso 3 — Revisión de performance (`nestjs-performance-reviewer`)

Invoca el agente `nestjs-performance-reviewer` (foreground) sobre los mismos archivos. Pídele que evalúe:

- Si el **throttle global** de la API externa está aplicado a todas las peticiones, incluidas las del sync masivo.
- Si la sincronización **pagina el catálogo** en cursor y no carga todo en memoria.
- Si la escritura en `price_history` es **idempotente por fecha** y si el cron es **idempotente** en su conjunto.
- Si el cron tiene **guarda de concurrencia** y no se solapa con sí mismo.
- Si hay **transacciones abiertas durante llamadas HTTP** (deben fragmentarse).
- Si la consulta de **histórico mínimo** usa el índice `(store_product_id, recorded_at DESC)` y si tiene **ventana temporal** (no el mínimo histórico absoluto de hace 6 años).
- Si las **llamadas por lote** a Steam aprovechan el batch de `appids`.

## Paso 4 — Revisión de seguridad (`security-reviewer`)

Invoca el agente `security-reviewer` (foreground) sobre los mismos archivos. En el contexto de la ingesta, revisa:

- Que el `client_secret` y los tokens no se registren en logs ni se persistan en claro.
- Que los endpoints de **sync manual** estén protegidos (no dejar un trigger de sincronización masiva público).
- Que las **llamadas HTTP salientes** usen timeouts y no sigan redirecciones hacia hosts internos.
- Que las respuestas de la API externa se **validen antes de mapearse** (no confiar en la forma del JSON).

## Paso 5 — Correcciones (si aplica)

Si los tres revisores reportaron hallazgos Críticos o Altos, invoca nuevamente al agente principal del paso 1 (foreground) pasándole la lista concreta de hallazgos. Una segunda pasada de corrección es suficiente salvo que el usuario pida lo contrario.

## Paso 6 — Verificación

Invoca al agente principal (foreground) para que ejecute y reporte la salida real de `npm run build`, `npm run lint` y los tests aplicables.

Si la integración **requiere credenciales que el usuario todavía no tiene** (Client ID/Secret de Twitch, API key de Steam), no inventes una ejecución contra la API real: dilo explícitamente en el resumen y describe cómo configurarlas.

## Paso 7 — Resumen final

Preséntale al usuario, en un solo mensaje breve:

- Qué módulo se implementó y en qué archivos.
- Decisiones clave: estrategia de auth, throttling, idempotencia y paginación.
- Hallazgos de `nestjs-qa`, `nestjs-performance-reviewer` y `security-reviewer` (y si se corrigieron).
- Estado de la verificación con el resultado real.
- **Credenciales y variables de entorno que faltan por configurar**, y cualquier limitación conocida de la API (por ejemplo, el tamaño de descarga de Steam no está en `appdetails`).
- Estado final: listo / requiere revisión manual del usuario.
