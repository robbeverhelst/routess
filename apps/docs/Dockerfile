ARG DEPS_IMAGE
FROM ${DEPS_IMAGE} AS deps

FROM oven/bun:1.4.4-alpine AS builder

WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.json ./
COPY apps/docs ./apps/docs
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd /app/apps/docs && \
	bun --bun node_modules/.bin/fumadocs-mdx && \
	bun --bun node_modules/.bin/next build

FROM oven/bun:1.4.4-alpine AS runner

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

CMD ["bun", "apps/docs/server.js"]
