# Routess

Routess is a route-planning product for cyclists, runners, and hikers. Users place waypoints on a map; the system snaps them to the road network (or leaves them as straight-line segments) and produces a navigable route with distance, duration, and elevation metrics. Routes can be hand-drawn, AI-generated from parameters, imported from GPX, saved to a personal library, and exported.

## Route domain

**Route**:
A planned path made up of an ordered sequence of **Waypoints**, with computed metrics (distance, duration, elevation gain) and an optional **RoutePath**. Owned by a User and persistable to their library.
_Avoid_: track, trip, journey, path (RoutePath is a distinct concept).

**Waypoint**:
A single geographic point (lat/lng) on a Route, with an associated routing **Type** that controls how it connects to the previous waypoint. May carry an optional timestamp.
_Avoid_: point, stop, marker, pin, node.

**Type** (of a Waypoint segment):
Either `routed` (the segment between this waypoint and the previous one snaps to the road network) or `direct` (the segment is a straight line). On the web side this is sometimes carried as a parallel `directFlags: boolean[]` array; the canonical wire-protocol form is `type: "routed" | "direct"`.
The Type is user-chosen and the system never silently converts between them. If a `routed` segment can't be snapped to the road network, the offending Waypoint is rejected with an error, not silently downgraded to `direct`.
_Avoid_: mode, kind. Do not use the bare boolean `isDirect` outside the routing internals.

**RoutePath**:
The ordered sequence of geographic coordinates the system computes by stitching together routed segments (snapped to roads) and direct segments. This is what gets rendered on the map and exported as GPX, distinct from the user-placed Waypoints.
_Avoid_: line, geometry, polyline, track.

**RouteGeneration**:
Algorithmic creation of a Route from high-level parameters (RouteType, SurfaceType, LoopDirection, target distance) instead of hand-placed waypoints.
_Avoid_: AI route, auto route, suggested route.

**RouteType**:
Either `a-to-b` (start ≠ end) or `loop` (start = end). A property of a generated or saved Route.

**SurfaceType**:
Routing *preference* (an input): `paved`, `mixed`, or `unpaved`. Used by RouteGeneration and routing requests to bias the chosen RoutePath. Distinct from **SurfaceBucket**. `mixed` is *permissive*: a route that is 100% paved still satisfies a `mixed` preference. The match between a SurfaceBucket and a SurfaceType is defined by the pure predicate `bucketMatchesPreference(bucket, pref)` in `@routess/core`.
_Avoid_: terrain, surface preference.

**SurfaceBucket**:
Per-segment *classification* (an observation): `paved`, `compacted`, `unpaved`, or `path`. The result of analysing the actual RoutePath's edges (via Valhalla `trace_attributes`). Used to render surface composition along the route. Distinct from **SurfaceType** (which is what the user asked for, not what the route turned out to be).
_Avoid_: surface, surface kind.

**LoopDirection**:
For loop routes, either `clockwise` or `counter-clockwise`.

**RouteVisibility**:
Who can view a Route. One of `private`, `unlisted`, or `public`.
- `private`: owner-only; non-owners get 404.
- `unlisted`: viewable by anyone with the URL; never appears in listings, search, or feeds; not indexable.
- `public`: viewable by anyone with the URL _and_ eligible for future discovery surfaces (listings, search, feeds).
The URL is the capability: changing visibility takes immediate effect for everyone, there is no separable share-token to rotate.
A `public` or `unlisted` Route has a public route page at `/r/{slug}-{id}`. The canonical shareable URL lives on the landing host (`routess.com`/`routess.be`), server-rendered for link previews and search; the same path on the app origin is the interactive in-app view. Both surfaces share the URL contract and slug logic verbatim. See ADR 0025.
_Avoid_: privacy, sharing, share level, access level.

**Tag**:
A short free-form lowercase keyword attached to a Route, used to organise and filter the RouteLibrary. Each Tag matches `[a-z0-9][a-z0-9-]{0,23}` (1 to 24 characters, lowercase alphanumeric plus hyphen, must start with a letter or digit). A Route has zero to 10 Tags. Tags are owned per Route and never shared as standalone entities. Surfaced in the library filter row and in the route detail meta editor.
_Avoid_: label, category, group, folder, collection (no folder/collection hierarchy exists in the domain).

## Metrics

**Distance**:
Total length of a Route's RoutePath, in meters internally. Formatted for display by `formatDistance`.

**Duration**:
Estimated travel time over a Route, in seconds internally. Formatted by `formatDuration`.

**ElevationGain**:
Accumulated vertical ascent in meters along a RoutePath. Distinct from net elevation change.
_Avoid_: climb, ascent, vertical.

**Bearing**:
Compass direction (0 to 360°) of a Waypoint or segment. Used by GPX import for smart waypoint detection at turns.

## Editing & state

