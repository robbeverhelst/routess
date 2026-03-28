# API Test Coverage

The API test suite covers:

- auth flows and JWT-protected access
- current-user profile updates and account deletion
- route CRUD, ownership rules, and soft deletion
- health endpoints, metrics exposure, and request IDs
- validation, CORS, and security headers
- end-to-end user flows

Run the suite with:

```bash
bun run --filter './apps/api' test
```

For local verification of the app surface:

```bash
bun run --filter './apps/api' check-types
bun run --filter './apps/api' build
```
