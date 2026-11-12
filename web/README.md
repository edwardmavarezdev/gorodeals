# GoRoDeals Web

Frontend estatico (Astro) que visualiza los datos de la API Fastify de GoRoDeals.
Estilo propio, un cruce entre DekuDeals (tema oscuro, catalogo en tarjetas
verticales, ficha de juego con detalle y precios por tienda) y GG.deals
(miniaturas apaisadas en las listas de ofertas y rutas, tipografia compacta y
bloques de precio destacados).

## Requisitos

- Node 22 LTS o superior
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
npm run check          # comprobacion de tipos (requiere @astrojs/check)
```

`npm run check` necesita `@astrojs/check`, que no viene en las dependencias
por defecto: si no esta instalado, `astro check` lo pide de forma
interactiva. Para la comprobacion habitual basta con `npm run build`, que
compila los `.astro` y sus scripts.

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
| `/saga` | Listado de las sagas disponibles con su numero de juegos | `GET /franchises` |
| `/saga?slug=<slug>` | Ruta ordenada de una saga | `GET /franchises/:slug/route` |
| `/publicaciones` | Listado de publicaciones con filtro por categoria y paginacion | `GET /publications` |
| `/publicacion?slug=<slug>` | Publicacion completa: cuerpo, ruta de la saga y juegos citados | `GET /publications/:slug` |
| `/cuenta` | Registro, inicio de sesion, perfil y cierre de sesion | `POST /auth/*`, `GET /auth/me` |
| `/wishlist` | Lista de deseos del usuario, con sincronizacion con tiendas | `GET/POST/DELETE /wishlist` |

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

## Seccion de publicaciones

`/publicaciones` lista los articulos editoriales (guias, rutas de saga,
analisis y noticias) con filtro por categoria y paginacion. El primer articulo
se destaca como feature y el resto se lista con caratula, categoria, autor,
fecha y tiempo de lectura.

`/publicacion?slug=<slug>` muestra el articulo completo: cuerpo en markdown
convertido a HTML en el cliente (`src/lib/markdown.ts`, con escape previo del
texto), la ruta de la saga cuando el articulo pertenece a una saga y la rejilla
de juegos citados.

El markdown admitido es el minimo del proyecto: titulos `##`/`###`, listas con
`-`/`*` y `1.`, citas `>`, **negrita**, *cursiva*, `codigo` y enlaces
`[texto](url)` (solo `http(s)` o relativas).

## Cuentas de usuario y wishlist

`/cuenta` gestiona la sesion: registro e inicio de sesion con email y
contrasena, botones de acceso con Google y Steam, perfil del usuario y cierre
de sesion (individual o de todas las sesiones).

`/wishlist` muestra la lista de deseos del usuario con la caratula de cada
juego, permite quitar entradas y lanza la sincronizacion con GOG y Nintendo.

La ficha de juego (`/juego?slug=...`) tiene un boton **Anadir a la wishlist**
que refleja el estado real: si el juego ya esta en la lista, el boton ofrece
quitarla.

### Como se guarda la sesion

El sitio es estatico, asi que la sesion vive en el `localStorage` del
navegador (`src/lib/auth.ts`):

| Clave | Contenido |
|---|---|
| `gorodeals.accessToken` | JWT de acceso, de vida corta. |
| `gorodeals.refreshToken` | Token opaco de renovacion. |
| `gorodeals.user` | Perfil del usuario (id, email, nombre, avatar, proveedores). |

El access token se renueva solo: cuando la API responde 401, `authRequest`
llama a `POST /auth/refresh` con el refresh token y reintenta la peticion una
sola vez. Si la renovacion falla, la sesion se borra y el usuario vuelve al
formulario de acceso.

**Los tokens no se escriben en ningun archivo del repositorio ni en el
HTML estatico**: viven solo en el navegador. El sitio es de cliente publico,
por lo que un `accessToken` de corta duracion es el unico material que se
guarda en el navegador; el refresh token es opaco y la API solo persiste su
SHA-256.

### Login social

Los botones de Google y Steam redirigen a `GET /auth/google` y
`GET /auth/steam`, que son endpoints `@Public()` de la API. El callback de la
API devuelve el JSON de sesion, asi que el flujo necesita que la API y el
frontend compartan dominio de cookies o que el callback se ajuste; en el
entorno de desarrollo se resuelve con la redireccion directa de la API.

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
│   ├── lib/auth.ts       # sesion en localStorage, renovacion del token, login social
│   ├── lib/wishlist.ts   # alta, baja, listado y sincronizacion de la lista de deseos
│   ├── lib/sync.ts       # sincronizacion de admin (secreto solo en sessionStorage)
│   ├── lib/render.ts     # render en cliente a partir de plantillas <template>
│   ├── lib/markdown.ts   # markdown minimo a HTML para el cuerpo de las publicaciones
│   ├── components/       # Header, DealRow, PublicationCard, GameCard, Pagination, ErrorState
│   ├── layouts/Base.astro
│   ├── styles/global.css # sistema de diseno (tokens, tarjetas, listas, articulos)
│   └── pages/            # index, ofertas, juego, saga, publicaciones, publicacion,
│                          # cuenta, wishlist
└── public/
```
