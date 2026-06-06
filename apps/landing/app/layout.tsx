import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { getDict } from "@/lib/content";
import { HTML_LANG, type Locale, REPO_URL, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { serializeJsonLd } from "@/lib/json-ld";
import { getLocale } from "@/lib/locale";
import { AnimationRoot } from "./components/AnimationRoot";
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

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
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

function jsonLd(locale: Locale) {
	const dict = getDict(locale);
	const selfHost = SELF_HOST[locale];
	const base = `https://${selfHost}`;
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": `${base}/#org`,
				name: "routess",
				url: base,
				sameAs: [REPO_URL],
			},
			{
				"@type": "SoftwareApplication",
				name: "routess",
				applicationCategory: "LifestyleApplication",
				operatingSystem: "Web",
				url: base,
				description: dict.meta.landing.description,
				offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
				publisher: { "@id": `${base}/#org` },
			},
		],
	};
}

export default async function RootLayout({ children }: { children: ReactNode }) {
	const locale = await getLocale();
	const umamiUrl = process.env.UMAMI_URL;
	const umamiId = process.env.UMAMI_WEBSITE_ID;
	return (
		<html lang={HTML_LANG[locale]} suppressHydrationWarning>
			<body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
				<AnimationRoot />
				{children}
				<Script
					id="ld-json"
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD
					dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd(locale)) }}
				/>
				{umamiUrl && umamiId ? (
					<Script defer src={umamiUrl} data-website-id={umamiId} strategy="afterInteractive" />
				) : null}
			</body>
		</html>
	);
}
