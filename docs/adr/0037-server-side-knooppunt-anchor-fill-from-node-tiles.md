# Server-side knooppunt anchor fill from the node tiles, not client-filled anchors

Status: accepted

Amends a locked decision in the generation v2 epic (#262).

The epic locked "prefer knooppunten" as client-filled: the web app would fetch knooppunt nodes via `OverpassNodesService` and pass them in the request's `anchors` array, keeping the server free of any Overpass dependency. That service no longer exists: ADR-0033 deleted the whole Overpass path and node networks are now pre-built monthly into PMTiles served by go-pmtiles. The rationale for client-filling (avoid server→Overpass) evaporated with it.

Decided: when `preferNodeNetworks: true` is on a generation request, the API builds the knooppunt anchor pool itself by fetching `/{z}/{x}/{y}.mvt` tiles from the in-cluster go-pmtiles service (new `NODE_TILES_URL` env) at z8, where the build retains every node (`-r1`, no feature dropping), decoding them with `pbf` + `@mapbox/vector-tile`, and caching decoded tiles through the existing layered cache (ADR-0032; monthly data, long TTL). The `anchors` request field stays exactly as specced but now carries only explicit client anchors (POI landmarks, future LLM hints); the contract is the flag plus the anchors array, each with one clear meaning.

If the pool comes back empty (out of Benelux coverage, no nodes nearby, or go-pmtiles unavailable), generation silently proceeds with the plain geometric fan and the response simply omits `networkFit`; the toggle can never fail a generation.

## Considered options

- **API fetches MVT tiles from go-pmtiles** — chosen. One source of truth shared with the map overlay, no schema or cronjob changes, and every API consumer (web, PAT, agents, the future LLM interface) gets knooppunt mode for free instead of each reimplementing the fill.
- **Client decodes MVT tiles and fills `anchors`** — rejected. Preserves the original client-filled contract, but every non-web consumer has to reimplement tile fetching and decoding to use the headline feature.
- **Ingest nodes into Postgres during the monthly tile cronjob** — rejected. Clean radius queries, but a second copy of the data and cronjob-to-API schema coupling for data the API only needs as "nodes near a via".
- **Reintroduce Overpass client-side** — rejected. ADR-0033 removed Overpass for documented reliability reasons; generation has a p95 < 4s budget.

## References

- Issue #262 (generation v2 epic; amends its "client-filled" locked decision)
- ADR-0029 (anchors stage reserved in the pipeline), ADR-0032 (layered cache), ADR-0033 (node tiles)
- Note: the Valhalla `trace_attributes` edge attribute is `edge.bicycle_network` (returned as `bicycle_network`), not `bike_network` as the epic text says; verified populated on our tiles.
