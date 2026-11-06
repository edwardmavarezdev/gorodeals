# GoRoDeals Web

Frontend estatico (Astro) que visualiza los datos de la API NestJS de GoRoDeals.
Estilo DekuDeals: tema oscuro, catalogo en tarjetas, ficha de juego con detalle y
precios por tienda.

## Requisitos

- Node 20 LTS o superior
- La API de GoRoDeals levantada y accesible (opcional para el build, imprescindible para ver datos)

## Arranque

```bash
cd web
npm install
cp .env.example .env   # opcional: ajustar la URL de la API
npm run dev            # http://localhost:4321
```

Otros scripts:

```bash
npm run build          # genera el sitio estatico en dist/
npm run preview        # sirve dist/ en http://localhost:4321
npm run check          # comprobacion de tipos
```

## Configuracion

| Variable | Descripcion | Valor por defecto |
|---|---|---|
| `PUBLIC_API_URL` | URL base de la API que consume el navegador | `http://localhost:3000` |

La variable se expone al cliente con `import.meta.env.PUBLIC_API_URL` y se lee en
`src/lib/api.ts`. El backend debe permitir el origen del frontend por CORS
(`http://localhost:4321` en desarrollo).

## Rutas

| Ruta | Descripcion | Endpoint de la API |
|---|---|---|
| `/` | Catalogo con buscador, orden y paginacion | `GET /catalog` |
| `/ofertas` | Top de ofertas por deal score | `GET /deals/hottest` |
| `/juego?slug=<slug>` | Ficha de juego, ofertas, historico y saga | `GET /games/:slug` |
| `/saga?slug=<slug>` | Ruta ordenada de una saga | `GET /franchises/:slug/route` |

## Boton "Sincronizar"

La cabecera incluye un boton **Sincronizar** que dispara una carga de juegos de
prueba en el backend mediante `POST /admin/sync/random?count=10&platforms=steam,nintendo`.

El endpoint exige la cabecera `x-admin-secret`, asi que el boton pide el
**secreto de administracion** la primera vez:

1. Se pulsa "Sincronizar".
2. Aparece un campo de contrasena ("Secreto de administracion") debajo del boton.
3. Se introduce el secreto y se pulsa "Enviar" (o Enter).

**El secreto se guarda solo en `sessionStorage` del navegador**, por lo que se
pierde al cerrar la pestaña. Nunca se escribe en el codigo, ni en una variable
`PUBLIC_*`, ni en el HTML estatico, ni en ningun archivo del repositorio: no
aparece en el bundle del navegador. El backend debe permitir el origen del
frontend por CORS y aceptar la cabecera `x-admin-secret` en el preflight.

Estados del boton: inactivo -> "Sincronizando..." -> resultado ("12 juegos, 12
ofertas, 360 registros de precio") o error legible, por ejemplo
`403: Sincronizacion deshabilitada: ADMIN_SYNC_SECRET no esta configurado` o
`403: Secreto de administrador invalido`. Tras un 403 se vuelve a mostrar el
campo para reintentar. Cuando la sincronizacion termina con exito, la pagina
vuelve a pedir los datos para que se vean los juegos nuevos.

## Sin SSR: implicaciones

El sitio es **estatico**. No hay `output: 'server'`, ni adaptadores de Node, ni
`getStaticPaths` con llamadas a la API: **el build no depende de que la API este
viva** y se puede compilar con la API apagada.

Los datos se piden desde el navegador con `fetch` (timeout de 8 s via
`AbortSignal.timeout`) y se inyectan en el DOM. Consecuencias:

- El HTML inicial solo contiene la estructura y las plantillas `<template>`; los
  datos aparecen tras la ejecucion del JavaScript del cliente.
- El SEO y el primer render dependen del JS del cliente. Queda pendiente para una
  fase posterior (posible prerenderizado en build, `output: 'hybrid'` o ISR).
- Si la API no responde, la vista muestra un estado de error legible, nunca una
  pantalla en blanco.

## Estructura

```
web/
├── src/
│   ├── lib/api.ts        # tipos del contrato + funciones fetch (timeout y errores)
│   ├── lib/sync.ts       # sincronizacion de admin (secreto solo en sessionStorage)
│   ├── lib/render.ts     # render en cliente a partir de plantillas <template>
│   ├── components/       # Header, GameCard, PriceTag, Pagination, ErrorState
│   ├── layouts/Base.astro
│   ├── styles/global.css
│   └── pages/            # index, ofertas, juego, saga
└── public/
```
