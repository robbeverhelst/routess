/**
 * Simple typography tokens
 */

export interface FontSizeScale {
  /** 12px */
  xs: string;
  /** 14px */
  sm: string;
  /** 16px */
  base: string;
  /** 18px */
  lg: string;
  /** 20px */
  xl: string;
  /** 24px */
  "2xl": string;
}

export interface FontWeightScale {
  /** 400 */
  normal: string;
  /** 500 */
  medium: string;
  /** 600 */
  semibold: string;
  /** 700 */
  bold: string;
}

/**
 * Font size tokens
 */
export const fontSize: FontSizeScale = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  lg: "18px",
  xl: "20px",
  "2xl": "24px",
};

/**
 * Font weight tokens
 */
export const fontWeight: FontWeightScale = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

/**
 * Font family tokens
 */
export const fontFamily = {
  sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
} as const;
