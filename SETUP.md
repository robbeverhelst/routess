# Maps API Setup with Docker Compose and MikroORM

This guide will help you set up the Maps API with PostgreSQL using Docker Compose and MikroORM.

## Prerequisites

- Docker and Docker Compose installed
- Bun package manager installed

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start the services with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port 5432
   - API service on port 3000

3. **Create the database schema:**
   ```bash
   cd apps/api
   bun run schema:create
   ```

## Environment Variables

The following environment variables are used (with defaults):

- `DB_HOST=localhost` (use `postgres` when running in Docker)
- `DB_PORT=5432`
- `DB_USER=maps_user`
- `DB_PASSWORD=maps_password`
- `DB_NAME=maps_db`
- `NODE_ENV=development`
- `PORT=3000`

## Database Operations

### MikroORM CLI Commands

```bash
# Create a new migration
bun run migration:create

# Run pending migrations
bun run migration:up

# Rollback last migration
bun run migration:down

# Create database schema
bun run schema:create

# Update database schema
bun run schema:update

# Drop database schema
bun run schema:drop
```

## API Endpoints

Once running, you can test the API:

- `GET /` - Health check
- `GET /users` - Get all users
- `POST /users` - Create a new user
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe"
  }
  ```

## Development

### Running locally (without Docker)

1. Start PostgreSQL locally or use the Docker Compose postgres service:
   ```bash
   docker-compose up -d postgres
   ```

2. Install dependencies and start the API:
   ```bash
   cd apps/api
   bun install
   bun run dev
   ```

### Database Management

The MikroORM configuration is in `apps/api/src/mikro-orm.config.ts`. It includes:

- PostgreSQL driver configuration
- Entity discovery
- Migration settings
- Debug mode for development

### Adding New Entities

1. Create entity files in `apps/api/src/entities/`
2. Add them to the MikroORM configuration
3. Register them in the app module
4. Create and run migrations

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`
- Verify environment variables are correct

### Migration Issues

- Ensure database exists before running migrations
- Check migration files in `apps/api/src/migrations/`
- Use `schema:create` for initial setup instead of migrations

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs api
docker-compose logs postgres

# Rebuild API service
docker-compose build api
docker-compose up -d api
``` 