# Route API module stays shallow until invariants exist

The Routes API module (`apps/api/src/routes/`) is intentionally a thin CRUD slice over the Route entity. The earlier deepening proposal — pull a "RouteAggregate" with explicit invariant enforcement (min Waypoints, coherent Type sequence, distance/duration coherence checks, etc.) — was dropped because none of those invariants exist in the domain today. DTO-level validation already enforces the shape constraints we have (waypoint count via `@ArrayMinSize(1)/@ArrayMaxSize(100)`, coordinate bounds via the custom `Coordinate` validator, Waypoint Type via `@IsIn(["routed", "direct"])`). Inventing aggregate-level invariants without callers asking for them would be premature, and the resulting "deep" module would just be a wrapper around the same DTO-validated input.

What did get cleaned up: `route.mapper.ts` was inlined into `RoutesService` as a private `toResponseDto` function. Service methods now return `RouteResponseDto` directly; the controller is a 1-line forward. One fewer file, one fewer cross-mapper import (the previous `route.mapper` reaching into `user.mapper` is gone). Repeated `findOne(...{populate:["user"]})` from `update` and `remove` is collapsed into a single private `findOwnedRouteOrFail` helper.

When real invariants appear (e.g., "first Waypoint must be Type=routed", "RouteType=loop requires start === end", "Distance must agree with computed RoutePath"), reopen the deepening: move them into `RoutesService` (or split into a `RouteAggregate` if the invariant logic grows large), with tests that exercise the invariants through the service interface.

## Considered options

- **Pull a RouteAggregate now with placeholder invariants** — rejected: shape-validation invariants live correctly at the DTO layer; duplicating them in the service is busywork that creates maintenance overhead with no behavioural change.
- **Inline the entire service into the controller** — rejected: NestJS conventions and metric emission (currently `recordRouteCreated` / `recordRouteDeleted`) make a service worth its own line. It's thin but earns its existence.
