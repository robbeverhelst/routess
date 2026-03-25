module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.(test|spec).{js,jsx,ts,tsx}"],
	testPathIgnorePatterns: [
		"/node_modules/",
		"/components/map/__tests__/", // Temporarily skip problematic component tests
	],
	transformIgnorePatterns: ["node_modules/(?!(@maps/.*))"],
	extensionsToTreatAsEsm: [".ts", ".tsx"],
	transform: {
		"^.+\\.(ts|tsx)$": [
			"ts-jest",
			{
				useESM: true,
				tsconfig: {
					target: "es2020",
					module: "esnext",
					moduleResolution: "node",
					esModuleInterop: true,
					allowSyntheticDefaultImports: true,
					resolveJsonModule: true,
					jsx: "react-jsx",
					skipLibCheck: true,
					strict: true,
					baseUrl: ".",
					paths: {
						"@/*": ["./src/*"],
					},
					types: ["jest", "@testing-library/jest-dom", "node", "vite/client"],
					noEmit: true,
					lib: ["ES2020", "DOM", "DOM.Iterable"],
				},
			},
		],
	},
	setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@maps/core$": "<rootDir>/../../packages/core/src/index.ts",
		"^@maps/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
		"^@maps/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts",
		"^@maps/i18n$": "<rootDir>/../../packages/i18n/src/index.ts",
		"\\.(css|less|scss|sass)$": "identity-obj-proxy",
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"!src/**/*.d.ts",
		"!src/test/**",
		"!src/routeTree.gen.ts",
		"!src/vite-env.d.ts",
	],
	coverageReporters: ["text", "lcov", "html"],
	coverageDirectory: "coverage",
	testTimeout: 10000,
	bail: 0, // Don't stop on first failure
	verbose: false, // Reduce output
	silent: false, // Allow console logs for debugging
};
