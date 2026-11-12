# Imagen de produccion de la API GoRoDeals (Fastify 5 + TypeORM).
# Multi-stage: la imagen final solo lleva el compilado y las dependencias
# de produccion.
#
# La base es `node:22-slim` (Debian bookworm, glibc) y no Alpine a proposito:
# `argon2` solo publica binarios precompilados y el de Alpine (musl) no es
# compatible, de modo que en Alpine `npm ci` intentaria compilar y fallaria
# (el paquete publicado no incluye el codigo fuente). En Debian el binario
# precompilado funciona y no hace falta cadena de compilacion.
#
# Node 22 y no Node 20: el binario precompilado de `argon2` provoca un
# fallo de segmentacion al cargarse en Node 20.

FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Se descartan las dependencias de desarrollo del arbol final.
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_HOST=postgres \
    DB_PORT=5432

# Usuario sin privilegios.
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --no-create-home app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER app
EXPOSE 3000

# La comprobacion usa el `fetch` nativo de Node: no hace falta instalar
# `curl` en la imagen.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
