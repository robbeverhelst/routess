import { describe, expect, it } from "bun:test";

import { HANDLE_BASE_MAX_LENGTH, handleBaseFromName, isValidHandle } from "./handle";

describe("isValidHandle", () => {
	it("accepts lowercase alphanumerics and hyphens, 3-30 chars", () => {
		expect(isValidHandle("abc")).toBe(true);
		expect(isValidHandle("jan-de-vries")).toBe(true);
		expect(isValidHandle("9lives")).toBe(true);
		expect(isValidHandle("a".repeat(30))).toBe(true);
	});

	it("rejects handles that are too short or too long", () => {
		expect(isValidHandle("ab")).toBe(false);
		expect(isValidHandle("a".repeat(31))).toBe(false);
	});

	it("rejects a leading hyphen, uppercase and other characters", () => {
		expect(isValidHandle("-abc")).toBe(false);
		expect(isValidHandle("Abc")).toBe(false);
		expect(isValidHandle("ab_c")).toBe(false);
		expect(isValidHandle("ab.c")).toBe(false);
		expect(isValidHandle("abc ")).toBe(false);
	});

	it("rejects reserved path segments and product words", () => {
		expect(isValidHandle("admin")).toBe(false);
		expect(isValidHandle("routess")).toBe(false);
		expect(isValidHandle("cycling-routes")).toBe(false);
	});

	it("rejects non-strings", () => {
		expect(isValidHandle(undefined)).toBe(false);
		expect(isValidHandle(null)).toBe(false);
		expect(isValidHandle(12345)).toBe(false);
	});
});

describe("handleBaseFromName", () => {
	it("slugifies a display name", () => {
		expect(handleBaseFromName("Jan de Vries")).toBe("jan-de-vries");
	});

	it("strips diacritics", () => {
		expect(handleBaseFromName("Zoë Ćelić")).toBe("zoe-celic");
	});

	it("collapses punctuation and trims edge hyphens", () => {
		expect(handleBaseFromName("  --Anna & Bob!!  ")).toBe("anna-bob");
	});

	it("caps the base length without leaving a trailing hyphen", () => {
		const base = handleBaseFromName(`${"a".repeat(HANDLE_BASE_MAX_LENGTH - 1)} bcd`);
		expect(base).toBe("a".repeat(HANDLE_BASE_MAX_LENGTH - 1));
		expect(base?.length).toBeLessThanOrEqual(HANDLE_BASE_MAX_LENGTH);
	});

	it("returns null when the result is too short", () => {
		expect(handleBaseFromName("Al")).toBeNull();
		expect(handleBaseFromName("???")).toBeNull();
		expect(handleBaseFromName("")).toBeNull();
	});

	it("returns null for a reserved word", () => {
		expect(handleBaseFromName("Admin")).toBeNull();
		expect(handleBaseFromName("Settings")).toBeNull();
	});
});
