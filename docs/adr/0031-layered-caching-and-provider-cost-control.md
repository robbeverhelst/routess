# Layered caching and provider cost control

Status: accepted

Provider calls (Stadia/Valhalla routing, Mapbox geocoding and elevation, Overpass node networks) were entirely uncached server-side, and with 2 API replicas every in-memory cache and throttle bucket was silently split per pod. Issue #140 asked for caching, quotas, and cost visibility. We decided on a layered design with a small single-instance Redis as the shared cache and throttle store, plus targeted persistence where data is immutable.

## Decisions

1. **Redis, cache-only.** One non-HA Redis in the Helm chart. It may lose data freely; nothing durable lives there. Backs provider-response caches, throttler storage (so existing limits become correct across replicas), and daily quota counters.
2. **Surface composition is persisted, not cached.** SurfaceBuckets are stored on the Route at save time. Opening a saved route makes zero Valhalla calls; `trace_attributes` is only hit during draft editing, behind a Redis cache keyed by hash(activity + geometry), ~30d TTL. `/route` responses get a ~7d Redis cache keyed by (waypoints + costing), mainly deduping generation-pipeline repeats; we accept low hit rates there.
3. **Elevation moves from Mapbox Tilequery to Valhalla `/height`,** server-proxied and Redis-cached by geometry hash. Consolidates on the provider we already meter and makes the cache shared across users instead of per-browser.
4. **Knooppunten go through an API proxy with grid-quantized tiles.** The client requests fixed grid cells (e.g. 0.25 deg) covering its viewport; the API serves cells from Redis (14 to 30d TTL) and fetches misses from Overpass once for all users. Fixes the raw-bbox cache keys that almost never aligned across users.
5. **Geocoding is cached in Postgres** keyed by ~100m-rounded coordinate (durable, tiny, never changes; a TTL store is the wrong shape). Mapbox's standard terms only permit temporary storage of geocoding results, and we already persist Place on Route; we accept this gray zone short-term and plan an exit to a self-hosted OSM geocoder (Nominatim/Photon, ODbL results freely storable). Trigger: before any commercial launch, or if geocode volume makes the risk material.
6. **Public surfaces get bounded staleness, not purge pipelines.** Anonymous GETs (Discover, public route detail, profiles, hubs) carry Cache-Control with s-maxage of 30 to 60s for Cloudflare edge caching (rules live in the infra repo); landing ISR tightens from 300s to 60s. This softens "visibility changes take effect instantly" into the **VisibilityPropagation** bound (max 60s) now defined in CONTEXT.md. The API origin stays authoritative and instant. Authenticated per-user views (Feed, Notifications, inbox) are never cached.
7. **Quotas:** throttler storage moves to Redis; per-User daily quotas (Redis counters, UTC reset, env-configurable) on flows that fan out to paid providers, starting with RouteGeneration. PATs keep their separate bucket (ADR 0022).
8. **Observability:** `provider_calls_total{provider,endpoint,feature,outcome}` and `cache_events_total{cache,result}` on the existing Prometheus endpoint; estimated cost is a Grafana panel multiplying counters by per-call price constants. Per-user attribution stays in structured logs, never in metric labels (cardinality).
9. **No new fallback providers.** Overpass already has a dual endpoint, Place derivation is fail-open with an idempotent backfill as retry, ADR 0021 defines the Valhalla self-host trigger, and the new caches themselves soften short provider outages.

## Considered and rejected

- **Postgres as the only cache:** durable but puts quota counters and hot-path lookups on the primary DB; kept only for the geocode cache where durability is the point.
- **Purge-on-flip (Cloudflare purge + ISR revalidate webhooks) for strict "instantly" semantics:** correct but adds a cross-repo purge pipeline whose failure modes are worse than 60s of staleness.
- **Per-leg `/route` caching:** higher hit rates during editing but tricky semantics; revisit if metrics show `/route` cache misses dominating Stadia spend.
