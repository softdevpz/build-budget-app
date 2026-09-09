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
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY packages/shared packages/shared
RUN npm run build -w packages/shared
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
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=apps/api
# Reuse the already-generated Prisma client instead of regenerating from
# schema.prisma (which we don't even copy into this stage).
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client node_modules/@prisma/client
# The compiled shared package — npm ci above already symlinked
# node_modules/@build-budget-app/shared -> packages/shared, this just needs
# to fill that directory with something more than a package.json.
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# schema.prisma + migrations/ are needed at runtime now: the entrypoint runs
# `prisma migrate deploy` against them before starting the app.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/docker-entrypoint.sh docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
