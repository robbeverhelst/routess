import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { apiSource } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<DocsLayout {...baseOptions("en")} tree={apiSource.pageTree}>
			{children}
		</DocsLayout>
	);
}
