import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@/lib/logger";
import { resolveNodeTilesUrl } from "./nodeTilesUrl";

describe("resolveNodeTilesUrl", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("passes a TileJSON URL through without warning", () => {
		const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
		const url = "https://tiles.routess.com/nodes.json";
		expect(resolveNodeTilesUrl(url)).toBe(url);
		expect(warn).not.toHaveBeenCalled();
	});

	it("warns on a raw .pmtiles URL (mapbox's native provider crashes under terrain)", () => {
		const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
		const url = "https://tiles.routess.com/nodes.pmtiles";
		// Still returned (non-blocking), but the misconfiguration is surfaced.
		expect(resolveNodeTilesUrl(url)).toBe(url);
		expect(warn).toHaveBeenCalledOnce();
	});

	it("handles an undefined URL (overlay disabled) without warning", () => {
		const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
		expect(resolveNodeTilesUrl(undefined)).toBeUndefined();
		expect(warn).not.toHaveBeenCalled();
	});
});
