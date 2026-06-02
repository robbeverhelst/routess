import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import type { ReactNode } from "react";
import { getDict } from "@/lib/content";
import { DEFAULT_LOCALE, HTML_LANG, LOCALE_HEADER, LOCALES, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import "./globals.css";

const bodyFont = Inter({
	subsets: ["latin"],
	variable: "--font-body",
	display: "swap",
});

const displayFont = Bricolage_Grotesque({
	subsets: ["latin"],
	variable: "--font-display",
	display: "swap",
});

const monoFont = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	display: "swap",
});

async function readLocale(): Promise<Locale> {
	const h = await headers();
	const fromHeader = h.get(LOCALE_HEADER);
	if (fromHeader && (LOCALES as readonly string[]).includes(fromHeader)) {
		return fromHeader as Locale;
	}
	return DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = await readLocale();
	const dict = getDict(locale);
	const selfHost = SELF_HOST[locale];
	const sisterHost = SISTER_HOST[locale];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";

	return {
		title: {
			default: dict.meta.landing.title,
			template: "%s · routess",
		},
		description: dict.meta.landing.description,
		metadataBase: new URL(`https://${selfHost}`),
		alternates: {
			canonical: `https://${selfHost}/`,
			languages: {
				[HTML_LANG[locale]]: `https://${selfHost}/`,
				[HTML_LANG[sisterLocale]]: `https://${sisterHost}/`,
				"x-default": "https://routess.com/",
			},
		},
		openGraph: {
			type: "website",
			locale: HTML_LANG[locale].replace("-", "_"),
			alternateLocale: HTML_LANG[sisterLocale].replace("-", "_"),
			url: `https://${selfHost}/`,
			siteName: "routess",
			title: dict.meta.landing.title,
			description: dict.meta.landing.description,
		},
		twitter: {
			card: "summary_large_image",
			title: dict.meta.landing.title,
			description: dict.meta.landing.description,
		},
	};
}

export default async function RootLayout({ children }: { children: ReactNode }) {
	const locale = await readLocale();
	const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
	const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
	return (
		<html lang={HTML_LANG[locale]} suppressHydrationWarning>
			<body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
				{children}
				{umamiUrl && umamiId ? (
					<Script defer src={umamiUrl} data-website-id={umamiId} strategy="afterInteractive" />
				) : null}
			</body>
		</html>
	);
}
