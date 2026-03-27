# @routess/design-tokens

Simple shared design tokens for Routess - colors and basic typography only.

## Usage

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
- **Font family**: System font stack

## Cross-platform

These tokens work with:

- **Web**: Import directly or use with existing CSS setup
- **React Native**: Use values directly in StyleSheet objects
