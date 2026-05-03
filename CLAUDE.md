# Routess Project Development Log

## Agent skills

This repo uses [Matt Pocock's engineering skills](https://github.com/mattpocock/skills/tree/main/skills/engineering). They expect the following per-repo configuration:

### Issue tracker

Issues live as GitHub issues at `robbeverhelst/maps`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical state roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) plus `bug` / `enhancement` categories. Default label strings — see `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root and one `docs/adr/` directory. See `docs/agents/domain.md`.

## ✅ Completed Work Summary

### **Core Architecture & Infrastructure**

- **Component Architecture**: Split 2,127-line monolithic component into focused providers/hooks
- **State Management**: Full Zustand implementation with persistence and undo/redo
- **Service Layer**: Clean architecture with proper separation of concerns
- **Error Handling**: Comprehensive error system with toasts and boundaries
- **Performance**: React.memo, lazy loading, bundle optimized to 937KB
- **Testing**: 109 passing tests with CI/CD pipeline
- **Authentication**: Google OAuth with reactive state management
- **Route Persistence**: Routes survive page refreshes

### **Workspace Packages Architecture**

- **`@routess/core`**: Shared stores, types, utils, and business logic
- **`@routess/api-client`**: HTTP client with web/mobile adapters
- **`@routess/i18n`**: Internationalization with 4 languages (en, nl, fr, de)
- **`@routess/design-tokens`**: Colors, typography, spacing, and design constants
- **Monorepo**: Turborepo with proper dependency management and build optimization

### **Design Tokens Implementation**

- **Fixed dark mode issue**: Removed automatic theme switching that was overriding defaults
- **Shared package**: All design values centralized in `@routess/design-tokens`
- **Cross-platform ready**: Colors (OKLCH), typography, spacing, border radius, animations
- **Web integration**: Utility functions for theme detection and color access
- **Docker compatibility**: Updated build process to include design tokens

---

## 📊 Current Mobile App Status

### **Phase 1: Foundation & Local Development** ✅ **COMPLETE**

- ✅ Expo app created with TypeScript
- ✅ All shared packages integrated (`@routess/core`, `@routess/api-client`, `@routess/i18n`, `@routess/design-tokens`)
- ✅ Local development working (`bunx expo run:android/ios`)
- ✅ Monorepo properly configured with Turborepo
- ✅ Basic lint/test/type-check scripts working
- ✅ Example component using design tokens

### **Phase 2: Self-Hosted CI/CD** 🟡 **IN PROGRESS**

**This is what EAS Build does, but we'll do it ourselves:**

- ✅ GitHub Actions building actual APKs/IPAs
- 🔄 Automated signing with secrets management (pending keystore setup)
- 🔄 Build artifacts uploaded to GitHub (fixed upload method)
- ✅ Release builds on main branch
- ❌ Distribution to testers
- ❌ Store deployment automation

### **Phase 3: Design System Consistency** 🟡 **PARTIALLY DONE**

- ✅ Design tokens package working
- ❌ Default Expo colors still in use
- ❌ Components not using shared tokens consistently

### **Phase 4: Mapbox Integration** 🟡 **CONFIGURED ONLY**

- ✅ `@rnmapbox/maps` dependency added
- ✅ Permissions configured
- ❌ No actual map implementation yet
- ❌ Missing Mapbox access token

### **Phase 5: Kubernetes Security Hardening** ✅ **COMPLETE**

- ✅ Network Policies implemented for traffic isolation
- ✅ ServiceAccounts with minimal permissions
- ✅ Pod Security Standards with non-root containers
- ✅ Secret management with proper credential handling
- ✅ Security contexts configured for all containers
- ✅ Cloudflare tunnel compatibility maintained

### **Phase 6+: Not Started**

- Shared logic integration (stores, i18n, api)
- Route management features
- Production releases to stores

---

## 🚀 Expo Mobile App Implementation Plan (100% Free)

**Goal**: Create a production-ready Android and iOS app using completely free, local development tools with zero ongoing costs.

### **🎯 Core Principles**

- **Zero payments**: No EAS, no cloud services, no subscriptions
- **Local-first**: All builds happen on your machine
- **Self-hosted CI**: Use existing GitHub Actions (free tier)
- **Manual signing**: Handle certificates ourselves
- **Incremental testing**: Each phase independently testable

---

## **Phase 1: Foundation & Local Development Setup**

**Goal**: Get Expo working locally with our monorepo structure

### **1.1 Prerequisites Setup**

```bash
# Install required tools (one-time setup)
# Android Studio (free) - for Android builds
# Xcode (free with Apple ID) - for iOS builds
# No Expo account needed for local development
```

### **1.2 Create Expo App**

```bash
# Create mobile app in our monorepo
cd apps/
bunx create-expo-app mobile --template blank-typescript
cd mobile/

