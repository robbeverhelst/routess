/**
 * Design tokens for color system
 * Based on OKLCH color space for better perceptual uniformity
 *
 * Two layers:
 *  - brandColors: Routess brand palette (paper/ink/moss/terracotta/sun/sky/indigo)
 *    used directly in landing/marketing surfaces and for product-shaped colors
 *    (SurfaceBucket display: paved/compacted/unpaved/path → ink/sun/terracotta/moss).
 *  - lightColors / darkColors: shadcn-shaped semantic tokens (background/foreground/
 *    primary/...), now re-derived from the brand palette so the whole product
 *    presents one identity.
 */

export interface BrandColors {
	paper: string;
	paper2: string;
	ink: string;
	inkSoft: string;
	muted: string;
	line: string;

	indigo: string;
	indigoSoft: string;
	indigoDeep: string;

	moss: string;
	mossSoft: string;

	terracotta: string;
	terracottaSoft: string;

	sky: string;
	skySoft: string;

	sun: string;
	sunSoft: string;
}

export const lightBrand: BrandColors = {
	paper: "oklch(0.985 0.008 80)",
	paper2: "oklch(0.965 0.018 75)",
	ink: "oklch(0.18 0.02 270)",
	inkSoft: "oklch(0.32 0.02 270)",
	muted: "oklch(0.55 0.015 270)",
	line: "oklch(0.88 0.012 80)",

	indigo: "oklch(0.55 0.18 280)",
	indigoSoft: "oklch(0.92 0.05 280)",
	indigoDeep: "oklch(0.42 0.19 280)",

	moss: "oklch(0.66 0.13 145)",
	mossSoft: "oklch(0.92 0.06 145)",

	terracotta: "oklch(0.66 0.16 45)",
	terracottaSoft: "oklch(0.94 0.05 45)",

	sky: "oklch(0.72 0.12 230)",
	skySoft: "oklch(0.94 0.04 230)",

	sun: "oklch(0.84 0.15 85)",
	sunSoft: "oklch(0.96 0.05 85)",
};

export const darkBrand: BrandColors = {
	paper: "oklch(0.18 0.02 270)",
	paper2: "oklch(0.22 0.02 270)",
	ink: "oklch(0.97 0.01 80)",
	inkSoft: "oklch(0.85 0.01 80)",
	muted: "oklch(0.65 0.015 270)",
	line: "oklch(0.32 0.02 270)",

	indigo: "oklch(0.62 0.18 280)",
	indigoSoft: "oklch(0.32 0.08 280)",
	indigoDeep: "oklch(0.5 0.19 280)",

	moss: "oklch(0.7 0.13 145)",
	mossSoft: "oklch(0.32 0.06 145)",

	terracotta: "oklch(0.72 0.16 45)",
	terracottaSoft: "oklch(0.32 0.06 45)",

	sky: "oklch(0.76 0.12 230)",
	skySoft: "oklch(0.32 0.06 230)",

	sun: "oklch(0.86 0.15 85)",
	sunSoft: "oklch(0.32 0.06 85)",
};

export interface ColorTokens {
	// Core semantic colors
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	border: string;
	input: string;
	ring: string;

	// Chart colors for data visualization
	chart1: string;
	chart2: string;
	chart3: string;
	chart4: string;
	chart5: string;

	// Sidebar specific colors
	sidebar: string;
	sidebarForeground: string;
	sidebarPrimary: string;
	sidebarPrimaryForeground: string;
	sidebarAccent: string;
	sidebarAccentForeground: string;
	sidebarBorder: string;
	sidebarRing: string;
}

