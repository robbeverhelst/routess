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
    ├── @maps/core               # Shared business logic & utilities
    ├── @maps/api-client         # Type-safe API client
    ├── @maps/i18n               # Internationalization (EN, NL, FR, DE)
    └── @maps/design-tokens      # Shared design system
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

# Start all services (web, api, database)
bun dev
```

The web app runs at `http://localhost:5173` and the API at `http://localhost:3000`.

## Scripts

```bash
# Development
bun dev                 # Start all applications

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
