- We always use bun!
- Yes u can run bun run scripts, but never bun dev or infra deploy/destroy or refresh
- bun run dev should always work, there should also only be one bun dev command. if something fails in the bun dev, the scripts need to be adjusted so bun dev succeeds again
- stop running the dev server i do this

# Maps Project Roadmap

## ✅ Completed Work
- **Component Architecture**: Split 2,127-line component into focused providers/hooks
- **State Management**: Full Zustand implementation with persistence and undo/redo
- **Service Layer**: Clean architecture with proper separation of concerns
- **Error Handling**: Comprehensive error system with toasts and boundaries
- **Performance**: React.memo, lazy loading, bundle reduced to 937KB
- **Testing**: 109 passing tests, CI/CD pipeline working
- **Authentication**: Google OAuth with reactive state management
- **Route Persistence**: Routes survive page refreshes

## 🚀 Next Phase: Mobile Package Extraction

### Package Strategy for Web + React Native

We'll use **[@rnmapbox/maps](https://github.com/rnmapbox/maps)** for React Native (same Mapbox as web!) to maximize code reuse.

#### 📦 Monorepo Structure
```
maps/
├── apps/
│   ├── web/          # Current Vite web app
│   ├── mobile/       # New Expo app with @rnmapbox/maps
│   └── api/          # NestJS backend
├── packages/
│   ├── core/         # ~40% of current code (stores, types, utils)
│   ├── api-client/   # API with platform adapters
│   ├── map-core/     # Shared map logic (waypoints, routes)
│   └── i18n/         # Translations
```

#### 🟢 Easy to Extract (Direct Reuse)
- **Zustand stores** - Works identically in React Native
- **Types & interfaces** - All TypeScript definitions
- **Utils** - geospatial.ts, formatting.ts, validation
- **i18n** - Translations work everywhere
- **Core route logic** - Waypoint management, calculations

#### 🟡 Needs Adaptation
- **Storage**: localStorage → AsyncStorage adapter
- **API client**: Add platform-specific storage
- **Location services**: Abstract over platform APIs
- **Map services**: Shared interface for Mapbox GL JS & @rnmapbox/maps

#### 🔴 Platform-Specific
- **UI Components**: Web (Radix/Tailwind) vs Native (NativeBase/Tamagui)
- **Navigation**: TanStack Router vs React Navigation
- **Map Components**: Different but similar APIs thanks to @rnmapbox/maps

### Implementation Plan

**Phase 1: Core Package Extraction** (2-3 days)
1. Create `@maps/core` with stores, types, utils
2. Create `@maps/api-client` with adapters
3. Update web app to use packages

**Phase 2: Mobile Setup** (1 week)
1. Init Expo app with @rnmapbox/maps
2. Integrate shared packages
3. Build native UI components
4. Implement map with familiar Mapbox API

**Phase 3: Feature Parity** (2-3 weeks)
- Complete mobile UI
- Test cross-platform functionality
- Optimize for mobile performance

## 🎯 Other Options

### Web App Polish
- **Accessibility**: ARIA labels, keyboard navigation (4-5 hours)
- **Loading States**: Skeleton screens, progress indicators (2-3 hours)
- **More Testing**: Hooks, providers, services (4-6 hours)

### Advanced Features
- **Route Optimization**: Algorithm improvements (8-12 hours)
- **Weather Integration**: Show conditions on route (6-8 hours)
- **Elevation Profiles**: Terrain visualization (8-10 hours)
- **Real-time Collaboration**: Share live routes (12-16 hours)

### Production Readiness
- **SEO**: Meta tags, Open Graph, structured data
- **Security**: Rate limiting, input validation
- **Monitoring**: Sentry, analytics, performance tracking
- **PWA**: Offline support, install prompt

## 💡 Recommendation

**Start with Mobile Package Extraction** - The architecture is ready, @rnmapbox/maps makes it easier, and you'll have two apps sharing 40%+ code!