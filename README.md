# routess

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/robbeverhelst/routess/actions/workflows/ci.yml/badge.svg)](https://github.com/robbeverhelst/routess/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/robbeverhelst/routess)](https://github.com/robbeverhelst/routess/releases)

Route-planning app for cyclists, runners, and hikers. Interactive map editor, AI route generation, GPX import/export, and a personal route library. Open source, self-hostable, and also available as a hosted service.

> Screenshot placeholder: replace with `docs/assets/hero.png` once captured.

## Try it locally (self-host, 5 minutes)

```bash
git clone https://github.com/robbeverhelst/routess.git
cd routess
cp docker/.env.selfhost.example .env
# fill in JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, VITE_MAPBOX_ACCESS_TOKEN
docker compose -f docker/compose.selfhost.yaml --project-directory . up -d
```

Then open <http://localhost:8080>.

See [`docs/operations/self-host`](https://docs.routess.com/docs/operations/self-host) for the full walkthrough (OAuth setup, optional services, Helm/Kubernetes path, TLS).

## What you need

Minimum to run routess:

- A **Google OAuth client** (the only login provider today)
- A **Mapbox access token** (free tier is fine)
- A **JWT secret** (any long random string)

Optional services degrade gracefully when unset: Resend (email), Stadia Maps (surface analysis), Sentry/GlitchTip (error reporting), Umami (product analytics), Prometheus (metrics).

## Develop on routess

```bash
bun install
cp .env.example .env
bun dev
```

Defaults: web `:5173`, API `:3000`, docs `:3001`, Postgres `:5432`, pgAdmin `:5050`. Ports auto-shift if taken. Full dev guide: [`docs/getting-started/local-setup`](https://docs.routess.com/docs/getting-started/local-setup).

```bash
bun run lint         # biome check
bun run check-types  # tsc across all workspaces
bun run test         # all tests
bun run ci           # full pipeline (postgres + format:check + lint + check-types + build + test)
```

Run `bun run` with no arguments to list every script.

## Project layout

```
routess/
├── apps/
│   ├── web/       # React + Vite + Tailwind + Mapbox
│   ├── api/       # NestJS + PostgreSQL + MikroORM
│   └── docs/      # Next.js (Fumadocs)
├── packages/
│   ├── @routess/core           # Shared business logic & state
│   ├── @routess/api-client     # Type-safe API client
│   ├── @routess/i18n           # Internationalization
│   └── @routess/design-tokens  # Design system
├── charts/routess/  # Helm chart
└── docker/          # Build pipeline (buildx bake)
```

## Tech stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Frontend | React, TypeScript, Vite, Tailwind, Mapbox GL            |
| Backend  | NestJS, PostgreSQL, MikroORM, OpenTelemetry             |
| Docs     | Next.js, Fumadocs                                       |
| Build    | Bun workspaces, Biome, Docker Buildx Bake               |
| Deploy   | Helm, Kubernetes, GitHub Actions, semantic-release      |

## Contributing

PRs welcome. See [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) for the short version and [`docs/contributing`](https://docs.routess.com/docs/contributing) for depth. Run `bun run ci` before submitting; CI enforces production-strict TypeScript and Biome rules.

Security issues: please follow [`SECURITY.md`](.github/SECURITY.md) — do not open public issues for vulnerabilities.

## License

[MIT](LICENSE) © Robbe Verhelst.

## Trademark

"Routess" and the routess logo are trademarks of Robbe Verhelst. The MIT license covers the code; it does not grant permission to use the name or logo for forks, derivative products, or services that could be confused with the original. You are welcome to say your project is "based on routess" or "compatible with routess."
