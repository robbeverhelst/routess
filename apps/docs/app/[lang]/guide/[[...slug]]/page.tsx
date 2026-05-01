import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { guideSource } from "@/lib/source";

export default async function Page(props: { params: Promise<{ lang: string; slug?: string[] }> }) {
	const { lang, slug } = await props.params;
	const page = guideSource.getPage(slug, lang) ?? guideSource.getPage(slug, "en");
	if (!page) notFound();

	const MDX = page.data.body;

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX />
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
	return { title: page.data.title, description: page.data.description };
}
