import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import type { ReactNode } from "react";
import { LangAttribute } from "@/app/components/lang-attribute";
import { i18n, localeLabels } from "@/lib/i18n";

export default async function LangLayout(props: { children: ReactNode; params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	return (
		<I18nProvider
			locale={lang}
			locales={i18n.languages.map((language) => ({
				name: localeLabels[language] ?? language,
				locale: language,
			}))}
		>
			<LangAttribute lang={lang} />
			{props.children}
		</I18nProvider>
	);
}
