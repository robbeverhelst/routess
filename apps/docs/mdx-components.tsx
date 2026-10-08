import type { MDXComponents } from "mdx/types";
import { OpenAPIPage } from "@/lib/openapi-page";

export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		...components,
		OpenAPIPage,
	};
}
