# Build stage
FROM oven/bun:1.3.13-alpine AS builder

# Set working directory
WORKDIR /app

# Copy everything to avoid overlay issues
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Build the application
RUN bun run --filter './packages/*' build && bun run --filter './apps/api' build

# Production stage
FROM oven/bun:1.3.13-alpine AS production

# Create app directory
WORKDIR /app

# Copy package metadata and lockfile-consistent dependencies from the builder stage
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built application from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy the compiled MikroORM runtime files to the paths used by `mikro-orm migration:up`
COPY --from=builder /app/apps/api/dist/src/mikro-orm.config.js ./apps/api/mikro-orm.config.js
COPY --from=builder /app/apps/api/dist/src/config ./apps/api/config
COPY --from=builder /app/apps/api/dist/src/entities ./apps/api/entities
COPY --from=builder /app/apps/api/dist/src/migrations ./apps/api/src/migrations

# Expose port
EXPOSE 3000

# Set working directory to api
WORKDIR /app/apps/api

# Add node_modules/.bin to PATH for CLI tools
ENV PATH="/app/apps/api/node_modules/.bin:/app/node_modules/.bin:${PATH}"

# Start the application
CMD ["bun", "run", "start:prod"] 
