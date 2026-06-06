import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { apiSource } from "@/lib/source";

export default async function Layout(props: { children: ReactNode; params: Promise<{ lang: string }> }) {
	const { lang } = await props.params;
	return (
		<DocsLayout
			{...baseOptions(lang, { languageSwitch: true })}
			tree={apiSource.pageTree[lang] ?? apiSource.pageTree.en}
		>
			{props.children}
		</DocsLayout>
	);
}
