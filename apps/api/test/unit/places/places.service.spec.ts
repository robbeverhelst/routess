import { afterEach, describe, expect, it } from "bun:test";
import type { EntityManager } from "@mikro-orm/core";
import type { AppConfig } from "src/config/app-config";
import { PlacesService } from "src/places/places.service";
import type { MetricsService } from "src/telemetry/metrics.service";

const originalFetch = globalThis.fetch;

// Geocode cache always misses here (findOne -> null), so every call falls
// through to Mapbox, which is what these tests exercise. upsert is a no-op.
function makeService(token = "pk.test"): PlacesService {
	const config = { geocoding: { mapboxToken: token, referer: "https://routess.com" } } as AppConfig;
	const em = {
		fork: () => ({
			findOne: async () => null,
			upsert: async () => undefined,
		}),
	} as unknown as EntityManager;
	const metrics = {
		recordCacheEvent: () => undefined,
		recordProviderCall: () => undefined,
	} as unknown as MetricsService;
	return new PlacesService(em, config, metrics);
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

	it("serves a repeated lookup from the geocode cache without calling Mapbox", async () => {
		// EM fork backed by an in-memory store so the second call hits the cache.
		const store = new Map<string, unknown>();
		const config = { geocoding: { mapboxToken: "pk.test", referer: "https://routess.com" } } as AppConfig;
		const em = {
			fork: () => ({
				findOne: async (_entity: unknown, where: { key: string }) => store.get(where.key) ?? null,
				upsert: async (_entity: unknown, row: { key: string }) => {
					store.set(row.key, row);
				},
			}),
		} as unknown as EntityManager;
		const metrics = {
			recordCacheEvent: () => undefined,
			recordProviderCall: () => undefined,
		} as unknown as MetricsService;
		const service = new PlacesService(em, config, metrics);

		let fetchCalls = 0;
		stubFetch(() => {
			fetchCalls++;
			return new Response(JSON.stringify({ features: [{ text: "Gent", context: [] }] }));
		});

		const first = await service.reverseGeocodePlace([3.72, 51.05]);
		const second = await service.reverseGeocodePlace([3.72, 51.05]);

		expect(first).toEqual({ city: "Gent", region: undefined, countryCode: undefined });
		expect(second).toEqual(first);
		expect(fetchCalls).toBe(1);
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
