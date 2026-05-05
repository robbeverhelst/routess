# Routess

Routess is a route-planning product for cyclists, runners, and hikers. Users place waypoints on a map; the system snaps them to the road network (or leaves them as straight-line segments) and produces a navigable route with distance, duration, and elevation metrics. Routes can be hand-drawn, AI-generated from parameters, imported from GPX, saved to a personal library, and exported.

## Language

## Git Convention

- Use Conventional Commit messages for every commit.
- Default format: `type(scope): summary`.
- Prefer `fix(scope): ...` for bug fixes and `feat(scope): ...` for features.
- Keep the scope specific to the area changed.

### Route domain

**Route**:
A planned path made up of an ordered sequence of **Waypoints**, with computed metrics (distance, duration, elevation gain) and an optional **RoutePath**. Owned by a User and persistable to their library.
_Avoid_: track, trip, journey, path (RoutePath is a distinct concept).

**Waypoint**:
A single geographic point (lat/lng) on a Route, with an associated routing **Type** that controls how it connects to the previous waypoint. May carry an optional timestamp.
_Avoid_: point, stop, marker, pin, node.

**Type** (of a Waypoint segment):
Either `routed` (the segment between this waypoint and the previous one snaps to the road network) or `direct` (the segment is a straight line). On the web side this is sometimes carried as a parallel `directFlags: boolean[]` array; the canonical wire-protocol form is `type: "routed" | "direct"`.
_Avoid_: mode, kind. Do not use the bare boolean `isDirect` outside the routing internals.

**RoutePath**:
The ordered sequence of geographic coordinates the system computes by stitching together routed segments (snapped to roads) and direct segments. This is what gets rendered on the map and exported as GPX — distinct from the user-placed Waypoints.
_Avoid_: line, geometry, polyline, track.

**RouteGeneration**:
Algorithmic creation of a Route from high-level parameters (RouteType, SurfaceType, LoopDirection, target distance) instead of hand-placed waypoints.
_Avoid_: AI route, auto route, suggested route.

**RouteType**:
Either `a-to-b` (start ≠ end) or `loop` (start = end). A property of a generated or saved Route.

**SurfaceType**:
Routing preference: `paved`, `mixed`, or `unpaved`. Used by RouteGeneration and routing requests.
_Avoid_: terrain, surface preference.

**LoopDirection**:
For loop routes, either `clockwise` or `counter-clockwise`.

### Metrics

**Distance**:
Total length of a Route's RoutePath, in meters internally. Formatted for display by `formatDistance`.

**Duration**:
Estimated travel time over a Route, in seconds internally. Formatted by `formatDuration`.

**ElevationGain**:
Accumulated vertical ascent in meters along a RoutePath. Distinct from net elevation change.
_Avoid_: climb, ascent, vertical.

**Bearing**:
Compass direction (0–360°) of a Waypoint or segment. Used by GPX import for smart waypoint detection at turns.

### Editing & state

**RouteDraft**:
The in-progress Route currently being edited in the UI — the working state of `routingStore` (waypoints, directFlags, routePath, distance, duration). Saved drafts become Routes.

**HistoryManager**:
The undo/redo stack over RouteDraft mutations. _(Implementation term — included here because the store explicitly models it as a first-class concept.)_

**LocationTracking**:
Live tracking of the user's GPS position on the map. Distinct from waypoints and routes — it is presentational, not part of the Route data model.

### Import / export

**GPX**:
The standard XML format for route exchange. Routess imports GPX files (deriving Waypoints with smart detection at significant Bearing changes) and exports Routes as GPX.

**RouteLibrary**:
The collection of Routes a User has saved. Surfaced in the UI as "My Routes."

### Identity

**User**:
An authenticated person who owns Routes. Authentication is via Google OAuth.
_Avoid_: account, profile (no separate Profile entity exists in the domain).

## Relationships

- A **Route** has one or more **Waypoints** in an ordered list.
- Each **Waypoint** (after the first) has a **Type** describing how its segment connects to the previous one.
- A **Route** has exactly one **RoutePath**, computed from its **Waypoints** and their **Types**.
- A **Route** has computed **Distance**, **Duration**, and **ElevationGain** metrics derived from its **RoutePath**.
- A **RouteGeneration** produces a **Route** from **RouteType** + **SurfaceType** + **LoopDirection** + target distance, without manual Waypoint placement.
- A **User** owns zero or more **Routes**, accessed through their **RouteLibrary**.
- A **RouteDraft** is an unsaved, in-progress **Route** held in `routingStore`.

## Example dialogue

> **Dev:** "When the user clicks the map to add a stop, do we always snap to the road?"
> **Domain expert:** "We don't call them stops — they're **Waypoints**. And whether we snap depends on the **Type**: `routed` snaps to the road network, `direct` draws a straight line. The user toggles that per segment."

> **Dev:** "What's the difference between the **RoutePath** and the **Waypoints**?"
> **Domain expert:** "**Waypoints** are what the user placed; **RoutePath** is what we computed by joining them up. A 5-waypoint route can produce a RoutePath with hundreds of coordinates, because the routed segments follow real roads."

> **Dev:** "Can we just call the AI-generated routes 'auto routes'?"
> **Domain expert:** "Stick with **RouteGeneration**. The output is still a normal **Route** — what's different is how it was made, not what it is."

## Flagged ambiguities

- **`directFlags: boolean[]` vs `type: "routed" | "direct"`** — the routingStore carries direct/routed information as a parallel boolean array, while DTOs and the API use a per-waypoint string `type`. The api-client adapts between the two. Resolved canonical form: **`type`** is the language we speak; `directFlags` is an internal representation. Don't introduce new public APIs that expose the boolean form.
- **"Direct" naming** appears in code as `directFlag`, `isDirect`, `type: "direct"`. In conversation and new code, say **Type = direct**.
- **"Snap"** is implementation jargon for "find the nearest road and adjust the Waypoint to lie on it." Use it for engineering conversation, not for user-facing copy or domain modelling.
- **"Loop"** is a **RouteType** value, not a synonym for "cycle" or "ride". A Route's RouteType is either `a-to-b` or `loop`.
- **"Account" / "Profile"** are not Routess concepts. The domain only has **User**.
