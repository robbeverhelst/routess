ARG DEPS_IMAGE
FROM ${DEPS_IMAGE} AS deps

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.json ./
COPY apps/landing ./apps/landing
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1

# @routess/core (slug + static-map helpers) and @routess/design-tokens (landing
# accents/brand colors) both resolve to their built dist, so compile them before
# the Next build. tsc -b on core also builds its referenced projects.
RUN cd /app/packages/core && \
	node /app/node_modules/.bin/tsc -b --force && \
	cd /app/packages/design-tokens && \
	node /app/node_modules/.bin/tsc -b --force

RUN cd /app/apps/landing && \
	node node_modules/.bin/next build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nextjs -u 1001 -G nodejs && \
	chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080

CMD ["node", "apps/landing/server.js"]
