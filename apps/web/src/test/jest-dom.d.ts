import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// setup.ts registers the jest-dom matchers on bun:test's expect.
declare module "bun:test" {
	interface Matchers<T> extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
	interface AsymmetricMatchers extends TestingLibraryMatchers {}
}
