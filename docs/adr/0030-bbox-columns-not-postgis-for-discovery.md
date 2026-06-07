# Discovery geo queries use persisted bbox columns, not PostGIS

Discover lists public Routes intersecting the current map viewport. Instead of adding the PostGIS extension, we persist each Route's bounding box as four plain float columns (`bboxMinLat`, `bboxMaxLat`, `bboxMinLng`, `bboxMaxLng`), computed from the RoutePath on save, and answer viewport queries with ordinary b-tree range predicates. At our volumes (thousands of routes, country-scale density) this is indistinguishable from a spatial index, and it keeps the database image, migrations, Helm chart, and self-host story free of a Postgres extension.

## Considered options

- **PostGIS geometry column + GiST index**: spatially correct (actual-path intersection, distance ordering, "routes along my route" later), but adds an extension dependency to prod and every self-hosted instance for a v1 that only needs rectangle overlap.
- **Start point only (2 columns)**: simplest, but a long route passing through the viewport while starting elsewhere becomes invisible — wrong for icoonroutes/RAVeL-scale routes that seeding (#248) will bring.

## Consequences

- A continent-scale route (e.g. a EuroVelo track) has a bbox covering a huge area and will match viewports far from its actual path. Accepted for v1; PostGIS path-intersection is the designated fix if seeded long-distance routes make this noisy.
- Anything needing real spatial semantics (corridor search, distance-to-route) should trigger a revisit of this ADR rather than be approximated on bboxes.
