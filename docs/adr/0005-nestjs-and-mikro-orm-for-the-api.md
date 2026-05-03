# NestJS and MikroORM for the API

The backend (`apps/api`) is built with NestJS and uses MikroORM for persistence against PostgreSQL. NestJS gives us a conventional module/controller/service layering with first-class dependency injection, which keeps services like `RoutesService`, `AuthService`, `UsersService` testable in isolation. MikroORM was chosen over TypeORM/Prisma because its Unit-of-Work pattern matches how Routess mutates Routes (a Route plus its Waypoints are loaded, mutated together, and flushed atomically) and because its entity model lets us keep Route/Waypoint shapes co-located with their domain logic.

## Considered options

- **Prisma** — rejected: schema-first generation is awkward for entities with rich invariants and the codegen step adds friction in a monorepo.
- **TypeORM** — rejected: long-standing reliability issues with relations and transactions.
- **Plain Express + raw SQL** — rejected: would need to rebuild DI, validation, and migration tooling.
