ARG DEPS_IMAGE
FROM ${DEPS_IMAGE} AS deps

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
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules

EXPOSE 3000

WORKDIR /app/apps/api

ENV PATH="/app/apps/api/node_modules/.bin:/app/node_modules/.bin:${PATH}"

CMD ["bun", "run", "start:prod"]
