import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { i18n, localeLabels } from "@/lib/i18n";
import "./global.css";

export const metadata = {
	title: {
		default: "Routess Documentation",
		template: "%s · Routess Docs",
	},
	description: "Documentation, guides, and API reference for Routess.",
};

const locales = i18n.languages.map((language) => ({
	name: localeLabels[language] ?? language,
	locale: language,
}));

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<RootProvider>
					<I18nProvider locale="en" locales={locales}>
						{children}
					</I18nProvider>
				</RootProvider>
			</body>
		</html>
	);
}
