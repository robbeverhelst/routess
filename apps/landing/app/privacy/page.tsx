import type { Metadata } from "next";
import { getDict } from "@/lib/content";
import { HTML_LANG, type Locale, REPO_URL, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";

const COPY = {
	en: {
		title: "Privacy",
		intro:
			"routess is open source and built to keep your data yours. This page covers this marketing site. The app and the self-hosted server are described in the source.",
		sections: [
			{
				h: "Analytics",
				p: "This site uses Umami, a privacy-friendly, cookie-less analytics tool, and only when it is configured. It counts aggregate page views. It does not build personal profiles, set tracking cookies, or share data with advertisers.",
			},
			{
				h: "Your routes",
				p: "Routes you plan and save live in the routess database tied to your account. You can export or delete your data at any time from the app.",
			},
			{
				h: "Self-hosting",
				p: "When you run routess on your own infrastructure, your data stays on your infrastructure. There is no phone-home and no third-party tracking baked in.",
			},
			{
				h: "Contact",
				p: "Questions or requests? Open an issue or reach out through the GitHub repository.",
			},
		],
		repoLabel: "View the source on GitHub",
	},
	nl: {
		title: "Privacy",
		intro:
			"routess is open source en gebouwd om je data van jou te houden. Deze pagina gaat over deze marketingsite. De app en de zelf-gehoste server staan beschreven in de broncode.",
		sections: [
			{
				h: "Analytics",
				p: "Deze site gebruikt Umami, een privacyvriendelijke, cookie-loze analysetool, en alleen wanneer die geconfigureerd is. Het telt geaggregeerde paginaweergaves. Het bouwt geen persoonlijke profielen, plaatst geen tracking-cookies en deelt geen data met adverteerders.",
			},
			{
				h: "Je routes",
				p: "Routes die je plant en opslaat staan in de routess-database, gekoppeld aan je account. Je kan je data op elk moment exporteren of verwijderen vanuit de app.",
			},
			{
				h: "Zelf hosten",
				p: "Als je routess op je eigen infrastructuur draait, blijft je data op je eigen infrastructuur. Er is geen phone-home en geen ingebakken tracking van derden.",
			},
			{
				h: "Contact",
				p: "Vragen of verzoeken? Open een issue of neem contact op via de GitHub-repository.",
			},
		],
		repoLabel: "Bekijk de broncode op GitHub",
	},
} as const;

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const selfHost = SELF_HOST[locale];
	const sisterHost = SISTER_HOST[locale];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const url = `https://${selfHost}/privacy`;
	const title = COPY[locale].title;
	const description = COPY[locale].intro;
	return {
		title,
		description,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${sisterHost}/privacy`,
				"x-default": "https://routess.com/privacy",
			},
		},
		openGraph: { type: "website", url, siteName: "routess", title, description },
	};
}

export default async function PrivacyPage() {
	const locale = await getLocale();
	const dict = getDict(locale);
	const copy = COPY[locale];
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<div style={{ maxWidth: 720 }}>
							<h1 className="display" style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: "12px 0 20px" }}>
								{copy.title}
							</h1>
							<p className="body-lg" style={{ marginBottom: 36 }}>
								{copy.intro}
							</p>
							{copy.sections.map((s) => (
								<div key={s.h} style={{ marginBottom: 28 }}>
									<h2 className="display" style={{ fontSize: 24, margin: "0 0 8px" }}>
										{s.h}
									</h2>
									<p className="body-lg">{s.p}</p>
								</div>
							))}
							<a className="btn btn-ghost" href={REPO_URL}>
								{copy.repoLabel}
							</a>
						</div>
					</div>
				</section>
			</main>
			<Footer dict={dict} />
		</>
	);
}
