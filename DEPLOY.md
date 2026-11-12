# Despliegue en VPS (Fase 6)

Guia de despliegue de GoRoDeals en un VPS Linux con Docker. El sitio se sirve
por Nginx con HTTPS y la API corre en un contenedor propio.

## 1. Requisitos del VPS

- Ubuntu 22.04 LTS o Debian 12.
- Docker Engine con el plugin `docker compose` (v2).
- Un dominio apuntando al servidor (registro A/AAAA) y el puerto 443 abierto.
- Un usuario con permiso de `sudo`.

## 2. Preparacion del servidor

```bash
# Docker (guia oficial de Docker para Ubuntu/Debian)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # cierra y vuelve a iniciar sesion

# Certbot
sudo apt update && sudo apt install -y certbot
```

## 3. Codigo y configuracion

```bash
sudo mkdir -p /opt/gorodeals && sudo chown "$USER" /opt/gorodeals
cd /opt/gorodeals
git clone <URL_DEL_REPOSITORIO> .

cp .env.example .env    # en la raiz del repositorio
chmod 600 .env
```

Variables que hay que definir en `.env` (raiz del repositorio):

| Variable | Descripcion |
|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales de PostgreSQL del VPS. |
| `JWT_SECRET` | Clave de firma de los tokens de sesion (Fase 4). Minimo 32 caracteres: en produccion es obligatorio. |
| `ADMIN_SYNC_SECRET` | Secreto del boton "Sincronizar" del frontend. |
| `CORS_ORIGIN` | Origen del sitio, p. ej. `https://gorodeals.example.com`. |
| `STEAM_APP_ID` / `STEAM_API_KEY` | Credenciales de Steam, si se usan. |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | Credenciales de Twitch/IGDB, si se usan. |

El `.env` nunca se versiona: vive solo en el servidor.

## 4. Construir y levantar

```bash
cd /opt/gorodeals

# Migraciones pendientes (contenedor efimero)
docker compose -f docker-compose.prod.yml run --rm migrate

# API, PostgreSQL y web
docker compose -f docker-compose.prod.yml up -d --build

# Estado
docker compose -f docker-compose.prod.yml ps
```

### Comprobaciones tras el despliegue

```bash
# La API responde (la imagen ejecuta `node dist/index.js`)
curl -fsS https://TU_DOMINIO/api/health

# Documentacion OpenAPI
curl -fsS https://TU_DOMINIO/api/docs/json | head -c 200

# El frontend responde
curl -s http://127.0.0.1:8080/healthz
```

La imagen de la API compila con `tsc` y arranca con `node dist/index.js`
(Fastify). La documentacion interactiva esta en `/api/docs`.

El frontend se compila con `PUBLIC_API_URL=/api`, de modo que el navegador
llama a la API por el mismo origen y el Nginx interno hace de proxy.

### Comandos de calidad (en local, no en el VPS)

La imagen de produccion no lleva las dependencias de desarrollo, asi que
estos comandos se ejecutan en el repositorio:

```bash
cd api
npm ci
npm run build        # compilacion (tsc)
npm run lint         # eslint
npm test             # tests unitarios (jest)
npm run test:e2e     # tests de extremo a extremo con fastify.inject()
                     #   (incluye la suite de contrato)
```

`npm run test:e2e` es el que verifica la paridad de contrato: compara la
respuesta de cada endpoint con los *fixtures* de `api/test/fixtures/contract.json`,
que guardan la forma (estado, claves y tipos) de la respuesta.

## 5. Nginx del host y HTTPS

```bash
sudo cp nginx/gorodeals.conf /etc/nginx/sites-available/gorodeals.conf
sudo ln -sf /etc/nginx/sites-available/gorodeals.conf /etc/nginx/sites-enabled/gorodeals.conf

# Sustituye el dominio de ejemplo antes de activar
sudo sed -i 's/gorodeals.example.com/TU_DOMINIO/g' /etc/nginx/sites-available/gorodeals.conf

# Certificado (el bloque HTTP-01 ya está en la configuración)
sudo certbot --nginx -d TU_DOMINIO -d www.TU_DOMINIO --agree-tos -m correo@ejemplo.com --redirect

sudo nginx -t && sudo systemctl reload nginx
```

## 6. Actualizar el sitio

```bash
cd /opt/gorodeals
git pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
```

## 7. Copias de seguridad

```bash
# Volumen de PostgreSQL
docker run --rm -v gorodeals_postgres_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/gorodeals-$(date +%F).tar.gz -C /data .

# Restaurar
docker run --rm -v gorodeals_postgres_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/gorodeals-AAAA-MM-DD.tar.gz -C /data
```

## 8. Diagnostico

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
curl -s http://127.0.0.1:8080/healthz
sudo nginx -t
```
