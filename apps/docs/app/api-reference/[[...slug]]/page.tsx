import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { APIPage } from "@/lib/openapi";
import { apiSource } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
	const params = await props.params;
	const page = apiSource.getPage(params.slug);
	if (!page) notFound();

	const MDX = page.data.body;

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX components={{ APIPage }} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return apiSource.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
	const params = await props.params;
	const page = apiSource.getPage(params.slug);
	if (!page) return {};
	return {
		title: page.data.title,
		description: page.data.description,
		alternates: { canonical: page.url },
	};
}
