# Uniform Waypoint snap policy, no silent Type downgrade

Every `routed` Waypoint goes through the same snap pipeline regardless of position in the sequence: `checkNearRoad` at 49 m for a fast pre-snap, then a Mapbox Directions call at 150 m as fallback, then a clear rollback-with-error if both fail. The first Waypoint has no special-case path. The Mapbox Directions response is the canonical snap source for routes; `checkNearRoad` is a latency optimisation, not an authority.

The routing engine never silently rewrites a Waypoint's Type. If a `routed` segment can't be snapped to the road network, `computeRoute` returns `ok: false` and the editor rolls back the offending Waypoint with a "point too far from any road" error. The previous mixed-mode fallback that silently flipped `routed → direct` on segment failure is gone — the user picks the Type, the engine respects it.

ElevationGain staleness is judged against `routePath`, not `waypoints`. Snapping rewrites Waypoints in the store after `getRoute` returns, but the route geometry the elevation was sampled for hasn't changed; comparing against waypoints (the old check) caused the result to be discarded as stale on every snap, which manifested as "elevation gain sometimes updates."

## Considered options

- **Keep the first-Waypoint special case (49 m hard reject) and the per-segment auto-direct fallback** — the prior state. Rejected: the asymmetry was not a designed trade-off, just two code paths that grew separately. Users hit it as "the first waypoint needs to be way closer to a road than the others." The auto-direct fallback was its own bug class — users who picked `routed` saw silent straight-line segments with no indication that snapping had failed.
- **Auto-downgrade `routed → direct` on snap failure (no rejection at all)** — considered and rejected mid-design. Lenient but wrong: a click in the ocean would silently produce a 500 km direct segment. The user picked the Type for a reason; the engine doesn't get to silently reinterpret it.
- **Move all snapping to Directions (drop `checkNearRoad`)** — rejected for now: `checkNearRoad` is a 49 m latency optimisation that gives the dragging UX immediate feedback before the next Directions call lands. Removing it would slow the visible snap on every Waypoint add. Worth revisiting if/when Directions latency drops or batched calls become available.
- **Compare elevation staleness against waypoint identity instead of routePath** — rejected: waypoints can be rewritten by the snap-writeback after `getRoute` has already kicked off elevation sampling for the (correct) routePath. RoutePath is the actual input the elevation was computed for; that's the right invariant to guard.
