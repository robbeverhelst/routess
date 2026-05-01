import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@routess/design-tokens"],
};

export default withMDX(config);
