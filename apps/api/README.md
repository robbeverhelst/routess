# Routess API

NestJS API for authentication, route storage, health checks, and telemetry.

## Commands

```bash
bun run --filter './apps/api' dev
bun run --filter './apps/api' build
bun run --filter './apps/api' check-types
bun run --filter './apps/api' test
```

## Environment

The API reads configuration from the repo root `.env`.

Required variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`

Optional variables:

- `PORT`
- `FRONTEND_URL`
- `FRONTEND_URLS` (comma-separated allowlist, preferred when multiple frontend domains are active)
- `JWT_EXPIRES_IN`
- `SESSION_TTL_DAYS`
- `SWAGGER_ENABLED`
- `METRICS_ENABLED`
- `METRICS_PATH`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Structure

- `src/config`: typed environment loading and app config
- `src/auth`: Google auth, JWT sessions, guards, strategies
- `src/users`: current-user profile endpoints
- `src/routes`: route CRUD and DTO mapping
- `src/telemetry`: metrics, tracing, request IDs
- `src/migrations`: MikroORM migrations

## API Surface

- `POST /api/v1/auth/google`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `DELETE /api/v1/users/me`
- `GET /api/v1/routes`
- `POST /api/v1/routes`
- `GET /api/v1/routes/:id`
- `PATCH /api/v1/routes/:id`
- `DELETE /api/v1/routes/:id`
- `GET /health`
- `GET /metrics`
