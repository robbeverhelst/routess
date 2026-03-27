/**
 * Design tokens for the web app
 * Imports shared design tokens and adds web-specific utilities
 */

import {
	animationDuration,
	borderRadius,
	type ColorTokens,
	darkColors,
	fontFamily,
	fontSize,
	fontWeight,
	lightColors,
	spacing,
} from "@routess/design-tokens";

export type { ColorTokens };
/**
 * Re-export all design tokens from the shared package
 */
export { animationDuration, borderRadius, darkColors, fontFamily, fontSize, fontWeight, lightColors, spacing };

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
