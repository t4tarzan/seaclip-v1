# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:lts-slim AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests and lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY ui/package.json ./ui/
COPY cli/package.json ./cli/
COPY site/package.json ./site/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapter-utils/package.json ./packages/adapter-utils/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──────────────────────────────────────────────────────────────
FROM deps AS build

# Copy full source
COPY . .

# Build UI (Vite bundles everything into static files)
RUN pnpm --filter @seaclip/ui build

# ── Stage 3: Production image ───────────────────────────────────────────────────
FROM node:lts-slim AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# Copy workspace manifests for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY cli/package.json ./cli/
COPY site/package.json ./site/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapter-utils/package.json ./packages/adapter-utils/

# Install all deps (tsx needed at runtime since internal packages export raw .ts)
RUN pnpm install --frozen-lockfile

# Copy server source (runs via tsx, not compiled)
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/tsconfig.json ./server/

# Copy internal packages (export raw .ts, consumed by server at runtime)
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/adapter-utils ./packages/adapter-utils

# Copy compiled UI to be served by the server
COPY --from=build /app/ui/dist ./ui/dist

# Persistent data volume for uploads, config, etc.
VOLUME /seaclip

# Expose server port
EXPOSE 3100

# Run with dumb-init for proper signal forwarding
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npx", "tsx", "server/src/index.ts"]
