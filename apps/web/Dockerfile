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
COPY apps/web ./apps/web
COPY packages ./packages

# Build with placeholders — real values are injected at runtime by entrypoint.sh
ENV VITE_MAPBOX_ACCESS_TOKEN=__VITE_MAPBOX_ACCESS_TOKEN__
ENV VITE_GOOGLE_CLIENT_ID=__VITE_GOOGLE_CLIENT_ID__
ENV VITE_APP_URL=__VITE_APP_URL__
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_APP_VERSION=__VITE_APP_VERSION__
ENV VITE_STADIA_API_KEY=__VITE_STADIA_API_KEY__
ENV VITE_UMAMI_URL=__VITE_UMAMI_URL__
ENV VITE_UMAMI_WEBSITE_ID=__VITE_UMAMI_WEBSITE_ID__
ENV DOCKER_BUILD=true

WORKDIR /app/apps/web
RUN node node_modules/vite/bin/vite.js build

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && sed -i '/^user[[:space:]]\+/d' /etc/nginx/nginx.conf \
    && chown 101:101 /entrypoint.sh \
    && chown -R 101:101 /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
