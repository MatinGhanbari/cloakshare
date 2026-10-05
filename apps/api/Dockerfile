FROM node:20-slim AS base

# Install system dependencies for PDF rendering, office conversion + jemalloc
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libjemalloc2 \
    curl \
    tini \
    ffmpeg \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Use jemalloc to prevent Sharp/libvips memory fragmentation
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV NODE_OPTIONS="--max-old-space-size=768"

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Copy workspace config first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/viewer/package.json ./apps/viewer/

# Install all dependencies (need dev deps for build step)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/
COPY apps/viewer/ ./apps/viewer/

# Build shared first, then the two frontends, then the API
RUN pnpm --filter @cloak/shared build \
 && pnpm --filter @cloak/web build \
 && pnpm --filter @cloak/viewer build \
 && pnpm --filter @cloak/api build

# Assemble the built frontends into the API's public dir so the single API process can
# serve them from the same origin at /dashboard (dashboard) and /v (viewer).
RUN mkdir -p apps/api/public/dashboard apps/api/public/viewer \
 && cp -r apps/web/dist/. apps/api/public/dashboard/ \
 && cp -r apps/viewer/dist/. apps/api/public/viewer/

# Build the migration runner separately (tsup only bundles index.ts)
RUN cd apps/api && npx tsup src/db/migrate.ts --format esm --outDir dist/db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

# Use tini as init to reap zombie LibreOffice processes
ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "cd apps/api && node dist/db/migrate.js && cd /app && node apps/api/dist/index.js"]
