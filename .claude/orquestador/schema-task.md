---
description: Diseña o modifica el modelo de datos y las migraciones de PostgreSQL en api/ (proyecto gorodeals) orquestando postgres-expert (esquema, índices y migración) → nestjs-expert (entidades TypeORM y ajuste de la aplicación) → nestjs-qa (consistencia) → nestjs-performance-reviewer (índices y queries).
argument-hint: <tabla, entidad, columna, índice o migración a crear o modificar>
---

Vas a ejecutar el siguiente pipeline sobre el esquema de PostgreSQL de `api/` para la tarea: "$ARGUMENTS".

Los pasos son **secuenciales y obligatorios**. No los ejecutes en paralelo, no te saltes ninguno, y no reemplaces a los agentes haciendo tú el trabajo directamente.

## Paso 1 — Diseño del modelo de datos (`postgres-expert`)

Invoca el agente `postgres-expert` (foreground) con el contexto completo de la tarea: "$ARGUMENTS". Debe entregar:

- El DDL o la definición de la entidad con tipos exactos.
- Los índices, constraints (unique, check, FK con `onDelete`) y la justificación de cada uno.
- La **migración** en el formato que espera el data source de TypeORM (`up` y `down` reversibles).
- El análisis de impacto sobre las queries existentes y sobre el crecimiento de la tabla.

Recuerda las reglas que ya puedes aplicar: `numeric` para dinero, `citext` para emails, `text` para IDs de proveedor que no son numéricos (SteamID64), `UNIQUE` en toda FK de la que se cuelga historial, y timestamps en `timestamptz`.

Si el cambio es **destructivo** (eliminar una columna con datos, cambiar un tipo, renombrar), `postgres-expert` debe proponer el patrón expand/contract paso a paso. No apliques un `DROP COLUMN` directo.

## Paso 2 — Implementación en la aplicación (`nestjs-expert`)

Con el diseño del paso 1 en mano, invoca al agente `nestjs-expert` (foreground) para que:

- Cree o ajuste la **entidad TypeORM** para que coincida exactamente con el esquema (nombres de columna, tipos, nulabilidad, defaults, índices declarados con `@Index`).
- Ajuste los servicios y DTOs afectados por el cambio.
- **No** cree una migración nueva si `postgres-expert` ya la entregó: aplica la que existe, pero verifica que la entidad y la migración digan exactamente lo mismo.

El agente debe confirmar que `synchronize` sigue en `false`.

## Paso 3 — Auditoría de calidad (`nestjs-qa`)

Invoca al agente `nestjs-qa` (foreground) sobre los archivos del paso 2. Pídele que verifique de forma específica:

- Que la entidad y la migración **coinciden campo a campo** (una discrepancia aquí es la causa número uno de "en mi máquina sí funciona").
- Que toda FK tiene índice y `onDelete` explícito.
- Que no hay `synchronize: true` en ninguna parte.
- Que la migración es reversible y no fue editada tras aplicarse.

## Paso 4 — Revisión de performance (`nestjs-performance-reviewer`)

Invoca al agente `nestjs-performance-reviewer` (foreground) para que evalúe:

- Si los índices propuestos son los que necesitan las queries reales, y si hay índices que sobran.
- Si el cambio afecta a queries existentes y las degrada (un `UNIQUE` sobre una columna muy selectiva, una FK sin índice).
- Si la tabla afectada va a crecer y si necesita particionado o política de retención.

## Paso 5 — Correcciones (si aplica)

Si `nestjs-qa` o `nestjs-performance-reviewer` reportaron hallazgos Críticos o Altos, invoca a `postgres-expert` (foreground) para corregir el DDL y la migración, y luego a `nestjs-expert` (foreground) para alinear la entidad. Una segunda pasada de corrección es suficiente salvo que el usuario pida lo contrario.

## Paso 6 — Verificación

Invoca a `nestjs-expert` (foreground) para que ejecute y reporte la salida real de:

- `npm run build`
- `npm run lint`
- `npm run migration:run` (aplicar la migración contra la BD de desarrollo)
- `npm run migration:revert` y `npm run migration:run` de nuevo, para **demostrar que la migración es reversible**

Si la base de datos de desarrollo no está disponible, dilo explícitamente en el resumen en lugar de afirmar que la migración funciona.

## Paso 7 — Resumen final

Preséntale al usuario, en un solo mensaje breve:

- Cambios de esquema, con la tabla de columnas nueva o modificada.
- Índices y constraints creados, con su justificación.
- Archivos de entidad y migración modificados.
- Hallazgos de `nestjs-qa` y `nestjs-performance-reviewer` (y si se corrigieron).
- Estado de la verificación con el resultado real de los comandos.
- Estado final: listo / requiere revisión manual del usuario.
