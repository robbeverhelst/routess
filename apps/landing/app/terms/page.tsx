import type { Metadata } from "next";
import { getDict } from "@/lib/content";
import { HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { TERMS } from "@/lib/legal/terms";
import { getLocale } from "@/lib/locale";
import { Footer } from "../components/Footer";
import { LegalDoc } from "../components/LegalDoc";
import { Nav } from "../components/Nav";

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const url = `https://${SELF_HOST[locale]}/terms`;
	const doc = TERMS[locale];
	return {
		title: doc.title,
		description: doc.intro,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SISTER_HOST[locale]}/terms`,
				"x-default": "https://routess.com/terms",
			},
		},
		openGraph: { type: "website", url, siteName: "routess", title: doc.title, description: doc.intro },
	};
}

export default async function TermsPage() {
	const locale = await getLocale();
	const dict = getDict(locale);
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<LegalDoc doc={TERMS[locale]} />
			</main>
			<Footer dict={dict} />
		</>
	);
}
