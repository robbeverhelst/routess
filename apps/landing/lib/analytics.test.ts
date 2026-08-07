import { describe, expect, it } from "bun:test";
import { umamiScriptSrc } from "./analytics";

describe("umamiScriptSrc", () => {
	it("appends the script path so the browser gets JavaScript, not the Umami dashboard HTML", () => {
		expect(umamiScriptSrc("https://analytics.example.com")).toBe("https://analytics.example.com/script.js");
	});

	it("does not double the slash when the configured origin has a trailing one", () => {
		expect(umamiScriptSrc("https://analytics.example.com/")).toBe("https://analytics.example.com/script.js");
		expect(umamiScriptSrc("https://analytics.example.com///")).toBe("https://analytics.example.com/script.js");
	});
});
