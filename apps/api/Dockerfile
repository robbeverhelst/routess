ARG DEPS_IMAGE
FROM ${DEPS_IMAGE} AS deps

FROM oven/bun:1.4.4-alpine AS builder

WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN bun run --filter './packages/*' build && bun run --filter './apps/api' build

# The deps image holds every workspace's dev dependencies (Nest CLI, TypeScript,
# Playwright, ...). The runtime image gets a fresh production-only install of
# the api workspace instead, so none of that ships.
# Pinned by digest: the stages that ship use the Alpine 3.24 base.
FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS prod-deps

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/cli/package.json ./apps/cli/
COPY apps/docs/package.json ./apps/docs/
COPY apps/landing/package.json ./apps/landing/
COPY apps/web/package.json ./apps/web/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/core/package.json ./packages/core/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/i18n/package.json ./packages/i18n/

RUN bun install --frozen-lockfile --ignore-scripts --production --filter api

FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS production

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=prod-deps /app/packages/core/node_modules ./packages/core/node_modules

EXPOSE 3000

WORKDIR /app/apps/api

ENV PATH="/app/apps/api/node_modules/.bin:/app/node_modules/.bin:${PATH}"

CMD ["bun", "run", "start:prod"]
