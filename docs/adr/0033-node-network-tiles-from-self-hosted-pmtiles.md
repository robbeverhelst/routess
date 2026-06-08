# Serve node networks as self-hosted vector tiles, not a live Overpass proxy

Status: accepted

Supersedes decision #4 of [ADR-0032](0032-layered-caching-and-provider-cost-control.md).

The node-network (knooppunten) overlay proxied live Overpass behind the API, quantizing each viewport into 0.1 deg grid cells cached in Redis (ADR-0032 #4). That ADR already named the durable fix as deferred: "a pre-extracted node-network dataset served from our own storage." This is that fix. The proxy was unreliable in exactly the way the ADR predicted: a cold viewport in a dense region (Belgium/NL) hit public Overpass with a 25s-per-cell timeout, was rate-limited (429), and failed atomically because one bad cell rejected the whole request into a 503. Worse, the client reassembled the bbox tiles by hand (padding, containment checks, abort, whole-source replacement), so the overlay only ever showed the last viewport and blanked on every pan. A zoom/area gate meant the overlay was silently empty between zoom 9 and ~11.5. Node networks are slowly-changing public OSM data; treating them as a live API call was the wrong shape.

We now pre-extract the data into our own vector tiles and let Mapbox consume them natively. A monthly in-cluster CronJob runs `geofabrik extract -> osmium tags-filter -> tippecanoe -> nodes.pmtiles` and uploads one immutable PMTiles file to S3-compatible object storage (public-read, it is ODbL data). The web app points a Mapbox `vector` source straight at the `.pmtiles` URL; mapbox-gl-js >= 3.21 reads PMTiles via HTTP range requests with no plugin (we run 3.24). Mapbox owns viewport culling, caching, incremental load, and level-of-detail. Coverage starts at Benelux; expanding to Europe is a one-line change to the CronJob's input file.

## Considered options

- **Pre-extracted PMTiles in object storage, read directly by the client** — chosen. Static data needs no runtime query path. Kills cold-start latency, rate-limit failures, atomic 503s, and the hand-rolled client tile manager in one move. The entire `apps/api/src/overlays` module and the client `OverpassNodesService` delete. One moving part: the monthly build.
- **Dynamic vector tiles from PostGIS `ST_AsMVT`** — rejected. Reuses the existing Postgres, but keeps a live per-tile query path and a runtime service for data that never changes between monthly rebuilds. More moving parts at runtime for no benefit over a flat file.
- **Keep the Overpass bbox proxy, fix only the bugs** — rejected. The zoom/area dead zone, no-accumulation rendering, and atomic failure are all fixable, but the cold-start fragility and public-Overpass rate limits are inherent to proxying a live third party on the request path. ADR-0032 already called this the core limitation.
- **Serve PMTiles via an API byte-range endpoint instead of object storage** — rejected as the primary path (kept as the documented fallback if a bucket is unavailable). Object storage decouples data updates from app deploys: a refresh is a file upload, not a redeploy.

## Consequences

- Positive: first visit anywhere in coverage is instant and offline-of-Overpass. No 429, no 25s timeouts, no 503s. Panning accumulates instead of blanking. The overlay renders across its whole zoom range. Two apps' worth of bespoke tiling code and a Redis cache tier delete; complexity concentrates in one observable CronJob.
- Positive: the tile schema is computed once at build time (clean `fromRef`/`toRef` on connection segments, pre-merged geometry), so the runtime stops parsing connection refs with a regex and stops stacking overlapping relation-member ways.
- Negative: new infra surface. A CronJob, an object-storage bucket (public-read + CORS allowing the web origin and `Range`), and a build image with `osmium`/`tippecanoe`. Data is as fresh as the last monthly run (acceptable; node networks change slowly).
- Negative: we now serve OSM-derived data ourselves, so ODbL attribution must appear on the map.
- Follow-ups: bucket CORS/IaC lives in the infra repo alongside the other edge config. If coverage expands to Europe, revisit tippecanoe zoom/feature-drop settings so the file stays small.
- Source extract note: Geofabrik dropped the combined `benelux` extract, so Benelux is assembled from the three per-country files (`belgium`/`netherlands`/`luxembourg`), filtered and merged. The build validates each download with `osmium fileinfo` so a renamed/removed extract (which Geofabrik 302-redirects to an HTML page) fails loudly instead of silently producing empty tiles.

## Amendment: serve a TileJSON, not the raw .pmtiles (terrain crash)

The original plan had the client point a `vector` source straight at the `.pmtiles` URL and let mapbox-gl read it natively. That works without terrain, but mapbox-gl 3.24's native PMTiles support is an on-demand experimental plugin (`mapbox-gl-pmtiles-provider` v0.0.2), and with terrain/globe enabled it throws `a is not defined` from inside the render loop (`renderToBackBuffer`), crashing the map. The source loads fine; the crash is at render time and only with terrain on.

Fix: keep building the single `.pmtiles` file, but serve it through **go-pmtiles** (`pmtiles serve --public-url …`) instead of a static file server. That exposes a standard **TileJSON** (`/nodes.json`, with `tiles[]`, zoom range, and `vector_layers` including `node_network`) plus `/{z}/{x}/{y}.mvt`. The web app points `VITE_NODE_TILES_URL` at the TileJSON, so the `vector` source renders through the same battle-tested path as the basemap and is terrain-safe. No overlay code changes; a guard warns if the URL is reconfigured back to a raw `.pmtiles`. Verified end-to-end against the production file: go-pmtiles emits a valid TileJSON (layer `node_network`, fields `kind`/`ref`/`fromRef`/`toRef`/`name`) and serves MVT tiles.

## References

- Supersedes ADR-0032 #4 (Knooppunten via API proxy with grid-quantized tiles).
- mapbox-gl-js native PMTiles vector sources (v3.21.0+).
- Source data: OpenStreetMap node networks (`rwn_ref`/`lwn_ref`/`rcn_ref`/`lcn_ref`, `network:type=node_network`), ODbL.
