FROM oven/bun:1.3.13-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/docs/package.json ./apps/docs/
COPY apps/web/package.json ./apps/web/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/core/package.json ./packages/core/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/i18n/package.json ./packages/i18n/

RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1.3.13-alpine AS builder

WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN bun run --filter './packages/*' build && bun run --filter './apps/api' build

FROM oven/bun:1.3.13-alpine AS production

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

WORKDIR /app/apps/api

ENV PATH="/app/apps/api/node_modules/.bin:/app/node_modules/.bin:${PATH}"

CMD ["bun", "run", "start:prod"]
