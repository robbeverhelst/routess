import Link from "next/link";
import { notFound } from "next/navigation";
import { type HomeLane, homeCopy } from "@/lib/home-content";
import { i18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

function Lane({ href, lane }: { href: string; lane: HomeLane }) {
	return (
		<Link href={href} className="docs-home__lane">
			<span className="docs-home__lane-kicker">{lane.kicker}</span>
			<h2>{lane.title}</h2>
			<p>{lane.body}</p>
			<ul>
				{lane.bullets.map((bullet) => (
					<li key={bullet}>{bullet}</li>
				))}
			</ul>
		</Link>
	);
}

export default async function HomePage(props: { params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	if (!(i18n.languages as readonly string[]).includes(lang)) notFound();
	const copy = homeCopy[lang] ?? homeCopy.en;
	return (
		<main className="docs-home">
			<section className="docs-home__hero">
				<div className="docs-home__copy">
					<p className="docs-home__eyebrow">{copy.eyebrow}</p>
					<h1 className="docs-home__title">{copy.title}</h1>
					<p className="docs-home__lede">{copy.lede}</p>

					<div className="docs-home__actions">
						<Link href={`/${lang}/docs`} className="docs-home__button docs-home__button--primary">
							{copy.ctaDocs}
						</Link>
						<Link href={`/${lang}/guide`} className="docs-home__button docs-home__button--secondary">
							{copy.ctaGuide}
						</Link>
					</div>
				</div>
			</section>

			<section className="docs-home__lanes" aria-label={copy.lanesLabel}>
				<Lane href={`/${lang}/guide`} lane={copy.guide} />
				<Lane href={`/${lang}/docs`} lane={copy.docs} />
				<Lane href={`/${lang}/api-reference`} lane={copy.api} />
			</section>
		</main>
	);
}

export function generateStaticParams() {
	return i18n.languages.map((lang) => ({ lang }));
}

export async function generateMetadata(props: { params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	const copy = homeCopy[lang] ?? homeCopy.en;
	const languages: Record<string, string> = {};
	for (const language of i18n.languages) {
		languages[language] = `${SITE_URL}/${language}`;
	}
	languages["x-default"] = `${SITE_URL}/en`;
	return {
		description: copy.metaDescription,
		alternates: {
			canonical: `${SITE_URL}/${lang}`,
			languages,
		},
	};
}
