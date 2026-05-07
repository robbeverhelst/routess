# Routess

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/robbeverhelst/maps/actions/workflows/ci.yml/badge.svg)](https://github.com/robbeverhelst/maps/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/robbeverhelst/maps)](https://github.com/robbeverhelst/maps/releases)

Route-planning app for cyclists, runners, and hikers, with interactive mapping, AI route generation, GPX import/export, and a saved-route library. Built as a Bun monorepo.

## Architecture

```
routess/
├── apps/
│   ├── web/             # React + Vite + Tailwind + Mapbox
│   ├── api/             # NestJS + PostgreSQL + MikroORM
│   └── docs/            # Next.js (Fumadocs)
├── charts/
│   └── routess/         # Helm chart
├── docker/              # Build pipeline (bake + deps image)
└── packages/
    ├── @routess/core            # Shared business logic & state
    ├── @routess/api-client      # Type-safe API client
    ├── @routess/i18n            # Internationalization
    └── @routess/design-tokens   # Shared design system
```

## Quick start

Prerequisites: **Bun** (version pinned in `package.json` `packageManager`), **Docker**.

```bash
git clone https://github.com/robbeverhelst/maps.git routess
cd routess
bun install
cp .env.example .env  # then fill in JWT_SECRET, GOOGLE_CLIENT_ID, VITE_MAPBOX_ACCESS_TOKEN
bun dev
```

Defaults: API `:3000`, docs `:3001`, web `:5173`, Postgres `:5432`, pgAdmin `:5050`. If a port is taken, `bun dev` picks the next free one and prints it. Override any port via `.env`.

## Scripts

```bash
bun dev              # all apps
bun run build        # build everything
bun run lint         # biome check (production-strict)
bun run check-types  # tsc across workspaces
bun run test         # all tests
bun run ci           # full pipeline (postgres + format:check + lint + check-types + build + test)
```

Run `bun run` with no arguments to list every script.

## Deployment

Routess deploys to Kubernetes via the Helm chart in [`charts/routess`](charts/routess). CI builds and pushes images to GHCR via [`docker/docker-bake.hcl`](docker/docker-bake.hcl), then `helm upgrade --install` to the cluster.

For configuration, see [`charts/routess/values.yaml`](charts/routess/values.yaml).

## Tech stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Frontend | React, TypeScript, Vite, Tailwind, Mapbox GL            |
| Backend  | NestJS, PostgreSQL, MikroORM, OpenTelemetry             |
| Docs     | Next.js, Fumadocs                                       |
| Build    | Bun workspaces, Biome, Docker Buildx Bake               |
| Deploy   | Helm, Kubernetes, GitHub Actions, semantic-release      |

## Contributing

PRs welcome. Run `bun run ci` before submitting; CI enforces production-strict TypeScript and Biome rules.

See [`CONTEXT.md`](CONTEXT.md) for the domain glossary and [`docs/agents/`](docs/agents/) for agent/contributor conventions.

## License

[MIT](LICENSE)
