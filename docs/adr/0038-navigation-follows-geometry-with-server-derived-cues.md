# Navigation follows geometry with server-derived cues

A NavigationSession consumes a route's stored RoutePath geometry, never its Waypoints, so saved Routes, RouteDrafts, ExternalRoutes, and imports are all navigable through one pipeline. Guidance comes from a new `POST /v1/routing/cues` endpoint (anonymous, throttled like the other routing endpoints) that map-matches the geometry through Valhalla `trace_route` for street-level ManeuverCues and decorates it with NodeNetwork passages for NodeCues ("at node 47, head toward 52", prior art ADR 0037); stretches that fail to match get a synthesized "follow the path" Cue. Cue anchors are projected onto the stored RoutePath, which stays canonical: the client never sees Valhalla's matched shape, so the nav screen, route page, offline cache, and GPX export always agree. Cues are cached per ADR 0032 (keyed by geometry hash + activity + locale) and never persisted: they are derivable, locale-dependent, and invalidated by every Valhalla tile update. "Rerouting" means Rejoin, a routed connector to the nearest not-yet-ridden point of the remaining RoutePath, never a re-plan to the destination, because the planned route is the product (a scenic loop re-planned "to its destination" collapses to zero). The session brain is a pure reducer in `@routess/core` (`(SessionState, PositionFix) → (SessionState, Effect[])`); the web app owns the dirty edges (geolocation, Web Speech, API calls). The trade-offs we accept: nav start and Rejoin require connectivity (ADR 0034 makes the engine unreachable from the browser; offline off-route degrades to a bearing-and-distance indicator), and map-matching is flakier than routing from Waypoints would have been.

## Considered options

- **Geometry-based engine with server map-matched cues** (chosen): one pipeline covers the seeded ExternalRoute library, which exists precisely so people ride those routes; rich localized narratives (en/nl/fr/de) come from Valhalla for free; node decoration fails safe (degrades to ordinary turn-by-turn, never silence).
- **Waypoint-based navigation** — rejected: permanently excludes ExternalRoutes and imports (no Waypoints), recreating the "plan here, navigate in Komoot" gap the epic exists to close.
- **Client-side turn detection from polyline bearings** — rejected as the primary engine: no street names, no roundabout semantics, no node phrasing, and a hand-rolled turn detector is an edge-case pit. Survives only as the "follow the path" fallback for unmatched stretches.
- **Re-plan-to-destination rerouting** — rejected: Google Maps semantics answer "fastest way home", which discards the loop or detour the user deliberately planned.
- **Persisting cues in the database** — rejected: a cache is the right home for derived, locale-keyed, engine-version-dependent data.

## Consequences

- Positive: every navigable surface (library, Discover, seeded routes, drafts) shares one engine; cue responses for immutable ExternalRoutes cache extremely well; the pure reducer makes the epic's mandated tests (cue progression, off-route threshold, Rejoin lifecycle, fake position source) plain function calls; a future native wrapper reuses the session brain untouched.
- Negative: starting navigation on a never-opened route requires connectivity; Rejoin is online-only; map-matching can misfire on off-network geometry (towpaths, sloppy imports).
- Follow-ups: NavigationSession is screen-on only (Wake Lock + explicit UI messaging) until the epic's native-wrapper hedge is ever exercised; arrival is progress-gated (≥ ~95% distance-along-route AND near path end) because on a loop the endpoint is the start; no pause state until recording (phase 4) gives it meaning.

## References

- Epic #248 (close the competitive gap), user stories 16–18 (turn-by-turn, node phrasing, rerouting).
- ADR 0034 (centralize routing in the API), ADR 0032 (layered caching), ADR 0033 (node tiles), ADR 0037 (server-side node-tile reads), ADR 0028 (touch grammar; the map is read-only during a session).
- CONTEXT.md "Navigation" section: NavigationSession, Cue (ManeuverCue/NodeCue), Rejoin.
