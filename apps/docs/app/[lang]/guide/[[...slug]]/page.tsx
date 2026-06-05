import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { i18n } from "@/lib/i18n";
import { ScreenshotImage } from "@/lib/screenshot-image";
import { guideSource } from "@/lib/source";

export default async function Page(props: { params: Promise<{ lang: string; slug?: string[] }> }) {
	const { lang, slug } = await props.params;
	const page = guideSource.getPage(slug, lang) ?? guideSource.getPage(slug, "en");
	if (!page) notFound();

	const MDX = page.data.body;

	return (
		<DocsPage
			toc={page.data.toc}
			full={page.data.full}
			editOnGithub={{
				owner: "robbeverhelst",
				repo: "routess",
				sha: "main",
				path: `apps/docs/content/guide/${page.path}`,
			}}
		>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX components={{ ...defaultMdxComponents, img: ScreenshotImage }} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return guideSource.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ lang: string; slug?: string[] }> }) {
	const { lang, slug } = await props.params;
	const page = guideSource.getPage(slug, lang) ?? guideSource.getPage(slug, "en");
	if (!page) return {};

	const languages: Record<string, string> = {};
	for (const language of i18n.languages) {
		const variant = guideSource.getPage(slug, language);
		if (variant) languages[language] = variant.url;
	}
	const enUrl = languages.en;
	if (enUrl) languages["x-default"] = enUrl;

	return {
		title: page.data.title,
		description: page.data.description,
		alternates: {
			canonical: page.url,
			languages,
		},
	};
}
