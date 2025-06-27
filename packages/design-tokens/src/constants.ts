/**
 * Common design constants shared across all platforms
 * These values can be used in web, mobile, and other applications
 */

/**
 * Spacing scale that works across platforms
 * Values are in pixels but can be converted to other units as needed
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

/**
 * Border radius values
 * Values are in pixels but can be converted to other units as needed
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
} as const;

/**
 * Animation duration values in milliseconds
 * Can be converted to seconds or other units as needed per platform
 */
export const animationDuration = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 750,
} as const;

/**
 * Common breakpoints for responsive design
 * Values are in pixels
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Z-index scale for layering
 */
export const zIndex = {
  hide: -1,
  auto: "auto",
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;
