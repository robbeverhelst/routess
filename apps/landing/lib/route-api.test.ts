import { afterEach, describe, expect, it } from "bun:test";
import { fetchIndexablePublicRoutes } from "./route-api";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => { status?: number; items: unknown[]; total?: number }) {
	globalThis.fetch = (async (input: string | URL | Request) => {
		const url = typeof input === "string" ? input : input.toString();
		const { status = 200, items, total } = handler(url);
		return new Response(JSON.stringify(items), {
			status,
			headers: total === undefined ? {} : { "x-total-count": String(total) },
		});
	}) as typeof fetch;
}

const summary = (id: number) => ({ id, name: `Route ${id}`, updatedAt: "2026-08-05T00:00:00Z", slugId: `route-${id}` });

describe("fetchIndexablePublicRoutes", () => {
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("pages until the reported total is collected", async () => {
		const total = 450;
		stubFetch((url) => {
			const offset = Number(new URL(url).searchParams.get("offset"));
			const items = Array.from({ length: Math.max(0, Math.min(200, total - offset)) }, (_, i) => summary(offset + i));
			return { items, total };
		});
		const routes = await fetchIndexablePublicRoutes();
		expect(routes).toHaveLength(total);
		expect(routes[0].id).toBe(0);
		expect(routes[total - 1].id).toBe(total - 1);
	});

	// A short sitemap reads as "these pages are gone" to a crawler, so a failed
	// page must not come back as a successful partial result.
	it("throws rather than returning a truncated corpus when a page fails", async () => {
		stubFetch((url) => {
			const offset = Number(new URL(url).searchParams.get("offset"));
			if (offset >= 200) return { status: 500, items: [] };
			return { items: Array.from({ length: 200 }, (_, i) => summary(i)), total: 1000 };
		});
		await expect(fetchIndexablePublicRoutes()).rejects.toThrow(/offset 200 failed with 500/);
	});

	it("throws instead of spinning when the total is over-reported", async () => {
		stubFetch(() => ({ items: Array.from({ length: 200 }, (_, i) => summary(i)), total: 10_000_000 }));
		await expect(fetchIndexablePublicRoutes()).rejects.toThrow(/exceeded 500 pages/);
	});

	it("stops on an empty page even if the total disagrees", async () => {
		stubFetch((url) => {
			const offset = Number(new URL(url).searchParams.get("offset"));
			if (offset > 0) return { items: [], total: 9999 };
			return { items: Array.from({ length: 200 }, (_, i) => summary(i)), total: 9999 };
		});
		expect(await fetchIndexablePublicRoutes()).toHaveLength(200);
	});
});
