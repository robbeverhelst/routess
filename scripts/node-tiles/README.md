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

Default extract is Benelux. To widen, point `nodeTiles.geofabrikUrl` (or
`GEOFABRIK_URL`) at a larger Geofabrik file, e.g. `europe-latest.osm.pbf`, and
revisit the tippecanoe zoom/drop settings so the file stays small.

## Bucket requirements

The object must be public-read with CORS allowing the web origin and `Range`
requests. CORS/IaC lives in the infra repo, not this chart.
