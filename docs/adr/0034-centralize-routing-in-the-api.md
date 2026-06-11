# Centralize routing in the API; share only pure costing logic in core

All Valhalla calls go through the API. `POST /v1/routing/route` computes a RoutePath and metrics from a waypoint list, and `POST /v1/routing/trace-attributes` classifies surface along a shape. Both the web app (`valhallaClient`, `SurfaceService`) and headless CLI/agent clients hit the same endpoints, so they get identical routes by construction. `packages/core` shares only the fetch-free pieces: the costing translation from RoutingPreferences to Valhalla JSON (`valhallaCostingFromPreferences`, `valhallaCostingModelForActivity`), surface classification (`surfaceCompositionFromEdges`), the duration/distance estimators, and polyline decode. There is no `computeDraft` orchestrator and no `/v1/draft/recalc`. This reverses [ADR-0021 (shared routing logic, dual-credential execution)](0021-shared-routing-logic-dual-credential-execution.md), which planned client-side routing in the browser, a parallel `computeDraft` in core, and a separate agent recalc endpoint.

The constraint that forced the reversal: Valhalla is now self-hosted cluster-internal (the migration whose trigger [ADR-0021 (Valhalla via Stadia)](0021-valhalla-via-stadia-for-routing.md) deferred), so the browser cannot reach the engine at all. Centralizing in the API is also the only place layered caching and provider cost control ([ADR-0032](0032-layered-caching-and-provider-cost-control.md)) and concurrency shedding can live, and it keeps routing credentials and engine topology out of the browser bundle. The trade-off we accept is the one ADR-0021 feared: every waypoint recalc is an API round-trip. Caching plus a cluster-local Valhalla keep that within the latency budget, and centralizing removes the two-implementation drift risk and the need to provision engine access per client.

## Considered options

- **Centralize routing in the API, web and agents call `/v1/routing/*`** (chosen): one Valhalla integration, server-side caching/cost-control/concurrency limits, no engine creds in the browser, and CLI/agents share the web app's exact routing path. Cost: an API round-trip per recalc, and web planning depends on the API to recompute.
- **Dual-credential client-side execution per ADR-0021** (rejected at implementation): a self-hosted cluster-internal engine is unreachable from the browser, there is nowhere to put caching or cost control, and a browser-side `computeDraft` would have to be kept in lockstep with the server's anyway.
- **One orchestrator per app, web client-side and API server-side** (rejected): two implementations drift, and identical inputs would silently produce different routes for users versus agents.

## Consequences

- Positive: a single routing integration; caching, cost control, and concurrency shedding in one place (ADR-0032); the browser never holds routing credentials or knows the engine topology; CLI/agents get identical routes by calling the same endpoints, so they need no dedicated `/v1/draft/recalc`.
- Negative: waypoint recalc is an API round-trip (mitigated by caching and a cluster-local Valhalla); web planning now depends on API availability to recompute geometry, degrading to "can edit from stored shape, cannot recalc" when the API is down.
- Follow-ups: the `computeDraft`, `/v1/draft/*`, and `routess draft *` deliverables from #170 are not built, and #170 is closed as superseded. Pure waypoint mutators were never extracted, so [ADR-0009](0009-routedraft-editor-module.md) stays as the single web-side editor seam, unamended.

## References

- Supersedes ADR-0021 (shared routing logic, dual-credential execution)
- ADR-0021 (Valhalla via Stadia for routing), ADR-0032 (layered caching and provider cost control)
- #137 / #174 (switch routing engine to Valhalla), #187 (proxy trace_attributes through the API), #276 (layered caching and provider cost control)
- #170 (agent planning surface, closed as superseded)
