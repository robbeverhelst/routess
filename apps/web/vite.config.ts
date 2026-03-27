import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		// Disable TanStack Router plugin in Docker builds to prevent conflicts
		...(process.env.DOCKER_BUILD
			? []
			: [
					TanStackRouterVite({
						routeFileIgnorePrefix: "-",
						generatedRouteTree: "./src/routeTree.gen.ts",
					}),
				]),
		react(),
		tailwindcss(),
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
		// Include workspace packages in dependency optimization to prevent dev mode issues
		include: ["@routess/core", "@routess/api-client", "@routess/design-tokens", "@routess/i18n"],
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					// Separate mapbox gl into its own chunk as it's large
					"mapbox-gl": ["mapbox-gl"],
					// Separate React and React DOM into vendor chunk
					"react-vendor": ["react", "react-dom"],
					// Separate UI library into its own chunk
					"ui-vendor": [
						"@radix-ui/react-dialog",
						"@radix-ui/react-popover",
						"@radix-ui/react-select",
						"@radix-ui/react-tooltip",
					],
				},
			},
		},
		chunkSizeWarningLimit: 1000, // Increase limit to 1000kb to reduce warnings for necessary large chunks
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
		include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
		exclude: ["src/components/map/__tests__/**", "node_modules", "dist"],
		passWithNoTests: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html"],
			reportsDirectory: "./coverage",
		},
	},
});