# Install local development client (replaces Expo Go)
bunx expo install expo-dev-client

# Configure for local builds only
bunx expo prebuild  # Generates android/ and ios/ directories
```

### **1.3 Monorepo Integration**

- Add mobile app to workspace `package.json`
- Configure Turborepo for mobile builds
- Set up shared package dependencies
- Update CI/CD to include mobile linting/testing

### **1.4 Local Build Testing**

```bash
# Test local development builds (completely free)
bunx expo run:android     # Android debug build
bunx expo run:ios         # iOS debug build

# No external services, no accounts needed
```

**✅ Success Criteria**: Mobile app runs locally on Android emulator and iOS simulator

---

## **Phase 2: Self-Hosted CI/CD (Like EAS, But Free)** 🚀 **CURRENT PRIORITY**

### **2.1 Android CI Pipeline**

```yaml
# .github/workflows/native-android-build.yml
name: Build Android App
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: "17"
          distribution: "temurin"
      - uses: android-actions/setup-android@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install & Prebuild
        run: |
          bun install
          cd apps/native
          bunx expo prebuild --platform android

      - name: Build Debug APK
        working-directory: apps/native/android
        run: ./gradlew assembleDebug

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-debug-apk
          path: apps/native/android/app/build/outputs/apk/debug/*.apk
```

### **2.2 Signing & Release Builds**

```bash
# Generate keystore locally (one-time)
keytool -genkey -v -keystore release.keystore \
  -alias maps-app -keyalg RSA -keysize 2048 -validity 10000

# Convert for GitHub Secrets
base64 release.keystore > keystore.base64
# Add to repo secrets: ANDROID_KEYSTORE_BASE64, etc.
```

### **2.3 iOS CI Pipeline**

```yaml
# .github/workflows/native-ios-build.yml
name: Build iOS App
on: [push, pull_request]

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      # Similar setup...
      - name: Build iOS Simulator App
        working-directory: apps/native/ios
        run: |
          xcodebuild -workspace Maps.xcworkspace \
            -scheme Maps \
            -configuration Debug \
            -sdk iphonesimulator
```

### **2.4 Automated Distribution**

```yaml
# Option 1: GitHub Releases (free)
- name: Create Release
  if: startsWith(github.ref, 'refs/tags/')
  uses: softprops/action-gh-release@v1
  with:
    files: apps/native/android/app/build/outputs/apk/release/*.apk
# Option 2: Firebase App Distribution (free tier)
# Option 3: Self-hosted server
# Option 4: Direct to stores (Phase 7-8)
```

**✅ Success Criteria**:

- PRs automatically build APKs
- Main branch produces signed release APKs
- Artifacts downloadable from GitHub Actions
- No dependency on EAS or paid services

---

## **Phase 3: Design System Consistency** ⚡ **NEXT PRIORITY**

### **3.1 Replace Default Expo Colors**

```typescript
// constants/Colors.ts - Replace with design tokens
import { lightColors, darkColors } from "@routess/design-tokens";

export const Colors = {
  light: {
    text: lightColors.foreground,
    background: lightColors.background,
    tint: lightColors.primary,
    // ... etc
  },
  dark: {
    text: darkColors.foreground,
    background: darkColors.background,
    tint: darkColors.primary,
    // ... etc
  },
};
```

### **3.2 Create Design Token Helper Functions**

```typescript
// lib/design-tokens-native.ts
import { spacing, fontSize } from "@routess/design-tokens";

export const parsePixelValue = (value: string): number => {
  return parseInt(value.replace("px", ""), 10);
};

export const nativeSpacing = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
};

export const nativeFontSize = {
  xs: parsePixelValue(fontSize.xs),
  sm: parsePixelValue(fontSize.sm),
  base: parsePixelValue(fontSize.base),
  lg: parsePixelValue(fontSize.lg),
  xl: parsePixelValue(fontSize.xl),
};
```

### **3.3 Update All Components to Use Design Tokens**

- Replace hardcoded colors in `ThemedText`, `ThemedView` components
- Update tab bar styling to use design tokens
- Ensure dark/light mode consistency with web app

**✅ Success Criteria**: All UI uses shared design tokens, visual consistency with web

---

## **Phase 4: Mapbox Integration**

### **4.1 Environment Setup**

```bash
# Add Mapbox token to environment
echo "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_actual_token" >> .env.local
```

### **4.2 Basic Map Implementation**

```typescript
// components/MapView.tsx
import Mapbox from '@rnmapbox/maps';
import { lightColors } from '@routess/design-tokens';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!);

export function MapView() {
  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL="mapbox://styles/mapbox/streets-v11" // Same as web
    >
      <Mapbox.UserLocation
        visible={true}
        showsUserHeadingIndicator={true}
      />
    </Mapbox.MapView>
  );
}
```

### **4.3 Map Screen Creation**

- Create new tab for Map view
- Implement basic pan/zoom functionality
- Add user location tracking
- Test on both Android and iOS

**✅ Success Criteria**: Interactive map working with user location

---

## **Phase 5: Shared Logic Integration** 🔗

### **5.1 Internationalization Setup**

```typescript
// lib/i18n-native.ts
import { createI18nService } from "@routess/i18n";
import { logger } from "@routess/core";

const i18nService = createI18nService(logger);

// React Native hook
export const useTranslation = () => {
  const [language, setLanguage] = useState("en");
  return {
    t: (key: string) => i18nService.t(key, language),
    setLanguage,
    currentLanguage: language,
  };
};
```

### **5.2 State Management Integration**

```typescript
// stores/index.ts
import { routingStore } from "@routess/core";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure persistence for React Native
const mobileRoutingStore = routingStore.withPersist({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
    removeItem: AsyncStorage.removeItem,
  },
});

export { mobileRoutingStore as routingStore };
```

### **5.3 API Client Integration**

```typescript
// lib/api-client-native.ts
import { ApiClient } from "@routess/api-client";

const apiClient = new ApiClient({
  platform: "mobile",
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

export { apiClient };
```

**✅ Success Criteria**: All shared packages working, data persistence, translations displaying

---

## **Phase 6: Map Features & Route Management**

### **6.1 Waypoint System**

```typescript
// components/MapWithRouting.tsx
import { routingStore } from '@/stores';
import { MapView } from './MapView';

const MapWithRouting = () => {
  const { waypoints, addWaypoint } = routingStore();

  const handleMapPress = (coordinates: [number, number]) => {
    addWaypoint(coordinates, false);
  };

  return (
    <MapView
      waypoints={waypoints}
      onMapPress={handleMapPress}
    />
  );
};
```

### **6.2 Route Calculation**

- Integrate route calculation service from `@routess/core`
- Display calculated routes on map
- Handle offline route estimation
- Show route distance and duration

### **6.3 UI Controls**

- Floating action buttons for map controls
- Route controls (undo, reset, generate)
- Location controls (center on user, toggle tracking)
- Settings and menu access

**✅ Success Criteria**: Full route creation and editing functionality

---

## **Phase 7: Android Production Release**

### **7.1 Android App Bundle Creation**

```bash
# Create production Android App Bundle (free)
cd apps/mobile/android
./gradlew bundleRelease

# Output: app-release.aab ready for Google Play
```

### **7.2 Google Play Store Setup**

- Create Google Play Developer account ($25 one-time fee - unavoidable)
- Upload app bundle manually
- Configure store listing
- Set up release management

### **7.3 Release Pipeline**

- Automated builds via GitHub Actions
- Manual signing and upload process
- Version management
- Release notes automation

**✅ Success Criteria**: Android app live on Google Play Store

---

## **Phase 8: iOS Production Release**

### **8.1 iOS App Store Build**

```bash
# Create iOS production build (free with Apple ID)
cd apps/mobile
xcodebuild -workspace ios/mobile.xcworkspace \
           -scheme mobile \
           -configuration Release \
           archive
```

### **8.2 App Store Connect**

- Use free Apple Developer ID for development
- Upgrade to paid account only when ready to publish ($99/year)
- Manual app submission process
- TestFlight beta testing

### **8.3 iOS Release Pipeline**

- Local build and archive process
- Manual certificate management
- App Store submission workflow
- Version management consistency

**✅ Success Criteria**: iOS app live on Apple App Store

---

## **💰 Total Cost Breakdown**

- **Development**: $0 (all free tools)
- **Building**: $0 (local builds only)
- **CI/CD**: $0 (GitHub Actions free tier)
- **Android Release**: $25 (one-time Google Play fee)
- **iOS Release**: $99/year (Apple Developer Program)
- **Total First Year**: $124 maximum

## **🔧 Required Tools (All Free)**

- **Android Studio**: Free Android development environment
- **Xcode**: Free iOS development environment (macOS only)
- **GitHub Actions**: Free CI/CD (2000 minutes/month)
- **Expo CLI**: Free local development tools
- **VS Code**: Free code editor with React Native extensions

## **🔒 Kubernetes Security Implementation**

### **Network Policies**

- **Default deny-all**: Block all traffic by default in the maps namespace
- **Web frontend**: Only allows ingress from Cloudflare tunnel and kube-system
- **API backend**: Allows ingress from web frontend and Cloudflare tunnel, egress to database and external APIs
- **Database**: Only allows ingress from API backend, minimal egress for DNS

### **Pod Security Standards**

- **Non-root containers**: All containers run as non-root users (nginx:101, api:1000, postgres:999)
- **Read-only filesystems**: Where possible (API has read-only, web allows nginx temp files)
- **Dropped capabilities**: All containers drop ALL Linux capabilities
- **No privilege escalation**: `allowPrivilegeEscalation: false` on all containers
- **Seccomp profiles**: RuntimeDefault seccomp profile applied

### **Service Accounts & RBAC**

- **Minimal permissions**: Each service has its own ServiceAccount with minimal required permissions
- **API service account**: Only has access to read secrets it needs
- **Web service account**: No API access (automountServiceAccountToken: false)
- **Database service account**: No API access required

### **Secret Management**

- **Centralized secrets**: API secrets stored in Kubernetes Secret objects
- **Environment injection**: Secrets injected as environment variables from secretKeyRef
- **No plain text**: All sensitive data (JWT, OAuth, DB passwords) stored securely

### **Container Security**

- **Security contexts**: Both pod-level and container-level security contexts configured
- **Resource limits**: CPU, memory, and ephemeral storage limits set
- **Proper user IDs**: Each service runs as appropriate non-root user

**✅ Result**: Production-ready security posture while maintaining Cloudflare tunnel connectivity

---

## **🎯 Key Advantages of This Approach**

- **Complete control**: Your builds, your timeline
- **No vendor lock-in**: Not dependent on EAS or other services
- **Learning opportunity**: Understand the full mobile development process
- **Cost predictable**: Only pay store fees, nothing else
- **Scales with your needs**: Can add paid services later if desired
- **Security hardened**: Production-ready Kubernetes security implementation
