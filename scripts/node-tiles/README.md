# node-tiles

Builds the self-hosted node-network (knooppunten) vector tiles the web overlay
reads (ADR 0033). Replaces the old live-Overpass proxy: node networks are
slowly-changing OSM data, so we pre-extract them into one PMTiles file served
from object storage and read natively by mapbox-gl.

## Pipeline

```
geofabrik extract (.osm.pbf)
  → osmium tags-filter         keep node-network nodes / ways / route relations
  → ogr2ogr (GDAL OSM driver)  points + multilinestrings → GeoJSONSeq
  → transform.ts               classify hiking/cycling, build fromRef/toRef, one schema
  → tippecanoe                 → nodes.pmtiles  (layer: node_network)
  → aws s3 cp                  upload to the bucket (public-read)
```

`transform.ts` is the build-time home of the classification logic that used to
run per request in the API's `overpass.ts`.

## Run locally

Needs `osmium`, `gdal` (`ogr2ogr`), `tippecanoe`, `bun`, and `aws` on PATH — or
just build and run the image (`apps/node-tiles/Dockerfile`).

```bash
export S3_ENDPOINT="https://minio.example.com"
export S3_BUCKET="routess-tiles"
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
# optional: GEOFABRIK_URL (default benelux), OBJECT_KEY, MIN_ZOOM, MAX_ZOOM
./build.sh
```

## In production

A monthly Kubernetes CronJob (`charts/routess/templates/node-tiles-cronjob.yaml`,
`nodeTiles.*` in values). Trigger an ad-hoc rebuild:

```bash
kubectl -n routess create job --from=cronjob/<release>-node-tiles node-tiles-manual
```

## Coverage

`GEOFABRIK_URL` (chart: `nodeTiles.geofabrikUrl`) is a **space-separated list**
of Geofabrik `.osm.pbf` extracts; each is downloaded, validated, filtered, and
merged. Geofabrik no longer ships a combined `benelux` file, so the default is
the three per-country extracts (`belgium`, `netherlands`, `luxembourg`). Trim to
one country to shrink the build (Netherlands has the densest network, Belgium is
smallest), or add `europe-latest.osm.pbf` to widen (then revisit the tippecanoe
zoom/drop settings so the file stays small). A bad URL fails the build loudly
(`osmium fileinfo` rejects Geofabrik's HTML redirect page) rather than producing
empty tiles.

## Serving (TileJSON, not raw .pmtiles)

The web app does **not** read the raw `.pmtiles` file directly: mapbox-gl's
native pmtiles provider crashes under terrain (`a is not defined`, ADR 0033).
Instead the file is served by **go-pmtiles** (`pmtiles serve --public-url
https://tiles.routess.com`), which exposes a standard TileJSON at
`/nodes.json` and MVT tiles at `/nodes/{z}/{x}/{y}.mvt`. Point
`VITE_NODE_TILES_URL` at the TileJSON (`.../nodes.json`), not the `.pmtiles`.

go-pmtiles can read the `.pmtiles` straight from the bucket, so the build's
upload target is unchanged. CORS must allow the web origin and `Range`
requests; CORS/serving IaC lives in the infra repo, not this chart.
