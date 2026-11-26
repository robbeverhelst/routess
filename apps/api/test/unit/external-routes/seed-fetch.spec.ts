import { afterEach, describe, expect, it } from "bun:test";

import { defaultSeedFetch } from "src/external-routes/external-routes.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// A fetch double that answers like fetch does: the request, and later its
// body stream, fail once the signal aborts.
function stubFetch(stage: "headers" | "body"): void {
	globalThis.fetch = (async (_url: string, init: RequestInit) => {
		const signal = init.signal as AbortSignal | undefined;
		if (stage === "headers") {
			return new Promise<Response>((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));
		}
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("{"));
				signal?.addEventListener("abort", () => controller.error(signal.reason));
			},
		});
		return new Response(stream, { status: 200 });
	}) as unknown as typeof fetch;
}

describe("defaultSeedFetch", () => {
	it("gives up on a feed that never answers", async () => {
		stubFetch("headers");
		await expect(defaultSeedFetch("https://feed.test/routes.json", 50)).rejects.toThrow();
	});

	it("gives up on a feed whose body stalls", async () => {
		stubFetch("body");
		await expect(defaultSeedFetch("https://feed.test/routes.json", 50)).rejects.toThrow();
	});
});
