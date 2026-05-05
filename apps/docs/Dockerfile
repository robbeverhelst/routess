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

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.json ./
COPY apps/docs ./apps/docs
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd /app/apps/docs && \
	node node_modules/.bin/fumadocs-mdx && \
	node node_modules/.bin/next build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Next.js standalone output bundles only what's needed
COPY --from=builder /app/apps/docs/.next/standalone ./
COPY --from=builder /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder /app/apps/docs/public ./apps/docs/public

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nextjs -u 1001 -G nodejs && \
	chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080

CMD ["node", "apps/docs/server.js"]
