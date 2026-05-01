import type { MDXComponents } from "mdx/types";
import { APIPage } from "@/lib/openapi";

export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		...components,
		APIPage,
	};
}
