# @routess/design-tokens

Shared design tokens for Routess: colors, typography, spacing, radii, breakpoints, z-index and animation durations.

## Usage

The Next.js apps (`apps/landing`, `apps/docs`) consume the CSS custom properties:

```css
@import "@routess/design-tokens/css/tokens.css";
```

The TypeScript exports carry the same values for code that needs them:

```typescript
import { lightColors, darkColors, fontSize, fontWeight } from "@routess/design-tokens";

// Colors for theming
const bgColor = lightColors.background;
const textColor = darkColors.foreground;

// Typography
const titleSize = fontSize.xl;
const boldWeight = fontWeight.semibold;
```

## What's included

- **Colors**: Light and dark theme color tokens (OKLCH color space)
- **Font sizes**: xs, sm, base, lg, xl, 2xl
- **Font weights**: normal, medium, semibold, bold
- **Font families**: `display` (Bricolage Grotesque), `body` (Inter) and `mono` (JetBrains Mono), each with system fallbacks
- **Layout**: `spacing`, `borderRadius`, `breakpoints`, `zIndex`, `animationDuration`

## Cross-platform

These tokens work with:

- **Web**: Import directly or use with existing CSS setup
- **React Native**: Use values directly in StyleSheet objects
