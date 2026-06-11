import { describe, expect, it } from "bun:test";
import { buildExternalRouteSlugId, buildRouteSlugId, parseRouteSlugId, toRouteSlug } from "./slug";

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

	it("parses a 32-hex share token tail as a token, not an id", () => {
		const token = "9f86d081884c7d659a2feaa0c55ad015";
		expect(parseRouteSlugId(`sunday-loop-${token}`)).toEqual({ slug: "sunday-loop", token });
	});

	it("does not treat shorter hex tails as tokens", () => {
		expect(parseRouteSlugId("sunday-loop-abcdef")).toBeNull();
	});

	it("parses an external -x{id} tail as an externalId, not an id", () => {
		expect(parseRouteSlugId("eurovelo-5-x42")).toEqual({ slug: "eurovelo-5", externalId: 42 });
	});

	it("keeps a plain numeric tail as a user-route id", () => {
		const parsed = parseRouteSlugId("eurovelo-5-42");
		expect(parsed).toEqual({ slug: "eurovelo-5", id: 42 });
	});

	it("rejects non-positive external ids", () => {
		expect(parseRouteSlugId("loop-x0")).toBeNull();
	});
});

describe("buildExternalRouteSlugId", () => {
	it("marks the id with an x discriminator", () => {
		expect(buildExternalRouteSlugId("EuroVelo 5", 42)).toBe("eurovelo-5-x42");
	});

	it("round-trips through parseRouteSlugId", () => {
		const slugId = buildExternalRouteSlugId("Via Romea", 7);
		expect(parseRouteSlugId(slugId)).toEqual({ slug: "via-romea", externalId: 7 });
	});
});
