/** @type {import('next').NextConfig} */
const config = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@routess/design-tokens"],
};

export default config;
