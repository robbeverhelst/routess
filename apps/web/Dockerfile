# Use the official Bun image as base
FROM oven/bun:1.1.38 AS builder

# Set working directory
WORKDIR /app

# Copy everything first to avoid overlay issues
COPY . .

# Install dependencies from workspace root
RUN bun install --frozen-lockfile

# Build arguments for environment variables
ARG VITE_MAPBOX_ACCESS_TOKEN
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_APP_URL
ARG VITE_API_URL
ARG VITE_APP_VERSION

# Set environment variables for the build
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV DOCKER_BUILD=true

# Build the web application
WORKDIR /app/apps/web
RUN bun run build

# Production stage
FROM nginx:alpine

# Copy built assets from the web app
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# Copy nginx config
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script for runtime environment variable replacement
COPY --from=builder /app/apps/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 80

# Use entrypoint script to replace environment variables at runtime
ENTRYPOINT ["/entrypoint.sh"]