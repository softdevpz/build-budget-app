# Build context must be the repository root, not apps/api — npm workspaces
# need the root package.json/package-lock.json to resolve correctly:
#   docker build -f apps/api/Dockerfile -t build-budget-app-api .

# Debian slim, not Alpine: Prisma's query engine binary needs glibc + OpenSSL
# 1.1/3, and Alpine's musl + OpenSSL 3-only setup is a well-documented source
# of "Error loading shared library libssl.so.1.1" failures at runtime.
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w apps/api

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace=apps/api
# Reuse the already-generated Prisma client instead of regenerating from
# schema.prisma (which we don't even copy into this stage).
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client node_modules/@prisma/client
COPY --from=build /app/apps/api/dist apps/api/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
