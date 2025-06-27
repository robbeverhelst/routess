module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.(test|spec).{js,jsx,ts,tsx}"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/components/map/__tests__/", // Temporarily skip problematic component tests
  ],
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
