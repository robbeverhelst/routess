import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { docsSource } from "@/lib/source";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
	const params = await props.params;
	const page = docsSource.getPage(params.slug);
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
				path: `apps/docs/content/docs/${page.path}`,
			}}
		>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return docsSource.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
	const params = await props.params;
	const page = docsSource.getPage(params.slug);
	if (!page) return {};
	return {
		title: page.data.title,
		description: page.data.description,
		alternates: { canonical: page.url },
	};
}
