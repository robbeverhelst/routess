import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Sentry source-map upload only runs when SENTRY_AUTH_TOKEN is provided
// (CI build of the production image, via a BuildKit secret). Absent in
// local builds and dev, so the plugin is omitted entirely.
const sentryPlugins = process.env.SENTRY_AUTH_TOKEN
	? [
			sentryVitePlugin({
				authToken: process.env.SENTRY_AUTH_TOKEN,
				org: process.env.SENTRY_ORG,
				project: process.env.SENTRY_PROJECT ?? "routess",
				url: process.env.SENTRY_URL,
				release: { name: process.env.VITE_APP_VERSION },
				sourcemaps: {
					assets: "./dist/**",
					filesToDeleteAfterUpload: "./dist/**/*.map",
				},
				telemetry: false,
			}),
		]
	: [];

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		TanStackRouterVite({
			routeFileIgnorePrefix: "-",
			generatedRouteTree: "./src/routeTree.gen.ts",
		}),
		react(),
		tailwindcss(),
		...sentryPlugins,
	],
	envDir: path.resolve(__dirname, "../../"),
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// Resolve workspace packages to their source files during development
			"@routess/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
			"@routess/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.ts"),
			"@routess/design-tokens": path.resolve(__dirname, "../../packages/design-tokens/src/index.ts"),
			"@routess/i18n": path.resolve(__dirname, "../../packages/i18n/src/index.ts"),
		},
	},
	optimizeDeps: {
		// Exclude workspace packages from dep pre-bundling so edits to their src
		// are picked up live by HMR. Pre-bundling otherwise freezes the package
		// state at dev-server startup, which made locale edits silently no-op.
		exclude: ["@routess/core", "@routess/api-client", "@routess/design-tokens", "@routess/i18n"],
	},
	build: {
		// Emit source maps without a sourceMappingURL comment so browsers don't
		// try to fetch them. Sentry vite plugin reads them at build time and
		// then deletes them, so users never download .map files.
		sourcemap: "hidden",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/mapbox-gl")) return "mapbox-gl";
					if (id.includes("node_modules/react-dom") || /node_modules\/react\//.test(id)) return "react-vendor";
					if (
						id.includes("node_modules/@radix-ui/react-dialog") ||
						id.includes("node_modules/@radix-ui/react-popover") ||
						id.includes("node_modules/@radix-ui/react-select") ||
						id.includes("node_modules/@radix-ui/react-tooltip")
					)
						return "ui-vendor";
				},
			},
		},
		chunkSizeWarningLimit: 1000, // Increase limit to 1000kb to reduce warnings for necessary large chunks
	},
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: "./src/test/setup.ts",
		include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html"],
			reportsDirectory: "./coverage",
		},
	},
});
