# Test Organization

This directory contains all tests for the API application, organized by test type and functionality.

## Directory Structure

```
test/
├── README.md                    # This documentation
├── integration/                # Integration tests
│   ├── auth.integration.spec.ts
│   ├── routes.integration.spec.ts
│   └── users.integration.spec.ts
├── e2e/                        # End-to-end tests
│   ├── app.e2e.spec.ts
│   └── user-flows.e2e.spec.ts
├── unit/                       # Unit tests (currently empty)
├── fixtures/                   # Test data and mocks
│   └── mocks/
│       └── auth.service.mock.ts
└── utils/                      # Test utilities and setup
    ├── test-utils.ts
    ├── setup-test-db.ts
    └── setup-mocks.ts
```

## Test Types

### Integration Tests (`integration/`)

Test individual API endpoints and their integration with the database and external services:

- **auth.integration.spec.ts** - Authentication flows, Google OAuth, JWT validation
- **routes.integration.spec.ts** - Route CRUD operations, authorization, data validation
- **users.integration.spec.ts** - User management, profile updates, soft deletes

### End-to-End Tests (`e2e/`)

Test complete user journeys and system behavior:

- **app.e2e.spec.ts** - Basic application health and routing
- **user-flows.e2e.spec.ts** - Complete user workflows, multi-user scenarios, error handling

### Unit Tests (`unit/`)

Test individual functions and components in isolation (currently using src/\*.spec.ts pattern)

### Fixtures (`fixtures/`)

Contains test data, mocks, and stub implementations:

- **mocks/** - Service mocks and external API stubs

### Utils (`utils/`)

Shared test utilities and setup functions:

- **test-utils.ts** - Common test helpers (createTestApp, clearDatabase, etc.)
- **setup-test-db.ts** - Database setup and teardown
- **setup-mocks.ts** - Mock configurations for external services

## Running Tests

```bash
# Run all tests
bun run test

# Run specific test types
bun run test:watch         # Watch mode
bun run test:e2e          # E2E tests only
bun run test:debug        # Debug mode

# Run specific test files
bun test auth.integration.spec.ts
bun test user-flows.e2e.spec.ts
```

## Test Configuration

- **Sequential execution** (`bun test --max-concurrency 1`) to avoid database conflicts
- **Test isolation** with database cleanup between tests
- **Comprehensive coverage** reporting