export const lightColors: ColorTokens = {
	background: lightBrand.paper,
	foreground: lightBrand.ink,
	card: lightBrand.paper,
	cardForeground: lightBrand.ink,
	popover: lightBrand.paper,
	popoverForeground: lightBrand.ink,
	primary: lightBrand.indigo,
	primaryForeground: "oklch(0.985 0.008 80)",
	secondary: lightBrand.paper2,
	secondaryForeground: lightBrand.ink,
	muted: lightBrand.paper2,
	mutedForeground: lightBrand.muted,
	accent: lightBrand.indigoSoft,
	accentForeground: lightBrand.indigoDeep,
	destructive: lightBrand.terracotta,
	border: lightBrand.line,
	input: lightBrand.line,
	ring: lightBrand.indigo,

	chart1: lightBrand.indigo,
	chart2: lightBrand.moss,
	chart3: lightBrand.terracotta,
	chart4: lightBrand.sun,
	chart5: lightBrand.sky,

	sidebar: lightBrand.paper2,
	sidebarForeground: lightBrand.ink,
	sidebarPrimary: lightBrand.indigo,
	sidebarPrimaryForeground: "oklch(0.985 0.008 80)",
	sidebarAccent: lightBrand.indigoSoft,
	sidebarAccentForeground: lightBrand.indigoDeep,
	sidebarBorder: lightBrand.line,
	sidebarRing: lightBrand.indigo,
};

export const darkColors: ColorTokens = {
	background: darkBrand.paper,
	foreground: darkBrand.ink,
	card: darkBrand.paper2,
	cardForeground: darkBrand.ink,
	popover: darkBrand.paper2,
	popoverForeground: darkBrand.ink,
	primary: darkBrand.indigo,
	primaryForeground: "oklch(0.985 0.008 80)",
	secondary: darkBrand.paper2,
	secondaryForeground: darkBrand.ink,
	muted: darkBrand.paper2,
	mutedForeground: darkBrand.muted,
	accent: darkBrand.indigoSoft,
	accentForeground: darkBrand.ink,
	destructive: darkBrand.terracotta,
	border: darkBrand.line,
	input: darkBrand.line,
	ring: darkBrand.indigo,

	chart1: darkBrand.indigo,
	chart2: darkBrand.moss,
	chart3: darkBrand.terracotta,
	chart4: darkBrand.sun,
	chart5: darkBrand.sky,

	sidebar: darkBrand.paper2,
	sidebarForeground: darkBrand.ink,
	sidebarPrimary: darkBrand.indigo,
	sidebarPrimaryForeground: "oklch(0.985 0.008 80)",
	sidebarAccent: darkBrand.indigoSoft,
	sidebarAccentForeground: darkBrand.ink,
	sidebarBorder: darkBrand.line,
	sidebarRing: darkBrand.indigo,
};

/**
 * SurfaceBucket display palette (paved / compacted / unpaved / path).
 * Single source for the app's surface breakdowns (RouteProfileChart,
 * GenerationOverlay) and landing's marketing mockups.
 */
export const surfaceBucketColors = {
	paved: "oklch(0.45 0.02 240)",
	compacted: "oklch(0.72 0.07 75)",
	unpaved: "oklch(0.6 0.11 50)",
	path: "oklch(0.62 0.13 145)",
} as const;

/**
 * Landing-page accents: marketing-only shades outside the core brand ramps
 * (deep text accents, dark-section text grades, the cream mockup background).
 */
export const landingAccents = {
	mossDeep: "oklch(0.32 0.08 145)",
	terracottaDeep: "oklch(0.42 0.13 45)",
	cream: "oklch(0.96 0.03 80)",
	eyebrowOnDark: "oklch(0.78 0.04 80)",
	mutedOnDark: "oklch(0.78 0.01 80)",
	lavender: "oklch(0.92 0.04 280)",
	lavenderDim: "oklch(0.84 0.04 280)",
	indigoActive: "oklch(0.5 0.17 282)",
	indigoActiveSoft: "oklch(0.5 0.17 282 / 0.12)",
	indigoGradientEnd: "oklch(0.32 0.14 280)",
} as const;

/**
 * Hex mirrors of brand colors for surfaces that cannot parse oklch()
 * (web manifest theme colors, some image pipelines). Visually matched to
 * lightBrand, not exact conversions.
 */
export const brandHex = {
	paper: "#fdfaf2",
	indigo: "#5b3df5",
} as const;
