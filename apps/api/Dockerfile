# Build stage
FROM oven/bun:1.1.38-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files (without lockfile to avoid conflicts)
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install

# Copy source code
COPY apps/api/ ./apps/api/
COPY turbo.json ./

# Build the application
RUN bun run build --filter=api

# Production stage
FROM oven/bun:1.1.38-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files for production dependencies (without lockfile)
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies
RUN bun install --production

# Copy built application from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy migrations folder (needed for mikro-orm)
COPY --from=builder /app/apps/api/src/migrations ./apps/api/src/migrations

# Expose port
EXPOSE 3000

# Set working directory to api
WORKDIR /app/apps/api

# Add node_modules/.bin to PATH for CLI tools
ENV PATH="/app/node_modules/.bin:${PATH}"

# Start the application
CMD ["bun", "run", "start:prod"] 