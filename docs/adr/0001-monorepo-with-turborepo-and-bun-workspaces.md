# Monorepo with Turborepo and Bun workspaces

We organise the codebase as a single repository (`apps/*` for deployables, `packages/*` for shared libraries) using Bun workspaces for dependency resolution and Turborepo for task orchestration. This keeps the web frontend, NestJS API, docs site, and shared logic (`@routess/core`, `@routess/api-client`, `@routess/i18n`, `@routess/design-tokens`) in lockstep, with a single PR atomically updating consumers and producers of shared types. The alternative — separate repos per app/package with versioned releases — would slow down iteration on shared types significantly given the small team size.

## Considered options

- **Polyrepo with versioned packages** — rejected: the api-client / core / types churn frequently and a published-package round-trip would be a major drag.
- **npm or pnpm workspaces instead of Bun** — Bun was chosen for installer speed and as the runtime for the API in production.
