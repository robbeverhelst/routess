FROM oven/bun:latest AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

# Build with placeholders — real values are injected at runtime by entrypoint.sh
ENV VITE_MAPBOX_ACCESS_TOKEN=__VITE_MAPBOX_ACCESS_TOKEN__
ENV VITE_GOOGLE_CLIENT_ID=__VITE_GOOGLE_CLIENT_ID__
ENV VITE_APP_URL=__VITE_APP_URL__
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_APP_VERSION=__VITE_APP_VERSION__
ENV DOCKER_BUILD=true

WORKDIR /app/apps/web
RUN bun run build

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
