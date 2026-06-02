# syntax=docker/dockerfile:1.24
ARG DEPS_IMAGE
FROM ${DEPS_IMAGE} AS deps

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
ENV VITE_ENABLE_NODE_NETWORK_OVERLAYS=__VITE_ENABLE_NODE_NETWORK_OVERLAYS__
# VITE_APP_VERSION is the Sentry/GlitchTip release identifier for source-map
# upload, so it must be the actual version at build time. CI passes the
# released version via the build arg; local builds fall back to the
# placeholder, which the runtime entrypoint then replaces.
ARG VITE_APP_VERSION=__VITE_APP_VERSION__
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_UMAMI_URL=__VITE_UMAMI_URL__
ENV VITE_UMAMI_WEBSITE_ID=__VITE_UMAMI_WEBSITE_ID__
ENV DOCKER_BUILD=true

WORKDIR /app/apps/web
# Sentry source-map upload runs only when the BuildKit secret is mounted.
# When absent (local docker build), the plugin is omitted and the build
# proceeds without uploading. The secret never enters image layers.
ARG SENTRY_ORG
ARG SENTRY_PROJECT=routess
ARG SENTRY_URL
RUN --mount=type=secret,id=sentry_auth_token \
    set -e; \
    if [ -s /run/secrets/sentry_auth_token ]; then \
        export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; \
    fi; \
    node node_modules/vite/bin/vite.js build; \
    find dist -name "*.map" -type f -delete

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && sed -i '/^user[[:space:]]\+/d' /etc/nginx/nginx.conf \
    && mkdir -p /etc/nginx/snippets \
    && chown 101:101 /entrypoint.sh /etc/nginx/snippets \
    && chown -R 101:101 /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
