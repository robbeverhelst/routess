# API Setup & Testing

## Quick Start

1. **Start PostgreSQL**:

   ```bash
   bun run db:up
   ```

2. **Create database schema**:

   ```bash
   bun run db:schema:create
   ```

3. **Start the API**:
   ```bash
   bun run dev
   ```

## Test the API

The API runs on `http://localhost:3000`

### Create a user:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User", "password": "password123"}'
```

### Get all users:

```bash
curl http://localhost:3000/users
```

### Get user by ID:

```bash
curl http://localhost:3000/users/1
```

## Database Management

- `bun run db:up` - Start PostgreSQL container
- `bun run db:down` - Stop PostgreSQL container
- `bun run db:schema:create` - Create database schema
- `bun run db:migration:create` - Create new migration
- `bun run db:migration:up` - Run migrations
