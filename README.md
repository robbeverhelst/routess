# 🗺️ Maps Platform

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1.38-f9f1e1?logo=bun)](https://bun.sh/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.0-00b894?logo=turborepo)](https://turbo.build/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://reactjs.org/)
[![Expo](https://img.shields.io/badge/Expo-53-000020?logo=expo)](https://expo.dev/)

A modern, cross-platform mapping application with advanced routing capabilities. Built as a scalable monorepo with shared packages for maximum code reuse between web and mobile platforms.

## 🏗️ Architecture

This project is structured as a **Turborepo monorepo** with shared packages and multiple platform applications:

```
maps/
├── apps/
│   ├── web/           # React web application (Vite + Mapbox)
│   ├── native/        # React Native mobile app (Expo)
│   ├── api/           # NestJS backend API
│   └── infra/         # Pulumi infrastructure as code
├── packages/
│   ├── @maps/core               # Shared business logic & utilities
│   ├── @maps/api-client         # Type-safe API client
│   ├── @maps/i18n               # Internationalization system
│   └── @maps/design-tokens      # Shared design system
└── tooling/
    ├── eslint-config/   # Shared ESLint configuration
    └── typescript-config/ # Shared TypeScript settings
```

### 🎯 Cross-Platform Strategy

- **Code Reuse**: Core business logic shared between web and mobile
- **Consistent APIs**: Type-safe client with automatic TypeScript generation
- **Unified Design**: Shared design tokens for consistent UI/UX
- **Centralized i18n**: Single translation system across platforms

## ✨ Features

### 🌐 Web Application (`apps/web`)
- **Interactive Mapping** - Full-screen Mapbox-powered interface
- **Advanced Routing** - Multiple waypoint types with real-time calculations
- **Route Management** - Save, organize, and share custom routes
- **PWA Support** - Offline functionality and app-like experience
- **Google OAuth** - Secure authentication with JWT tokens

### 📱 Mobile Application (`apps/native`)
- **Cross-Platform** - iOS and Android with single codebase
- **Native Performance** - Expo with native map components
- **Shared Logic** - Reuses core business logic from web app
- **Platform Integration** - Native location services and permissions

### 🔧 Backend API (`apps/api`)
- **NestJS Framework** - Scalable, modular architecture
- **PostgreSQL** - Robust data persistence with MikroORM
- **OpenTelemetry** - Comprehensive observability and monitoring
- **Rate Limiting** - Protection against abuse

### 🏗️ Infrastructure (`apps/infra`)
- **Pulumi IaC** - Infrastructure as Code for cloud deployment
- **Multi-Environment** - Development, staging, and production configs
- **Cloud Agnostic** - Support for AWS, Azure, and GCP
- **Automated Deployments** - CI/CD integration with GitHub Actions

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.1.38
- **Node.js** >= 18
- **Docker** & Docker Compose
- **Xcode** (for iOS development)
- **Android Studio** (for Android development)

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/robbeverhelst/maps.git
   cd maps
   bun install
   ```

2. **Environment configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Add your API keys:
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
   GOOGLE_CLIENT_ID=your_google_client_id
   DATABASE_URL=postgresql://postgres:password@localhost:5432/maps_db
   ```

3. **Start development**
   ```bash
   # Start all services (web, api, database)
   bun dev
   
   # Or start individual apps:
   bun dev:web      # Web app at http://localhost:5173
   bun dev:api      # API at http://localhost:3000
   bun dev:native   # Mobile app with Expo
   ```

### Platform-Specific Development

#### 🌐 Web Development
```bash
cd apps/web
bun dev          # Development server
bun build        # Production build
bun preview      # Preview production build
```

#### 📱 Mobile Development
```bash
cd apps/native

# iOS Development
bun run ios              # Start iOS simulator
bun run emulator:start   # Start Android emulator
bun run android          # Build for Android

# Emulator Management (CLI automation)
bun run emulator:list    # List available emulators
bun run emulator:start   # Start emulator
bun run emulator:kill    # Stop emulator
bun run emulator:devices # Check running devices
```

#### 🔧 API Development
```bash
cd apps/api
bun dev          # Development with hot reload
bun build        # Production build
bun test         # Run API tests
```

#### 🏗️ Infrastructure Management
```bash
cd apps/infra
bun install      # Install Pulumi dependencies
pulumi stack ls  # List available stacks
pulumi up        # Deploy infrastructure
pulumi destroy   # Tear down infrastructure
```

## 📦 Shared Packages

### `@maps/core`
Core business logic and utilities shared across platforms:
- Route calculation algorithms
- Geospatial utilities
- Data validation schemas
- Common types and interfaces

### `@maps/api-client`
Type-safe API client with platform-specific adapters:
- Automatic TypeScript generation from OpenAPI specs
- Web adapter using fetch
- React Native adapter using expo-network
- Built-in error handling and retry logic

### `@maps/i18n`
Centralized internationalization system:
- Type-safe translation keys
- Support for 4 languages (EN, NL, FR, DE)
- Platform-agnostic translation service
- Automatic missing key detection

### `@maps/design-tokens`
Shared design system for consistent UI:
- Color palettes (light/dark themes)
- Typography scales
- Cross-platform compatibility (CSS + React Native)

## 🧪 Development Workflow

### Available Scripts

```bash
# Development
bun dev                 # Start all applications
bun dev:web            # Web app only
bun dev:native         # Mobile app only
bun dev:api            # Backend API only

# Code Quality
bun format             # Format all code (Prettier)
bun lint               # Lint all packages (ESLint)
bun check-types        # TypeScript validation
bun ci                 # Full CI pipeline (format, lint, build, test)

# Building
bun build              # Build all applications
bun build:web          # Web app production build
bun build:native       # Mobile app export

# Testing
bun test               # Run all tests
bun test:web           # Web app tests only
bun test:api           # API tests only

# Infrastructure
cd apps/infra && pulumi up      # Deploy infrastructure
cd apps/infra && pulumi destroy # Tear down infrastructure

# Package Management
bun clean              # Clean all build artifacts
bun reset              # Clean and reinstall dependencies
```

### Turborepo Benefits

- **Incremental Builds** - Only rebuilds changed packages
- **Smart Caching** - Speeds up repeated operations
- **Parallel Execution** - Runs tasks across packages simultaneously
- **Dependency Awareness** - Builds packages in correct order

## 🔒 Security & Best Practices

- **Environment Variables** - Secure API key management
- **Type Safety** - Full TypeScript coverage
- **Code Quality** - ESLint + Prettier enforcement
- **Git Hooks** - Pre-commit validation
- **Dependency Updates** - Automated security patches

## 📊 Monitoring & Observability

- **Health Checks** - `/health` endpoint with dependency status
- **Metrics** - Prometheus-compatible metrics at `/metrics`
- **Structured Logging** - JSON logs with correlation IDs
- **OpenTelemetry** - Distributed tracing for request flows

## 🚢 Deployment

### Production Build
```bash
# Build all applications for production
bun run build

# Build Docker images
bun run docker:build

# Deploy infrastructure (Pulumi)
cd apps/infra && pulumi up
```

### Mobile App Deployment
```bash
cd apps/native

# iOS
bun run build:ios       # Build for iOS
# Submit to App Store via Xcode or CI/CD

# Android
bun run build:android   # Build APK/AAB
# Submit to Google Play via CI/CD
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests: `bun test`
4. Ensure quality: `bun ci`
5. Submit a pull request

### Development Guidelines

- **Monorepo First** - Consider shared packages for reusable code
- **Type Safety** - Maintain 100% TypeScript coverage
- **Testing** - Add tests for new features
- **Documentation** - Update relevant README files
- **Code Style** - Follow ESLint/Prettier configuration

## 📱 Platform Support

| Platform | Status | Features |
|----------|--------|----------|
| **Web** | ✅ Production Ready | Full feature set, PWA support |
| **iOS** | ✅ Development Ready | Native maps, location services |
| **Android** | ✅ Development Ready | Native maps, permissions |
| **Desktop** | 🔄 Planned | Electron wrapper |

## 🔧 Technical Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **TypeScript 5.8** - Strict type checking
- **Vite** - Fast development and building
- **Tailwind CSS** - Utility-first styling
- **Mapbox GL JS** - Interactive mapping

### Mobile
- **Expo 53** - React Native platform with native modules
- **@rnmapbox/maps** - Native map components
- **Expo Router** - File-based navigation
- **React Native 0.79** - Latest React Native

### Backend
- **NestJS** - Scalable Node.js framework
- **PostgreSQL** - Relational database
- **MikroORM** - Type-safe ORM
- **OpenTelemetry** - Observability stack

### DevOps
- **Turborepo** - Monorepo build system
- **Bun** - Fast package manager and runtime
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline
- **Pulumi** - Infrastructure as Code (IaC)
- **Multi-Cloud** - AWS, Azure, GCP support

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/robbeverhelst/maps/issues)
- **Discussions**: [GitHub Discussions](https://github.com/robbeverhelst/maps/discussions)
- **Documentation**: Check individual app READMEs in `/apps/*/README.md`

---

**Built with ❤️ for cross-platform excellence**