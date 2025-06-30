# Use the official Bun image as base
FROM oven/bun:1.1.38 AS builder

# Set working directory
WORKDIR /app

# Copy workspace root package.json and bun.lockb
COPY package.json bun.lockb ./

# Create the workspace directories that are referenced in package.json
RUN mkdir -p apps packages

# Copy package.json files for workspace dependencies
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/design-tokens/package.json ./packages/design-tokens/

# Install dependencies from workspace root
RUN bun install

# Copy the workspace packages source code
COPY packages/ ./packages/

# Copy the web app source code
COPY apps/web/ ./apps/web/

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

# Production stage - use standard nginx alpine
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets from the web app
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# Copy nginx config
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 