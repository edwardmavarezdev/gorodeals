# Roadmap de Objetivos: Backend de Prueba con NestJS y OpenCode

Este documento detalla la lista de objetivos paso a paso para construir e integrar la primera versión del backend para tu plataforma de seguimiento de precios y guías de videojuegos.

---

## 🚀 Fase 1: Configuración Inicial del Proyecto y Entorno

- [ ] **1.1. Inicializar el Proyecto NestJS**
  - Instalar la CLI de NestJS y crear el proyecto inicial: `nest new backend-deals`.
  - Configurar las variables de entorno utilizando `@nestjs/config` (`.env` con claves de API, credenciales de BD y puerto).
- [ ] **1.2. Configurar la Base de Datos (PostgreSQL)**
  - Levantar una instancia local o en Docker con PostgreSQL.
  - Configurar **TypeORM** o **Prisma** dentro de NestJS para gestionar la conexión y migraciones.
- [ ] **1.3. Integrar OpenCode (AI Assistant / Code Agent)**
  - Configurar las reglas de proyecto y contextos en OpenCode para asegurar alineación con la arquitectura de NestJS y convenciones de código.

---

## 🗄️ Fase 2: Modelo de Datos Universal (Base de Datos)

- [ ] **2.1. Crear la Entidad `Game` (Juegos Maestros)**
  - Campos: `id`, `igdb_id` (índice único), `title`, `slug`, `cover_url`, `quality_score`, `created_at`.
- [ ] **2.2. Crear la Entidad `StoreProduct` (Tiendas y Precios)**
  - Campos: `id`, `game_id` (FK), `store_name` ('steam', 'gog', 'nintendo'), `store_product_id`, `current_price`, `regular_price`, `discount_percent`, `url`.
- [ ] **2.3. Crear la Entidad `PriceHistory` (Histórico de Precios)**
  - Campos: `id`, `store_product_id` (FK), `price`, `recorded_at`.
- [ ] **2.4. Crear las Entidades `Franchise` y `FranchisePlayOrder` (Sagas y Rutas)**
  - Mapeo relacional para conectar juegos con sus respectivas sagas (ej. *Yakuza/Like a Dragon*) y definir el orden de juego recomendado.

---

## 📡 Fase 3: Módulos de Ingesta y Consumo de APIs Exteriores

- [ ] **3.1. Crear el Módulo `IgdbModule`**
  - Implementar servicio de autenticación OAuth con Twitch Developer API (Client ID + Client Secret).
  - Endpoint o método para consultar metadatos de juegos por nombre o ID de IGDB.
- [ ] **3.2. Crear el Módulo `SteamModule`**
  - Consumir la API pública de tiendas de Steam (`appdetails`) para extraer precios actuales, valoraciones de usuarios y tamaños de descarga.
- [ ] **3.3. Crear el Módulo `PriceSyncModule` (Cron Jobs / Workers)**
  - Implementar tareas programadas con `@nestjs/schedule` para auditar precios diariamente y registrar las variaciones en `PriceHistory`.

---

## 🔐 Fase 4: Autenticación y Cuentas de Usuario

- [ ] **4.1. Crear la Entidad `User` y `SocialAccount`**
  - Diseñar el esquema de usuarios y proveedores de autenticación externos.
- [ ] **4.2. Implementar Autenticación con Steam (OpenID)**
  - Integrar la estrategia de login con Steam para capturar el `SteamID64` del usuario.
- [ ] **4.3. Implementar Autenticación con Google (OAuth 2.0)**
  - Configurar Passport/Google OAuth2 para permitir inicio de sesión social.
- [ ] **4.4. Módulo de Lista de Deseos (`WishlistModule`)**
  - Crear endpoints para permitir a los usuarios logueados agregar/quitar juegos a su lista personal.

---

## 📊 Fase 5: Algoritmo de Puntuación y APIs para el Frontend (Astro)

- [ ] **5.1. Implementar Servicio de Cálculo de `Deal Score`**
  - Crear la función que evalúa el $QualityScore$, $Discount\%$ y $HistoricalLow$ para puntuar las ofertas de 0 a 10.
- [ ] **5.2. Crear Endpoints REST para el Frontend (Astro SSR)**
  - `GET /deals/hottest`: Retorna el top de ofertas según el algoritmo.
  - `GET /games/:slug`: Retorna la ficha completa del juego, metadatos, precios por tienda e histórico.
  - `GET /franchises/:slug/route`: Retorna el roadmap ordenado para jugar una saga completa.
  - `GET /games/:id/price-history`: Retorna la serie de tiempo para renderizar gráficos en el cliente (Chart.js).

---

## 🧪 Fase 6: Despliegue de Prueba en VPS Linux

- [ ] **6.1. Dockerizar la Aplicación NestJS**
  - Crear `Dockerfile` de producción y `docker-compose.yml` (NestJS + PostgreSQL).
- [ ] **6.2. Configuración de CI/CD con GitHub Actions**
  - Crear flujo de trabajo que construya y despliegue el código automáticamente al VPS en cada `push` a `main`.
- [ ] **6.3. Configuración de Nginx y Certbot (SSL)**
  - Configurar Nginx como Reverse Proxy apuntando al contenedor/puerto de NestJS y habilitar HTTPS.