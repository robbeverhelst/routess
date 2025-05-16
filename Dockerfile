# Use the official Bun image as base
FROM oven/bun:1.1.0 as builder

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application (skip TypeScript build)
RUN bun vite build

# Production stage
FROM nginx:alpine

# Copy built assets from the Docker build context.
# The GitHub Actions 'docker' job downloads the 'build-files' artifact (which is the 'dist' directory)
# into './dist' in the workspace, making it available in the Docker build context.
COPY dist/ /usr/share/nginx/html/

# Copy nginx config (assuming it's at the root of your repository and thus in the Docker build context)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 