**RouteDraft**:
A Route-in-progress: a document holding waypoints, per-waypoint Type, RoutePath, Distance, Duration, ElevationGain, an activity, and **routingPreferences**. In the web app, the RouteDraft is the working state of `routingStore`; for CLI and agent clients it is the same shape passed over the wire to `/v1/draft/recalc` and `/v1/draft/save`. A RouteDraft has a **mode**: `unsaved` (composing fresh; on save becomes a new Route) or `editing(routeId, baseline)` (bound to a saved Route; carries a snapshot of the saved fields and on save PATCHes that Route). The current **activity** is a property of the RouteDraft; the global activity setting is just a default applied when starting a new draft, never overwritten by loading a Route. The same rule applies to **routingPreferences**: per-Activity user defaults are copied onto the draft at creation; from then on they travel with the draft and are persisted on save. A RouteDraft is never persisted on the server side; it lives only in the client that holds it (browser store, CLI invocation, agent context).

**RoutingPreferences**:
The bundle of inputs that shape how a Route is computed: **SurfaceType**, `avoidFerries`, `avoidHighways` (`avoidHighways` only affects routing for cycle activities). Lives on the **RouteDraft** and on the saved **Route**, never on the User (the User holds *defaults* keyed by **Activity**). Translated to provider-specific costing at the edge by the pure function `valhallaCostingFromPreferences(activity, prefs)` in `@routess/core`. The set is deliberately small and opinionated; provider-specific knobs (`use_tracks`, `walkway_factor`, `use_hills`, etc.) do not appear in this vocabulary.
_Avoid_: routing profile, routing mode, routing options, route settings.

**Provenance**:
How a Route came to exist: `valhalla` (computed by the current routing engine), `mapbox-legacy` (computed by the pre-Valhalla engine; has no **RoutingPreferences**), `gpx-import` (no inputs, geometry came from a file), `generation` (produced by a **RouteGeneration**). Immutable after creation. Determines whether "recalculate" is available and whether the Route's **RoutingPreferences** are meaningful.
_Avoid_: source, origin, type (Type is already taken by Waypoint).

**HistoryManager**:
The undo/redo stack over RouteDraft mutations. _(Implementation term, included here because the store explicitly models it as a first-class concept.)_

**LocationTracking**:
Live tracking of the user's GPS position on the map. Distinct from waypoints and routes, it is presentational, not part of the Route data model.

## Import / export

**GPX**:
The standard XML format for route exchange. Routess imports GPX files (deriving Waypoints with smart detection at significant Bearing changes) and exports Routes as GPX.

**RouteLibrary**:
The collection of Routes a User has saved. Surfaced in the UI as "My Routes."

## Identity

**User**:
An authenticated person who owns Routes. Authentication is via Google OAuth. Carries a `role` of either `user` or `admin`.
_Avoid_: account, profile (no separate Profile entity exists in the domain).

**Admin**:
A User with `role = 'admin'`, authorised to view aggregate user/route data and perform destructive actions (revoke session, soft-delete user) via the admin API. Admin status is reconciled from the `ADMIN_EMAILS` env var on every login; the env var is the source of truth, the DB column is a cache.
_Avoid_: superuser, staff, operator, root.

**UserAuthMethod**:
A way a User can prove their identity. A User has one or more, each with a `provider` (`google` or `email`) and provider-specific data. Email is the identity key across providers; signing up with an email already in use is rejected. Adding a password to a Google-authenticated User happens from settings while signed in (OAuth already proves email control); fresh email+password signups require email verification before the password becomes active.
_Avoid_: credential, login, identity provider link.

**Session**:
An authenticated User's active login on a specific device, identified by a JWT `jti` and tracked server-side with `userAgent`, `ipAddress`, `lastActivity`, and `expiresAt`. A User can hold multiple Sessions across devices and list/revoke them from settings. Password reset and self-initiated account deletion revoke all Sessions; "logout everywhere" revokes all including the current one.
_Avoid_: token, login, device.

**PersonalAccessToken** (PAT):
A long-lived bearer credential a User mints for non-browser clients (the `routess` CLI, AI agents, scripts). Carries one of two scopes: `read` (list/get Routes, export GPX, get profile) or `write` (`read` plus metadata-only mutations on own Routes and own preferences). Presented as `Authorization: Bearer routess_pat_<random>`. Never valid against `/api/v1/admin/*` and cannot delete the User account regardless of the owner's role. Subject to a separate per-token rate-limit bucket so a runaway agent does not block the User's interactive session. Stored hashed with argon2id; the plaintext is shown to the User exactly once at creation.
_Avoid_: API key, access token, bearer token (the term is **PAT** when discussing the domain shape; "Bearer token" is the HTTP transport detail).

## Relationships

