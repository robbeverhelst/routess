import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { i18n, localeLabels } from "@/lib/i18n";
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

export const metadata = {
	title: {
		default: "routess documentation",
		template: "%s · routess docs",
	},
	description: "Documentation, guides, and API reference for routess.",
};

const locales = i18n.languages.map((language) => ({
	name: localeLabels[language] ?? language,
	locale: language,
}));

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
				<RootProvider>
					<I18nProvider locale="en" locales={locales}>
						{children}
					</I18nProvider>
				</RootProvider>
			</body>
		</html>
	);
}
