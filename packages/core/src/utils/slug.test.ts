import { describe, expect, it } from "bun:test";
import { buildRouteSlugId, parseRouteSlugId, toRouteSlug } from "./slug";

describe("toRouteSlug", () => {
	it("kebab-cases a plain name", () => {
		expect(toRouteSlug("Sunday Morning Loop")).toBe("sunday-morning-loop");
	});

	it("transliterates diacritics to ASCII", () => {
		expect(toRouteSlug("Café au Lac")).toBe("cafe-au-lac");
	});

	it("collapses runs of non-alphanumerics and trims edges", () => {
		expect(toRouteSlug("  --Hello, World!!  ")).toBe("hello-world");
	});

	it("truncates to 40 chars without a trailing hyphen", () => {
		const slug = toRouteSlug("a".repeat(60));
		expect(slug.length).toBeLessThanOrEqual(40);
		expect(slug.endsWith("-")).toBe(false);
	});

	it("falls back to 'route' when nothing survives", () => {
		expect(toRouteSlug("???")).toBe("route");
		expect(toRouteSlug("")).toBe("route");
	});
});

describe("buildRouteSlugId", () => {
	it("joins slug and id", () => {
		expect(buildRouteSlugId("Sunday Loop", 42)).toBe("sunday-loop-42");
	});

	it("uses the fallback slug for empty names", () => {
		expect(buildRouteSlugId("", 7)).toBe("route-7");
	});
});

describe("parseRouteSlugId", () => {
	it("parses a canonical slug-id", () => {
		expect(parseRouteSlugId("sunday-loop-42")).toEqual({ slug: "sunday-loop", id: 42 });
	});

	it("keeps the trailing number as the id when the slug itself has digits", () => {
		expect(parseRouteSlugId("route-12-34-56")).toEqual({ slug: "route-12-34", id: 56 });
	});

	it("returns null without a trailing -id", () => {
		expect(parseRouteSlugId("just-a-slug")).toBeNull();
		expect(parseRouteSlugId("123")).toBeNull();
	});

	it("rejects non-positive ids", () => {
		expect(parseRouteSlugId("loop-0")).toBeNull();
	});
});
