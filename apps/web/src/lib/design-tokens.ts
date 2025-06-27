/**
 * Design tokens for the web app
 * Imports shared design tokens and adds web-specific utilities
 */

import {
  lightColors,
  darkColors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  borderRadius,
  animationDuration,
  type ColorTokens,
} from "@maps/design-tokens";

/**
 * Re-export all design tokens from the shared package
 */
export {
  lightColors,
  darkColors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  borderRadius,
  animationDuration,
};
export type { ColorTokens };

/**
 * Web-specific utility: Get current theme colors based on document class
 * This allows components to access design token colors programmatically
 */
export function getCurrentThemeColors(): ColorTokens {
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? darkColors : lightColors;
}

/**
 * Web-specific utility: Get a specific color from current theme
 */
export function getThemeColor(colorKey: keyof ColorTokens): string {
  return getCurrentThemeColors()[colorKey];
}

/**
 * Web-specific utility: Convert design token values to CSS strings
 */
export const toCss = {
  spacing: (value: keyof typeof spacing) => `${spacing[value]}px`,
  borderRadius: (value: keyof typeof borderRadius) => `${borderRadius[value]}px`,
  animationDuration: (value: keyof typeof animationDuration) => `${animationDuration[value]}ms`,
} as const;
