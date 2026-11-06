---
description: Implementa una feature backend en api/ (proyecto gorodeals) orquestando nestjs-expert (implementación) → nestjs-qa (calidad) → nestjs-performance-reviewer (escalabilidad) → security-reviewer (seguridad), en ese orden.
argument-hint: <descripción de la feature o tarea a implementar en api/>
---

Vas a ejecutar el siguiente pipeline en `api/` para la tarea: "$ARGUMENTS".

Los pasos son **secuenciales y obligatorios**, cada uno depende del resultado del anterior. No los ejecutes en paralelo, no te saltes ninguno, y no reemplaces a los agentes haciendo tú el trabajo directamente.

Si la tarea es de **modelo de datos o migraciones**, invoca además `postgres-expert` antes de la implementación (ver Nota al final).

## Paso 1 — Implementación (`nestjs-expert`)

Invoca el agente `nestjs-expert` (en foreground, necesitas su resultado antes de continuar) con el contexto completo de la tarea: "$ARGUMENTS". Debe implementar el código siguiendo las convenciones del proyecto: NestJS modular simple, TypeORM sobre PostgreSQL, DTOs con `class-validator`, Swagger, `ConfigService`, y las convenciones de `api/src/`.

Si `api/` no existe todavía, el agente hace el bootstrap completo (Fase 1 del roadmap) antes de implementar la feature.

## Paso 2 — Auditoría de calidad (`nestjs-qa`)

Una vez que `nestjs-expert` termine, invoca el agente `nestjs-qa` (foreground) para que audite específicamente los archivos que se acaban de crear o modificar en el paso 1. Dale la lista de archivos tocados y pídele que compare contra los patrones ya existentes en `api/src/`. Recuerda: este agente no escribe tests, solo audita calidad, antipatrones y consistencia.

## Paso 3 — Revisión de performance (`nestjs-performance-reviewer`)

Con el resultado del paso 2 en mano, invoca el agente `nestjs-performance-reviewer` (foreground) sobre los mismos archivos, para detectar riesgos de escalabilidad: paginación faltante, índices ausentes, N+1, queries que cargan de más, pool de conexiones mal configurado y crons que saturan la base.

## Paso 4 — Revisión de seguridad (`security-reviewer`)

Con el resultado del paso 3, invoca el agente `security-reviewer` (foreground) sobre los mismos archivos. Revisa validación de entrada, inyección SQL, autorización, manejo de secretos y exposición de datos sensibles. Si la feature no toca autenticación ni datos sensibles, indícalo explícitamente y pídele una revisión focalizada en los riesgos aplicables.

## Paso 5 — Correcciones (si aplica)

Si `nestjs-qa`, `nestjs-performance-reviewer` o `security-reviewer` reportaron hallazgos de severidad Crítica o Alta, invoca nuevamente a `nestjs-expert` (foreground) pasándole la lista concreta de hallazgos para que los corrija. Después de esa corrección no es necesario repetir todo el ciclo: con una segunda pasada de corrección es suficiente, salvo que el usuario pida lo contrario.

Si algún hallazgo de `security-reviewer` de severidad Crítica o Alta no se puede resolver sin una decisión de producto, **no lo "arregles" por tu cuenta**: repórtalo al usuario al final.

## Paso 6 — Verificación

Invoca de nuevo a `nestjs-expert` (foreground) para que ejecute la verificación real: `npm run build`, `npm run lint` y los tests que apliquen. **No declares nada como verificado si no lo ejecutaste.** Reporta la salida real de los comandos.

## Paso 7 — Resumen final

Preséntale al usuario, en un solo mensaje breve:

- Qué se implementó y en qué archivos.
- Hallazgos de `nestjs-qa` (y si se corrigieron).
- Hallazgos de `nestjs-performance-reviewer` (y si se corrigieron).
- Hallazgos de `security-reviewer` (y si se corrigieron).
- Estado de la verificación (build, lint, tests) con el resultado real.
- Estado final: listo / requiere revisión manual del usuario.

---

## Nota — Tareas de modelo de datos

Si "$ARGUMENTS" toca el esquema de la base de datos (nuevas tablas, columnas, índices, cambios de tipo, migraciones), invoca **primero** al agente `postgres-expert` (foreground) para que diseñe el modelo y la migración, y pásale su resultado a `nestjs-expert` como entrada del paso 1. El agente `postgres-expert` se encarga del DDL, los índices, las constraints y las estrategias de migración seguras (expand/contract).

Si la tarea es puramente de esquema, sin cambios de lógica de aplicación, el orquestador `schema-task` es más adecuado: invócalo con los mismos argumentos.
