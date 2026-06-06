import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./global.css";

const bodyFont = Manrope({
	subsets: ["latin"],
	variable: "--font-body",
});

const displayFont = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-display",
});

const monoFont = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "routess documentation",
		template: "%s · routess docs",
	},
	description: "Documentation, guides, and API reference for routess.",
	openGraph: {
		siteName: "routess docs",
		type: "website",
		images: [{ url: "/logo.png" }],
	},
	twitter: {
		card: "summary",
		images: ["/logo.png"],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
				<RootProvider>
					{/* No locales here: the list drives the language toggle, which only
					    belongs on the translated guide ([lang]/layout.tsx provides it).
					    English-only sections offered a switch into /nl/docs-style 404s. */}
					<I18nProvider locale="en">{children}</I18nProvider>
				</RootProvider>
				{/* The loader route reads the Umami env (set by Helm) at request time,
				    so pages can stay statically rendered. It returns an empty script
				    when Umami is not configured. */}
				<Script defer src="/umami" strategy="afterInteractive" />
			</body>
		</html>
	);
}
