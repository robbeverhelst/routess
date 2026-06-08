#!/usr/bin/env bash
# Build the self-hosted node-network vector tiles (ADR 0033):
#   geofabrik extract -> osmium filter -> GDAL GeoJSON -> transform -> tippecanoe
#   -> upload nodes.pmtiles to S3-compatible object storage.
#
# Run by the monthly in-cluster CronJob; also runnable locally with the same env.
set -euo pipefail

GEOFABRIK_URL="${GEOFABRIK_URL:-https://download.geofabrik.de/europe/benelux-latest.osm.pbf}"
S3_ENDPOINT="${S3_ENDPOINT:?S3_ENDPOINT is required}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
OBJECT_KEY="${OBJECT_KEY:-nodes.pmtiles}"
S3_ACL="${S3_ACL:-public-read}"
CACHE_CONTROL="${CACHE_CONTROL:-public, max-age=86400}"
MIN_ZOOM="${MIN_ZOOM:-8}"
MAX_ZOOM="${MAX_ZOOM:-14}"
WORKDIR="${WORKDIR:-/tmp/node-tiles}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "==> [1/6] downloading extract: $GEOFABRIK_URL"
curl -fSL --retry 3 -o region.osm.pbf "$GEOFABRIK_URL"

echo "==> [2/6] filtering to node-network objects"
# Keep numbered junction nodes, network-tagged ways, and node_network route
# relations (with their referenced members). Everything else is dropped.
osmium tags-filter --overwrite -o nodes-only.osm.pbf region.osm.pbf \
  n/rwn_ref n/lwn_ref n/rcn_ref n/lcn_ref \
  n/network:type=node_network \
  w/rwn w/lwn w/rcn w/lcn \
  r/network:type=node_network

export OSM_CONFIG_FILE="$SCRIPT_DIR/osmconf.ini"

echo "==> [3/6] exporting points + lines as GeoJSONSeq (GDAL OSM driver)"
ogr2ogr -f GeoJSONSeq -overwrite points.geojsons nodes-only.osm.pbf points
ogr2ogr -f GeoJSONSeq -overwrite lines.geojsons  nodes-only.osm.pbf multilinestrings

echo "==> [4/6] transforming to node-network schema"
bun "$SCRIPT_DIR/transform.ts" points.geojsons lines.geojsons > nodes.geojsons

echo "==> [5/6] building vector tiles (tippecanoe -> PMTiles)"
# One source-layer 'node_network'; drop the densest features at low zoom rather
# than failing, so dense regions still tile. Numbered nodes are revealed by the
# client at higher zoom anyway.
tippecanoe \
  --output=nodes.pmtiles \
  --force \
  --layer=node_network \
  --minimum-zoom="$MIN_ZOOM" \
  --maximum-zoom="$MAX_ZOOM" \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-size-limit \
  nodes.geojsons

echo "==> [6/6] uploading to s3://$S3_BUCKET/$OBJECT_KEY"
aws --endpoint-url "$S3_ENDPOINT" s3 cp nodes.pmtiles "s3://$S3_BUCKET/$OBJECT_KEY" \
  --acl "$S3_ACL" \
  --content-type application/octet-stream \
  --cache-control "$CACHE_CONTROL"

echo "==> done. $(du -h nodes.pmtiles | cut -f1) uploaded as $OBJECT_KEY"
