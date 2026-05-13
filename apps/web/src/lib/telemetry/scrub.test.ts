import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, stripSensitiveQueryParams } from "./scrub";

describe("stripSensitiveQueryParams", () => {
	it("returns the url unchanged when there is no query string", () => {
		expect(stripSensitiveQueryParams("https://api.mapbox.com/styles/v1/mapbox/streets-v12")).toBe(
			"https://api.mapbox.com/styles/v1/mapbox/streets-v12",
		);
	});

	it("redacts access_token while preserving other params", () => {
		const out = stripSensitiveQueryParams("https://api.mapbox.com/x?access_token=pk.abc&limit=10");
		expect(out).toBe("https://api.mapbox.com/x?access_token=[redacted]&limit=10");
	});

	it("redacts oauth code and state", () => {
		const out = stripSensitiveQueryParams("https://routess.com/callback?code=abc123&state=xyz&hint=user");
		expect(out).toBe("https://routess.com/callback?code=[redacted]&state=[redacted]&hint=user");
	});

	it("redacts case-insensitively", () => {
		const out = stripSensitiveQueryParams("https://x.example/?Access_Token=abc&Token=def");
		expect(out).toBe("https://x.example/?Access_Token=[redacted]&Token=[redacted]");
	});

	it("preserves the fragment", () => {
		const out = stripSensitiveQueryParams("https://x.example/?token=abc#section");
		expect(out).toBe("https://x.example/?token=[redacted]#section");
	});
});

describe("scrubBreadcrumb", () => {
	it("scrubs fetch breadcrumb URLs", () => {
		const out = scrubBreadcrumb({
			category: "fetch",
			data: { url: "https://api.example/?access_token=secret", method: "GET" },
		});
		expect(out?.data?.url).toBe("https://api.example/?access_token=[redacted]");
		expect(out?.data?.method).toBe("GET");
	});

	it("scrubs xhr breadcrumb URLs", () => {
		const out = scrubBreadcrumb({
			category: "xhr",
			data: { url: "https://api.example/?token=secret" },
		});
		expect(out?.data?.url).toBe("https://api.example/?token=[redacted]");
	});

	it("leaves non-network breadcrumbs alone", () => {
		const input = { category: "ui.click", message: "Clicked button" };
		expect(scrubBreadcrumb(input)).toEqual(input);
	});
});
