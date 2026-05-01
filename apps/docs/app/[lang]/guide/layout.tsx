import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { guideSource } from "@/lib/source";

export default async function Layout(props: { children: ReactNode; params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	return (
		<DocsLayout {...baseOptions(lang)} tree={guideSource.pageTree[lang] ?? guideSource.pageTree.en}>
			{props.children}
		</DocsLayout>
	);
}
