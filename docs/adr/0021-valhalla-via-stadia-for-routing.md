# Valhalla via Stadia Maps for routing

> **Update:** the engine choice (Valhalla over Mapbox/ORS/GraphHopper/OSRM/BRouter) still holds, but the "Stadia first, self-host later" hosting plan has since executed. Valhalla now runs self-hosted cluster-internal, reached only through the API. See [ADR-0034](0034-centralize-routing-in-the-api.md).

Routing migrates from Mapbox Directions to Valhalla, initially hosted on Stadia Maps (extending the existing relationship that already powers post-hoc surface analysis via `trace_attributes`). Mapbox's cycling and walking profiles expose almost no user-tunable preferences (cycling: `exclude=ferry` only; walking: `exclude=ferry`, `walking_speed`, `walkway_bias`) — no surface preference, no climb/gradient control, no bicycle-type tuning. Valhalla's costing model exposes exactly the levers Routess needs (`bicycle_type`, `use_hills`, `use_tracks`, `avoid_bad_surfaces`, surface preference, max grade) as per-request inputs, making it the only practical engine that aligns with the **RoutingPreferences** vocabulary Routess wants to offer users.

Stadia first, self-host later. Self-hosting Valhalla in the existing k8s cluster is operationally non-trivial (tile builds are heavy, OSM refresh is recurring, storage cost is meaningful, on-call burden is new). At current volume the per-request Stadia bill is cheaper than self-host compute + ops. The migration trigger is recorded in #171 — revisit when monthly Stadia cost is ≥ 2× the equivalent self-host steady state.

The provider abstraction (see ADR-0022) is deliberately shaped so this swap is configuration only: the Valhalla base URL and auth are env vars, the HTTP wrapper is a single module per app, and the pure costing translator in `@routess/core` doesn't change.

## Considered options

- **Stay on Mapbox Directions** — the only honest path that keeps Mapbox. Forces deletion of the entire `bike` / `climbs` / `unpaved` UI as unimplementable; cycling preference set collapses to "avoid ferries". Rejected because the ticket (#137) is explicitly about *enabling* surface/climb preferences, not retreating from them.
- **OpenRouteService (ORS)** — strong cycling profiles out of the box (`cycling-road`, `cycling-mountain`, `cycling-electric`), surface preferences, avoid features. Rejected because the hosted free tier has tight rate limits and we'd need a paid relationship anyway, and we already have a Stadia (Valhalla) relationship via `trace_attributes`. Re-evaluable later if Valhalla turns out to be poorly tuned in practice.
- **GraphHopper** — fast, mature, custom_model JSON for biases. Rejected because the best features (custom_model) are paywalled to the commercial cloud, and recent license changes have made the project less attractive than Valhalla for the same money.
- **OSRM** — fastest at scale. Rejected: no dynamic per-request preferences (profiles are baked at preprocessing). Dead-end for a route-planning UI built around user-tunable preferences.
- **BRouter** — gold standard for gravel/MTB. Rejected as the primary engine for now: single-maintainer feel, less polished API, not suited to a general consumer app. Could plug in later as an optional power-user provider.
- **Self-host Valhalla from day one** — rejected: premature scaling of operational burden. The (Q11) trigger captures when to revisit.
