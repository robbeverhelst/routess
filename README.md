# 🗺️ Maps Routing Platform

[![CI](https://img.shields.io/github/actions/workflow/status/robbeverhelst/maps/ci.yml?branch=main&label=CI&logo=github)](https://github.com/robbeverhelst/maps/actions)
[![Version](https://img.shields.io/github/package-json/v/robbeverhelst/maps?logo=npm)](https://github.com/robbeverhelst/maps)
[![License](https://img.shields.io/github/license/robbeverhelst/maps?color=blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs)](https://nestjs.com/)
[![Bun](https://img.shields.io/badge/Bun-1.1.38-f9f1e1?logo=bun)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker)](https://www.docker.com/)

A modern, full-stack mapping application with advanced routing capabilities, user management, and real-time analytics. Built with React, NestJS, and PostgreSQL in a scalable monorepo architecture.

## ✨ Features

### 🎯 Core Functionality

- **Interactive Mapping** - Full-screen Mapbox-powered interface with smooth controls
- **Advanced Routing** - Multiple waypoint types (routed & direct) with real-time calculations
- **User Authentication** - Google OAuth integration with JWT tokens
- **Route Management** - Save, organize, and share your custom routes
- **Location Services** - GPS tracking with enhanced accuracy

### 🔧 Technical Highlights

- **Observability** - OpenTelemetry metrics, structured logging, health checks
- **Performance** - Response compression, caching, rate limiting
- **Security** - Helmet protection, CORS configuration, input validation
- **Testing** - 96 test suite with 100% CI/CD coverage
- **Infrastructure** - Docker deployment with Pulumi IaC

## 🏗️ Architecture

```
maps/
├── apps/
│   ├── web/          # React frontend with Mapbox GL
│   ├── api/          # NestJS REST API with PostgreSQL
│   └── infra/        # Pulumi infrastructure as code
├── packages/         # Shared libraries and utilities
└── docker-compose.yml
```

### Technology Stack

**Frontend**

- React 19 + TypeScript + Vite
- Mapbox GL JS for interactive mapping
- Tailwind CSS + shadcn/ui components
- Progressive Web App (PWA) support

**Backend**

- NestJS + TypeScript
- PostgreSQL with MikroORM
- Google OAuth2 authentication
- OpenTelemetry observability

**Infrastructure**

- Docker containerization
- Pulumi for cloud deployment
- GitHub Actions CI/CD
- Automated testing & quality gates

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.1.38 (package manager)
- **Docker** & Docker Compose
- **Mapbox** access token
- **Google OAuth** client credentials

### Development Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/robbeverhelst/maps.git
   cd maps
   bun install
   ```

2. **Environment configuration**

   ```bash
   # Create .env file with required variables
   cp .env.example .env

   # Add your API keys:
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   DATABASE_URL=postgresql://postgres:password@localhost:5432/maps_db
   ```

3. **Start services**

   ```bash
   # Start database and development servers
   bun dev

   # Applications will be available at:
   # Frontend: http://localhost:5173
   # API: http://localhost:3000
   # Database Admin: http://localhost:8080
   ```

### Production Deployment

```bash
# Build all applications
bun run build

# Deploy to cloud (requires Pulumi setup)
cd apps/infra
pulumi up
```

## 📖 Usage Guide

### Basic Operations

- **🖱️ Click map** → Add waypoint
- **🖱️ Right-click** → Context menu (direct waypoint, remove)
- **⌨️ Ctrl+Z/Y** → Undo/Redo actions
- **📍 Location button** → Center on your position
- **💾 Save route** → Store route in your library

### Advanced Features

- **Route Sharing** → Export GPX or share links
- **Solar Positioning** → Sun angle visualization
- **Multi-language** → i18n support
- **Offline Mode** → PWA caching

## 🧪 Development

### Available Scripts

```bash
# Development
bun dev              # Start all services
bun run format       # Code formatting
bun run lint         # Linting
bun run check-types  # TypeScript validation

# Testing
bun test             # Run all tests
bun run ci           # Full CI pipeline

# Production
bun run build        # Build all apps
bun run docker:build # Docker images
```

### Code Quality

- **ESLint** + **Prettier** for code consistency
- **TypeScript** strict mode enabled
- **96 tests** covering critical paths
- **OpenTelemetry** metrics for production monitoring

### API Documentation

- Health checks: `GET /health`
- Metrics: `GET /metrics` (Prometheus format)
- Authentication: `POST /api/v1/auth/google`
- Routes CRUD: `/api/v1/routes`
- User management: `/api/v1/users`

## 📊 Monitoring & Observability

The application includes comprehensive monitoring:

- **Health Checks** - Liveness, readiness, and dependency health
- **Metrics** - HTTP requests, business KPIs, database performance
- **Logging** - Structured JSON logs with request correlation
- **Tracing** - Distributed tracing for request flows

Access monitoring endpoints:

- Health: `http://localhost:3000/health`
- Metrics: `http://localhost:3000/metrics`

## 🔒 Security

- **Authentication** via Google OAuth 2.0
- **Authorization** with JWT tokens
- **Input Validation** using class-validator
- **Rate Limiting** to prevent abuse
- **Security Headers** via Helmet
- **CORS** properly configured

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Ensure CI passes: `bun run ci`
5. Submit a pull request

### Development Guidelines

- Follow existing code style (enforced by ESLint/Prettier)
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/robbeverhelst/maps/issues)
- **Discussions**: [GitHub Discussions](https://github.com/robbeverhelst/maps/discussions)
- **Documentation**: See `/apps/*/README.md` for component-specific docs

---

**Built with ❤️ using modern web technologies**
