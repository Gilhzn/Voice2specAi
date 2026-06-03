# Voice2Spec server image. Build context is the repository root.
FROM node:20-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Workspace metadata first (better layer caching). A trimmed workspace file
# keeps the image to just the server + shared-types (no React Native app).
COPY package.json pnpm-lock.yaml tsconfig.base.json .npmrc ./
RUN printf 'packages:\n  - "apps/server"\n  - "packages/*"\n' > pnpm-workspace.yaml

COPY packages ./packages
COPY apps/server ./apps/server

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @voice2spec/shared-types build && pnpm --filter server build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Render (and most hosts) inject PORT; the server reads it from the environment.
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