- A **Route** has one or more **Waypoints** in an ordered list.
- Each **Waypoint** (after the first) has a **Type** describing how its segment connects to the previous one.
- A **Route** has exactly one **RoutePath**, computed from its **Waypoints** and their **Types**.
- A **Route** has computed **Distance**, **Duration**, and **ElevationGain** metrics derived from its **RoutePath**.
- A **RouteGeneration** produces a **Route** from **RouteType** + **SurfaceType** + **LoopDirection** + target distance, without manual Waypoint placement.
- A **Route** has exactly one **RouteVisibility** (`private` | `unlisted` | `public`), defaulting from the owning User's preference.
- A **Route** has zero or more **Tags**; Tags are flat (no hierarchy, no folder grouping).
- A **User** owns zero or more **Routes**, accessed through their **RouteLibrary**.
- A **User** holds **RoutingPreferences defaults** keyed by **Activity** (`cycle`, `run`, `walk`); these are *copied* onto a new **RouteDraft** at creation, never read again for that draft.
- A **Route** has its own **RoutingPreferences** (which produced its RoutePath) and a **Provenance** (how it was made). Both are immutable inputs to the Route; `Provenance` never changes after creation.
- A **RouteDraft** is an in-progress **Route** held in `routingStore`. Its mode is either `unsaved` (will become a new Route on save) or `editing(routeId)` (bound to a saved Route, will PATCH it on save).
- An **Admin** is a **User** with elevated access; admin status is derived from the `ADMIN_EMAILS` env var at login time, not granted in-app.

## Example dialogue

> **Dev:** "When the user clicks the map to add a stop, do we always snap to the road?"
> **Domain expert:** "We don't call them stops, they're **Waypoints**. And whether we snap depends on the **Type**: `routed` snaps to the road network, `direct` draws a straight line. The user toggles that per segment."

> **Dev:** "What's the difference between the **RoutePath** and the **Waypoints**?"
> **Domain expert:** "**Waypoints** are what the user placed; **RoutePath** is what we computed by joining them up. A 5-waypoint route can produce a RoutePath with hundreds of coordinates, because the routed segments follow real roads."

> **Dev:** "Can we just call the AI-generated routes 'auto routes'?"
> **Domain expert:** "Stick with **RouteGeneration**. The output is still a normal **Route**, what's different is how it was made, not what it is."

## Flagged ambiguities

- **`directFlags: boolean[]` vs `type: "routed" | "direct"`**: the routingStore carries direct/routed information as a parallel boolean array, while DTOs and the API use a per-waypoint string `type`. The api-client adapts between the two. Resolved canonical form: **`type`** is the language we speak; `directFlags` is an internal representation. Don't introduce new public APIs that expose the boolean form.
- **"Direct" naming** appears in code as `directFlag`, `isDirect`, `type: "direct"`. In conversation and new code, say **Type = direct**.
- **"Snap"** is implementation jargon for "find the nearest road and adjust the Waypoint to lie on it." Use it for engineering conversation, not for user-facing copy or domain modelling.
- **"Loop"** is a **RouteType** value, not a synonym for "cycle" or "ride". A Route's RouteType is either `a-to-b` or `loop`.
- **"Account" / "Profile"** are not Routess concepts. The domain only has **User**.
- **"Surface"** is overloaded: **SurfaceType** is a routing *preference* (3 values, an input), **SurfaceBucket** is a per-segment *classification* (4 values, an observation on the resulting RoutePath). Don't conflate them; in conversation, name the specific term.
- **"Profile" / "routing profile" / "routing mode"**: the legacy `routingPreferencesStore.profile` field (`fast | scenic | safe | flat`) is being retired with the Valhalla migration (#137). These are not domain terms and should not appear in new code or user-facing copy. The replacement is **RoutingPreferences** (a structured object), not a single enum. "Mode" remains on the avoid list (it collides with Waypoint **Type**).
- **"Profile" in provider terms** (e.g. Mapbox's `cycling` / `walking` / `driving` profile, or Valhalla's `bicycle` / `pedestrian` costing) is an *implementation detail* derived from **Activity**, not a domain concept the user picks directly.
- **"Metric" / "analytics"** are overloaded across four distinct uses. The **Metrics** section above defines _route metrics_, properties of a Route (Distance, Duration, ElevationGain). Separately the API exposes _operational metrics_ (HTTP request rate, route-generation latency, event loop lag) via Prometheus at `/metrics`. _ProductEvents_ are behavioural events (a user did X at moment T) sent to self-hosted Umami; they are the raw stream from which funnels and retention are derived. The admin API surfaces _business analytics_ (signup counts, top creators, retention) computed from Postgres aggregate queries, **not** from Umami — Postgres is authoritative for per-entity KPIs. In ambiguous conversations, qualify: **route metric**, **operational metric**, **ProductEvent**, or **business analytic**.

## Product analytics

**ProductEvent**:
A behavioural event fired when a user takes an action — `route_created`, `gpx_imported`, `route_share_link_copied`, etc. Sent to self-hosted Umami via `track()` (web) or a server-side `ProductEventListener` (API, only for webhook-driven or async-completion events that have no synchronous UI moment). Distinct from operational metrics (Prometheus, system health) and business analytics (Postgres aggregates rendered in admin UI). Naming convention: `<object>_<verb_past>` in snake_case. Authenticated events carry a `user_id_hash` (server-salted SHA-256 of the Routess user ID) — never the raw `user_id`, never email or route name. See `docs/agents/product-events.md` for the canonical taxonomy.
_Avoid_: tracking event, analytics event, telemetry event, Umami event (use ProductEvent when discussing the domain shape; "Umami" is the implementation detail).
