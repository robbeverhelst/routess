import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const guide = defineDocs({
	dir: "content/guide",
});

export const developerDocs = defineDocs({
	dir: "content/docs",
});

export const apiReference = defineDocs({
	dir: "content/api",
});

export default defineConfig({
	mdxOptions: {
		rehypePlugins: [],
	},
});
