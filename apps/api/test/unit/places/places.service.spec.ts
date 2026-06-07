import { afterEach, describe, expect, it } from "bun:test";
import type { EntityManager } from "@mikro-orm/core";
import type { AppConfig } from "src/config/app-config";
import { PlacesService } from "src/places/places.service";

const originalFetch = globalThis.fetch;

function makeService(token = "pk.test"): PlacesService {
	const config = { geocoding: { mapboxToken: token, referer: "https://routess.com" } } as AppConfig;
	return new PlacesService({} as EntityManager, config);
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(String(input), init)) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("PlacesService.reverseGeocodePlace", () => {
	it("parses city, region, and country from a Mapbox place feature", async () => {
		stubFetch(
			() =>
				new Response(
					JSON.stringify({
						features: [
							{
								text: "Gent",
								place_type: ["place"],
								context: [
									{ id: "region.123", text: "Oost-Vlaanderen" },
									{ id: "country.456", text: "Belgium", short_code: "be" },
								],
							},
						],
					}),
				),
		);
		const place = await makeService().reverseGeocodePlace([3.72, 51.05]);
		expect(place).toEqual({ city: "Gent", region: "Oost-Vlaanderen", countryCode: "BE" });
	});

	it("sends the URL-restricted token's referer header", async () => {
		let referer: string | undefined;
		stubFetch((_url, init) => {
			referer = (init?.headers as Record<string, string>).Referer;
			return new Response(JSON.stringify({ features: [] }));
		});
		await makeService().reverseGeocodePlace([3.72, 51.05]);
		expect(referer).toBe("https://routess.com");
	});

	it("returns null when no feature comes back", async () => {
		stubFetch(() => new Response(JSON.stringify({ features: [] })));
		expect(await makeService().reverseGeocodePlace([0, 0])).toBeNull();
	});

	it("fails open on upstream errors", async () => {
		stubFetch(() => new Response("rate limited", { status: 429 }));
		expect(await makeService().reverseGeocodePlace([3.72, 51.05])).toBeNull();
	});

	it("fails open on network failure", async () => {
		stubFetch(() => {
			throw new Error("ECONNREFUSED");
		});
		expect(await makeService().reverseGeocodePlace([3.72, 51.05])).toBeNull();
	});

	it("is disabled without a token and never calls fetch", async () => {
		let called = false;
		stubFetch(() => {
			called = true;
			return new Response("{}");
		});
		const service = makeService("");
		expect(service.enabled).toBe(false);
		expect(await service.reverseGeocodePlace([3.72, 51.05])).toBeNull();
		expect(called).toBe(false);
	});
});
