# Use the official Bun image as base
FROM oven/bun:1.1.38 AS builder

# Set working directory
WORKDIR /app

# Copy workspace root package.json and bun.lockb
COPY package.json bun.lockb ./

# Create the workspace directories that are referenced in package.json
RUN mkdir -p apps packages

# Copy ONLY the web app package.json (not infra)
COPY apps/web/package.json ./apps/web/

# Install dependencies from workspace root
RUN bun install

# Copy the web app source code
COPY apps/web/ ./apps/web/

# Copy root .env file for build-time environment variables
COPY .env ./

# Build the web application
WORKDIR /app/apps/web
RUN bun run build

# Production stage
FROM nginx:alpine

# Copy built assets from the web app
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# Copy nginx config
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 