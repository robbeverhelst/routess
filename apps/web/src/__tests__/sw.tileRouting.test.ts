import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// sw.js is a service worker script, not a module, so it cannot be imported.
// Lift the two matchers out of the shipped source instead: this test exists
// because mapbox-gl v3 moved every basemap tile to api.mapbox.com, which
// silently stopped matching the old hostname-based check and dumped the whole
// basemap into the 50-entry RUNTIME cache.
// jsdom gives import.meta.url an http scheme, so resolve from the vitest root.
const SW_SOURCE = readFileSync(resolve(process.cwd(), "src/sw.js"), "utf8");

function extractPatterns(name: string): RegExp[] {
	const match = SW_SOURCE.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\];)`));
	if (!match) throw new Error(`${name} not found in sw.js`);
	return new Function(`return ${match[1]}`)() as RegExp[];
}

const MAP_TILE_PATTERNS = extractPatterns("MAP_TILE_PATTERNS");
const MAP_ASSET_PATTERNS = extractPatterns("MAP_ASSET_PATTERNS");

function isMapTileRequest(rawUrl: string): boolean {
	if (MAP_TILE_PATTERNS.some((pattern) => pattern.test(rawUrl))) return true;
	const url = new URL(rawUrl);
	if (url.pathname.startsWith("/nodes/") && url.pathname.endsWith(".mvt")) return true;
	return url.hostname.includes("tiles.mapbox.com") || url.pathname.includes("/tiles/");
}

function isMapAssetRequest(rawUrl: string): boolean {
	return MAP_ASSET_PATTERNS.some((pattern) => pattern.test(rawUrl)) && !isMapTileRequest(rawUrl);
}

// Captured from a live production session (mapbox-gl 3.13, mapbox/standard
// imported by the custom outdoors style).
describe("service worker tile routing", () => {
	it.each([
		["vector tiles", "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/14/8389/5495.vector.pbf"],
		[
			"composite vector tiles",
			"https://api.mapbox.com/v4/mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8-lite/14/8389/5495.vector.pbf?sku=x",
		],
		["contours", "https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2-contour/13/4202/2746.vector.pbf"],
		["terrain DEM", "https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/14/8389/5495.png"],
		["3D buildings", "https://api.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/14/8389/5495.glb"],
		["landmark icons", "https://api.mapbox.com/rasterarrays/v1/mapbox.mapbox-landmark-icons-v1/10/525/342.mrt"],
		["self-hosted node tiles", "https://tiles.routess.com/nodes/13/4202/2746.mvt"],
		["legacy tile CDN", "https://a.tiles.mapbox.com/v4/mapbox.streets/1/1/1.vector.pbf"],
	])("routes %s to the tile cache", (_label, url) => {
		expect(isMapTileRequest(url)).toBe(true);
	});

	it.each([
		["style JSON", "https://api.mapbox.com/styles/v1/mapbox/standard?access_token=x"],
		["glyphs", "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Pro/0-255.pbf"],
		["sprites", "https://api.mapbox.com/v1/sprite/mapbox/standard@2x.png"],
	])("keeps %s in the map-asset cache, not the tile cache", (_label, url) => {
		expect(isMapTileRequest(url)).toBe(false);
		expect(isMapAssetRequest(url)).toBe(true);
	});

	it.each([
		["the node TileJSON", "https://tiles.routess.com/nodes.json"],
		["geocoding", "https://api.mapbox.com/geocoding/v5/mapbox.places/brussels.json"],
	])("does not treat %s as a tile or map asset", (_label, url) => {
		expect(isMapTileRequest(url)).toBe(false);
		expect(isMapAssetRequest(url)).toBe(false);
	});

	it("gives tiles a cache separate from map assets so tile churn cannot evict styles", () => {
		expect(SW_SOURCE).toMatch(/MAP_TILES: `\$\{CACHE_VERSION\}-map-tiles`/);
		expect(SW_SOURCE).toMatch(/staleWhileRevalidate\(request, CACHE_NAMES\.MAP_TILES\)/);
	});
});
