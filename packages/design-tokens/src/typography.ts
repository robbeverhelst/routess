/**
 * Typography tokens
 *
 * Three font families:
 *  - display: Bricolage Grotesque (display headings + italic accent)
 *  - body:    Inter (body copy)
 *  - mono:    JetBrains Mono (eyebrows, stats, code)
 *
 * Apps are expected to load the actual font files (Next.js: `next/font/google`,
 * other apps: `@fontsource/*`). The package only declares the font-family stacks
 * and weight/size scales.
 */

export interface FontSizeScale {
	xs: string;
	sm: string;
	base: string;
	lg: string;
	xl: string;
	"2xl": string;
}

export interface FontWeightScale {
	normal: string;
	medium: string;
	semibold: string;
	bold: string;
}

export const fontSize: FontSizeScale = {
	xs: "12px",
	sm: "14px",
	base: "16px",
	lg: "18px",
	xl: "20px",
	"2xl": "24px",
};

export const fontWeight: FontWeightScale = {
	normal: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
};

export const fontFamily = {
	display: ['"Bricolage Grotesque"', '"Inter"', "system-ui", "sans-serif"],
	body: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
	mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
	sans: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
} as const;
