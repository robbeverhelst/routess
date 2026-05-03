# Routess

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1.38-f9f1e1?logo=bun)](https://bun.sh/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://reactjs.org/)

A modern route planning application with interactive mapping and advanced routing capabilities. Built as a Bun monorepo with shared packages.

## Architecture

```
routess/
├── apps/
│   ├── web/             # React web application (Vite + Mapbox)
│   └── api/             # NestJS backend API
├── charts/
│   └── routess/         # Helm chart for Kubernetes deployment
└── packages/
    ├── @routess/core            # Shared business logic & utilities
    ├── @routess/api-client      # Type-safe API client
    ├── @routess/i18n            # Internationalization (EN, NL, FR, DE)
    └── @routess/design-tokens   # Shared design system
```

## Features

### Web Application (`apps/web`)

- **Interactive Mapping** — Full-screen Mapbox-powered interface
- **Advanced Routing** — Multiple waypoint types with real-time calculations
- **Route Management** — Save, organize, and share custom routes
- **PWA Support** — Offline functionality and app-like experience
- **Google OAuth** — Secure authentication with JWT tokens

### Backend API (`apps/api`)

- **NestJS Framework** — Scalable, modular architecture
- **PostgreSQL** — Robust data persistence with MikroORM
- **OpenTelemetry** — Observability and monitoring
- **Health Checks** — `/health/live` and `/health/ready` endpoints

## Quick Start

### Prerequisites

- **Bun** >= 1.1.38
- **Node.js** >= 18
- **Docker** & Docker Compose

### Development Setup

```bash
git clone https://github.com/robbeverhelst/routess.git
cd routess
bun install

# Copy environment template and add your API keys
cp .env.example .env

# Optional: override ports if 5432 or 5050 are already in use
# PORT=3000
# DOCS_PORT=3001
# WEB_PORT=5173
# DB_PORT=55432
# PGADMIN_PORT=55050

# Start all services (web, api, database)
bun dev
```

The API defaults to `http://localhost:3000`, docs to `http://localhost:3001`, and the web app to `http://localhost:5173`.
If `node_modules` is missing, `bun dev` will install dependencies first.
Postgres defaults to `localhost:5432` and pgAdmin to `http://localhost:5050`.
If any of those default ports are already taken, `bun dev` will choose the next free local port automatically and print it before startup.
Custom non-default port values in `.env` are treated as explicit overrides.

## Scripts

```bash
# Development
bun dev                 # Start all applications
bun run clean           # Remove installs, caches, and Docker state

# Code Quality
bun run format          # Format all code (Biome)
bun run lint            # Lint all packages
bun run check-types     # TypeScript validation
bun run ci              # Full CI pipeline

# Building & Testing
bun run build           # Build all applications
bun run test            # Run all tests

# Docker
bun run docker:build:web   # Build web Docker image
bun run docker:build:api   # Build API Docker image
```

## Deployment

Routess deploys to Kubernetes via a Helm chart. The CI pipeline (GitHub Actions) handles:

1. **CI** — lint, type-check, test, build
2. **Release** — semantic versioning
3. **Docker** — build and push images to GHCR
4. **Deploy** — `helm upgrade --install` to the cluster

```bash
# Manual deployment
helm upgrade --install routess ./charts/routess \
  --namespace routess \
  --create-namespace \
  --set web.image.tag=1.0.0 \
  --set api.image.tag=1.0.0 \
  --set api.secrets.jwtSecret="$JWT_SECRET" \
  --set api.secrets.googleClientId="$GOOGLE_CLIENT_ID" \
  --set api.secrets.dbHost="$DB_HOST" \
  --set api.secrets.dbUser="$DB_USER" \
  --set api.secrets.dbPassword="$DB_PASSWORD"
```

See [`charts/routess/values.yaml`](charts/routess/values.yaml) for all configuration options.

## Tech Stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite, Tailwind, Mapbox  |
| Backend    | NestJS, PostgreSQL, MikroORM, OpenTelemetry   |
| Build      | Bun workspaces, Biome                         |
| Deploy     | Docker, Helm, Kubernetes, GitHub Actions       |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Ensure quality: `bun run ci`
4. Submit a pull request

## License

This project is licensed under the [MIT License](LICENSE).
