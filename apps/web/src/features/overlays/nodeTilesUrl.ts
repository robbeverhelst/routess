import { Logger } from "@/lib/logger";

// Node-network tiles must be served as a TileJSON (go-pmtiles serves the
// .pmtiles file's tiles + metadata), NOT the raw .pmtiles file. mapbox-gl's
// native pmtiles provider (an on-demand experimental plugin) throws
// "a is not defined" at render time under terrain/globe (ADR 0033). A plain
// vector source over a TileJSON renders through the same path as the basemap,
// so it is terrain-safe. This guard keeps a raw-.pmtiles misconfiguration from
// silently reintroducing the crash.
export function resolveNodeTilesUrl(url: string | undefined): string | undefined {
	if (url?.endsWith(".pmtiles")) {
		Logger.warn(
			'[NodesOverlay] VITE_NODE_TILES_URL points at a raw .pmtiles file. mapbox-gl\'s native pmtiles provider crashes under terrain ("a is not defined"). Point it at a TileJSON endpoint instead (e.g. https://tiles.routess.com/nodes.json served by go-pmtiles). See ADR 0033.',
		);
	}
	return url;
}
