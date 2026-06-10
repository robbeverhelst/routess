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
Algorithmic creation of a Route from high-level parameters (RouteType, SurfaceType, Heading, target distance) instead of hand-placed waypoints. Runs as a staged pipeline (anchors → candidates → routing → scoring → selection) on the server and returns up to 3 diverse **GenerationCandidates**; confirming one yields a RouteDraft with Provenance `generation`. v1 generates loops only. See ADR 0029.
_Avoid_: AI route, auto route, suggested route.

**GenerationCandidate**:
One scored loop produced by a RouteGeneration attempt: geometry, via points, Distance, ElevationGain, surface composition, and score components (**Overlap**, distance match, surface fit, shape compactness). Candidates shown to the user are mutually diverse (near-identical shapes are deduped, the issue's "duplicate avoidance"). Mediocre candidates are shown with their flaw labeled; unusable ones are dropped behind a quality floor. A GenerationCandidate is not a Route: it becomes one only after the user confirms and saves it.
_Avoid_: suggestion, alternative, option, variant.

**Overlap** (of a GenerationCandidate):
The fraction of a candidate's Distance that traverses the same underlying way more than once (measured via duplicated Valhalla `way_id`s, length-weighted). The primary quality signal: a pure out-and-back has ~100% Overlap, a clean loop near 0%. Drives the heaviest scoring weight and the quality floor.
_Avoid_: out-and-back ratio, repetition, backtracking (in code; UI copy may say "repeated roads").

**RouteType**:
Either `a-to-b` (start ≠ end) or `loop` (start = end). A property of a generated or saved Route.

**SurfaceType**:
Routing *preference* (an input): `paved`, `mixed`, or `unpaved`. Used by RouteGeneration and routing requests to bias the chosen RoutePath. Distinct from **SurfaceBucket**. `mixed` is *permissive*: a route that is 100% paved still satisfies a `mixed` preference. The match between a SurfaceBucket and a SurfaceType is defined by the pure predicate `bucketMatchesPreference(bucket, pref)` in `@routess/core`.
_Avoid_: terrain, surface preference.

**SurfaceBucket**:
Per-segment *classification* (an observation): `paved`, `compacted`, `unpaved`, or `path`. The result of analysing the actual RoutePath's edges (via Valhalla `trace_attributes`). Used to render surface composition along the route. Distinct from **SurfaceType** (which is what the user asked for, not what the route turned out to be).
_Avoid_: surface, surface kind.

**Heading**:
For RouteGeneration, the compass arc the loop should extend toward: `any`, `north`, `east`, `south`, or `west`. Constrains which bearings candidate generation tries; a soft preference, never a hard guarantee. Replaces the retired `LoopDirection` (`clockwise`/`counter-clockwise`), which was never implemented and described traversal order, not loop placement.
_Avoid_: direction (too overloaded), LoopDirection, orientation.

**RouteVisibility**:
Who can view a Route. One of `private`, `unlisted`, or `public`.
- `private`: owner-only; non-owners get 404.
- `unlisted`: viewable by anyone with the URL; never appears in listings, search, or feeds; not indexable.
- `public`: viewable by anyone with the URL _and_ eligible for future discovery surfaces (listings, search, feeds).
The URL is the capability: changing visibility takes immediate effect at the API origin, there is no separable share-token to rotate. Cached public surfaces may lag a restriction within the **VisibilityPropagation** bound.
A `public` or `unlisted` Route has a public route page at `/r/{slug}-{id}`. The canonical shareable URL lives on the landing host (`routess.com`/`routess.be`), server-rendered for link previews and search; the same path on the app origin is the interactive in-app view. Both surfaces share the URL contract and slug logic verbatim. See ADR 0025.
_Avoid_: privacy, sharing, share level, access level.

**VisibilityPropagation**:
The bounded window (at most 60 seconds) during which a cached public surface (edge-cached Discover responses, server-rendered public route and profile pages) may still serve a Route whose **RouteVisibility** was just restricted. The API origin is always authoritative: it reflects a visibility change immediately, only read-through caches lag. No cache over visibility-governed data may hold a response longer than this bound. Authenticated per-User views (Feed, Notifications, inbox) are never cached and keep instant semantics.
_Avoid_: eventual consistency (too vague), cache delay, staleness window.

**Tag**:
A short free-form lowercase keyword attached to a Route, used to organise and filter the RouteLibrary. Each Tag matches `[a-z0-9][a-z0-9-]{0,23}` (1 to 24 characters, lowercase alphanumeric plus hyphen, must start with a letter or digit). A Route has zero to 10 Tags. Tags are owned per Route and never shared as standalone entities. Surfaced in the library filter row and in the route detail meta editor.
_Avoid_: label, category, group, folder. A Tag is not a **Collection**: Tags are flat, cross-cutting, per-Route filter keywords; a Collection is a curated, ordered, shareable set of Routes. See ADR 0026.

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

## Map overlays

**NodeNetwork** (knooppuntennetwerk):
A wayfinding system of numbered junctions connected by signed segments, used across Belgium and the Netherlands: cyclists and walkers plan by stringing together junction numbers ("42 → 7 → 13"). Routess shows it as an optional, display-only map overlay in two independent kinds, **hiking** (walking) nodes and **cycling** nodes, each toggled separately. A single junction is a **Node** carrying a `ref` (its number); a **Connection** is the segment linking two adjacent Nodes (`fromRef`, `toRef`). The source is OpenStreetMap (`rwn_ref`/`lwn_ref` walking, `rcn_ref`/`lcn_ref` cycling, `network:type=node_network`), ODbL-licensed, slowly-changing, and self-hosted as pre-built vector tiles rather than fetched live (see ADR 0033). The overlay never affects routing or a saved Route; it is purely a reference layer the user can read off the map.
_Avoid_: knooppunt for the whole network (a knooppunt is one **Node**), junction network (too generic), POI layer (Nodes are not points of interest). Distinct from a **RoutePath**: a NodeNetwork is fixed public infrastructure, not a user's route.

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
The set of Routes a User has saved. Surfaced in the UI as the library panel's "Routes" tab.

**Collection**:
A curated, manually ordered set of Routes within a User's RouteLibrary (e.g. "Alps 2026", "Commutes"). Routes and Collections are many-to-many: a Route can live in any number of Collections, and removing it from a Collection never deletes the Route. A Collection has its own **RouteVisibility** with the same semantics as a Route's; sharing a Collection by URL never exposes `private` Routes inside it to non-owners.
_Avoid_: folder, playlist, group, list.

**Favourite**:
A per-Route boolean the owner toggles to pin a Route for quick retrieval. Stored on the Route entity (server-side, syncs across devices), surfaced as a heart toggle and a library filter. Not a Collection; favouriting is a flag, not membership.
_Avoid_: like, star, bookmark.

## Identity

**User**:
An authenticated person who owns Routes. Authentication is via Google OAuth. Carries a `role` of either `user` or `admin`.
_Avoid_: account. A User is not a **Profile**: the User is the private auth identity (email, sessions, role); the Profile is its public projection.

**Profile**:
The public, viewable projection of a User: **Handle**, display name, avatar, public Routes, and derived stats. Every User has exactly one Profile; it is not a separable entity a User creates or deletes independently. What a Profile exposes is governed by RouteVisibility — a Profile never reveals `private` or `unlisted` Routes. Stats (public Route count, total Distance, total ElevationGain, follower/following counts) are computed over `public` Routes only: nothing a stranger couldn't derive from the visible list. Follower *counts* are public; follower *lists* are visible to the owner only. A Profile has a public page at `/u/{handle}` following the same dual-surface pattern as route pages (ADR 0025): canonical server-rendered page on the landing host, interactive twin on the app origin.
_Avoid_: account, user page, creator page. Never use "profile" for the User's own settings area or for routing profiles (see flagged ambiguities).

**Handle**:
A unique, URL-safe identifier for a Profile (e.g. `/u/robbe`). Matches `[a-z0-9][a-z0-9-]{2,29}` (3 to 30 characters, lowercase alphanumeric plus hyphen, must start with a letter or digit). Auto-generated at signup (and backfilled for existing Users) by slugifying the display name, with a numeric suffix on collision; **never derived from email** (emails are PII, Handles are public) — fallback is `user-<short-random>`. Changeable in settings: old URLs plainly 404 (no redirects, no handle history) and a freed Handle returns to the pool. A reserved-words list (`admin`, `routess`, `api`, `settings`, public path segments, …) can never be claimed. User IDs never appear in public URLs.
_Avoid_: username (that suggests a login credential — login stays email-based), slug, alias.

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

## Social

**Follow**:
An asymmetric subscription from a User to another User's **Profile**. No approval step; the followed party is notified but cannot pre-approve. A Follow grants *no access*: it only determines what fills the follower's feed and notifications. **RouteVisibility remains the only access-control concept in the domain** — a follower sees exactly what any stranger with the same URLs would see. Deliberate person-to-person sharing of non-public Routes is the inbox's job, never the graph's.
_Avoid_: friend, connection, subscribe (in user-facing copy the verb is "follow").

**RouteShare**:
A deliberate, person-to-person delivery of a Route from a sender User to a recipient User, landing in the recipient's inbox. Records sender, recipient, the Route, an optional message, and read state. A RouteShare can only carry an `unlisted` or `public` Route; sharing a `private` Route prompts the owner to make it `unlisted` first. It never grants access by itself — **RouteVisibility stays the only access-control concept**, so flipping the Route back to `private` instantly 404s it for the recipient too. The inbox entry is a live reference, not a copy; a separate "save a copy" action clones the Route into the recipient's library as a Route they own. The copy keeps the original's **Provenance** (provenance describes how the geometry was made, not how it arrived) and records lineage via `copiedFrom` (source Route and User).
Receiving a RouteShare notifies the recipient: one transactional email (rate-limited per sender→recipient pair, user-level opt-out) plus an in-app unread badge. A new Follow surfaces in-app only; Feed publishes never notify — the Feed is the notification surface.
_Avoid_: share (bare noun — too overloaded with share-URL/share link), send, forward.

**Feed**:
A derived view, not an entity: the `public` Routes of the Profiles a User Follows, ordered by **PublishedAt** descending. Computed per read (one query over the follows join); nothing is stored per follower, so a Route flipped back to `private` vanishes from every Feed instantly. v1 has exactly one event type — a followed Profile published a public Route. RouteShares never appear in the Feed; they land in the inbox.
_Avoid_: timeline, stream, FeedItem (there is no stored item).

**PublishedAt** (of a Route):
Timestamp set the *first* time a Route transitions to `public`, never bumped afterward. Re-publishing a previously-public Route restores it to Feeds at its original position rather than the top, so visibility-toggling cannot spam followers.
_Avoid_: createdAt (a Route is usually born `private`; creation and publication are different moments).

**Notification**:
A derived view, not an entity (same pattern as Feed and Discover): the union of social events that happened to a User, ordered by createdAt descending. v1 has exactly two item kinds: a new **Follow** of the User's Profile, and a **RouteShare** the User received. Nothing is stored per notification, so an unfollow or a dismissed RouteShare removes its item instantly. A Notification is a pointer, never an action surface: a follow item leads to the follower's Profile, a RouteShare item leads to the inbox, where read state and actions (save copy, mark read, dismiss) live. Re-following after an unfollow re-notifies; accepted for v1, the blast radius is one person's badge, unlike the Feed-wide spam PublishedAt guards against.
_Avoid_: alert, activity item, inbox item (the inbox is the RouteShare surface, not the notification surface).

**NotificationsSeenAt** (of a User):
A single timestamp watermark on the User. Notification items newer than it are "unseen" and count toward the bell badge; opening the NotificationCenter bumps the watermark to now. **Seen** is bell-level (the User observed that something happened) and is distinct from **read**, which is inbox-level per RouteShare (`readAt`); bumping the watermark never touches `readAt`.
_Avoid_: lastRead, readAt (taken by RouteShare).

## Relationships

- A **Route** has one or more **Waypoints** in an ordered list.
- Each **Waypoint** (after the first) has a **Type** describing how its segment connects to the previous one.
- A **Route** has exactly one **RoutePath**, computed from its **Waypoints** and their **Types**.
- A **Route** has computed **Distance**, **Duration**, and **ElevationGain** metrics derived from its **RoutePath**.
- A **RouteGeneration** produces up to 3 **GenerationCandidates** from **RouteType** + **SurfaceType** + **Heading** + target distance, without manual Waypoint placement; confirming one creates a **RouteDraft** whose **Waypoints** are the candidate's via points (so recalculation reproduces the same RoutePath).
- A **Route** has exactly one **RouteVisibility** (`private` | `unlisted` | `public`), defaulting from the owning User's preference.
- A **Route** has zero or more **Tags**; Tags are flat (no hierarchy, no folder grouping).
- A **User** owns zero or more **Routes**, accessed through their **RouteLibrary**.
- A **User** owns zero or more **Collections**; each **Collection** holds an ordered set of that User's **Routes** (many-to-many, order is per-Collection).
- A **User** has exactly one **Profile**, addressed by a unique **Handle**; the Profile only ever exposes `public` Routes.
- A **User** **Follows** zero or more **Profiles** (asymmetric, no approval); a Follow never grants access beyond what **RouteVisibility** allows.
- A **RouteShare** delivers exactly one (`unlisted` | `public`) **Route** from one **User** to another; it grants no access of its own.
- A copied **Route** keeps its source's **Provenance** and records lineage via `copiedFrom`.
- A **Collection** has exactly one **RouteVisibility**; non-owners viewing a shared Collection never see its `private` Routes.
- A **User** holds **RoutingPreferences defaults** keyed by **Activity** (`cycle`, `run`, `walk`); these are *copied* onto a new **RouteDraft** at creation, never read again for that draft.
- A **Route** has its own **RoutingPreferences** (which produced its RoutePath) and a **Provenance** (how it was made). Both are immutable inputs to the Route; `Provenance` never changes after creation.
- A **RouteDraft** is an in-progress **Route** held in `routingStore`. Its mode is either `unsaved` (will become a new Route on save) or `editing(routeId)` (bound to a saved Route, will PATCH it on save).
- An **Admin** is a **User** with elevated access; admin status is derived from the `ADMIN_EMAILS` env var at login time, not granted in-app.
- A **Route** has at most one **Place** (city + region + country), derived from its **RoutePath** start, never user-edited. **Discover** and **RegionalHub** query Routes through it.
- A **User** has one **NotificationsSeenAt** watermark; their **Notification** list is derived per read from Follows of them and RouteShares to them, never stored.

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
- **"Account"** is not a Routess concept. **Profile** _is_ one (since social v1): the public projection of a User. Use "Profile" only in that sense — never for the settings area, never for routing profiles. The carve-out mirrors "pin": *user-facing copy* may say "account" for the auth identity ("create an account", "delete account", per ADR 0017's own title), but *engineering identifiers* (components, events, state values, new i18n key prefixes) name that surface "user settings" (`UserSettingsScreen`, `routess:open-user-settings`), never "account". The legacy `account.*` i18n key prefix is grandfathered for existing auth-identity copy; don't extend it.
- **"Pin" in marketing copy**: the avoid-list above governs engineering, in-app UI, and domain conversation. Marketing copy on the public landing page may use "pin" as a verb-phrase ("pin it", "drop pins") because in that register it's a universally-understood action verb, not a name for the **Waypoint** entity. The carve-out is verb-only: copy must still not refer to a Waypoint as a "pin" (noun). If "the API returns pins" or "the user has 5 pins saved" appears anywhere, that's a leak — fix it.
- **"Surface"** is overloaded: **SurfaceType** is a routing *preference* (3 values, an input), **SurfaceBucket** is a per-segment *classification* (4 values, an observation on the resulting RoutePath). Don't conflate them; in conversation, name the specific term.
- **"Profile" / "routing profile" / "routing mode"**: the legacy `routingPreferencesStore.profile` field (`fast | scenic | safe | flat`) is being retired with the Valhalla migration (#137). These are not domain terms and should not appear in new code or user-facing copy. The replacement is **RoutingPreferences** (a structured object), not a single enum. "Mode" remains on the avoid list (it collides with Waypoint **Type**).
- **"Profile" in provider terms** (e.g. Mapbox's `cycling` / `walking` / `driving` profile, or Valhalla's `bicycle` / `pedestrian` costing) is an *implementation detail* derived from **Activity**, not a domain concept the user picks directly.
- **"Seen" vs "read"**: two unrelated states that sound alike. *Seen* belongs to the **NotificationsSeenAt** watermark (bell badge, all-or-nothing, bumped on opening the NotificationCenter). *Read* belongs to an individual **RouteShare** (`readAt`, toggled per item in the inbox). Marking notifications seen never marks shares read, and vice versa. Don't introduce a per-notification read state; there are no stored notifications to put it on.
- **"Metric" / "analytics"** are overloaded across four distinct uses. The **Metrics** section above defines _route metrics_, properties of a Route (Distance, Duration, ElevationGain). Separately the API exposes _operational metrics_ (HTTP request rate, route-generation latency, event loop lag) via Prometheus at `/metrics`. _ProductEvents_ are behavioural events (a user did X at moment T) sent to self-hosted Umami; they are the raw stream from which funnels and retention are derived. The admin API surfaces _business analytics_ (signup counts, top creators, retention) computed from Postgres aggregate queries, **not** from Umami — Postgres is authoritative for per-entity KPIs. In ambiguous conversations, qualify: **route metric**, **operational metric**, **ProductEvent**, or **business analytic**.

## Public discovery

**Indexable** (of a Route):
A derived property: a `public` Route is Indexable when it clears the quality gate (has a real name, meets a minimum length, and carries a description or tags). Only Indexable Routes appear in sitemaps and are eligible for search-engine indexing; public Routes below the bar still render but carry `noindex`. `unlisted` Routes are never Indexable regardless of quality (the URL is the capability). The gate may loosen over time; tightening after indexing is costly, so it starts strict.
The property extends to **Profiles**: a Profile is Indexable when it has at least 3 Indexable Routes; below that its page renders but carries `noindex` and stays out of sitemaps (thin-content rule, same spirit as the RegionalHub threshold).
_Avoid_: published, listed, searchable.

**RegionalHub**:
A curated landing page per (activity, place) pair, e.g. "fietsroutes in Gent", listing that place's Indexable Routes with local context. Lives on the landing hosts with the keyword-in-URL localized per ccTLD (`routess.be/fietsroutes/gent`, `routess.com/cycling-routes/ghent`, hreflang-paired). A RegionalHub exists only once its place has at least 5 Indexable Routes; below that threshold the page must not exist (thin-content rule).
_Avoid_: city page, SEO page, directory.

**Place** (of a Route):
The locality a Route belongs to: city, region, and country code (e.g. "Gent, Oost-Vlaanderen, BE"), derived by reverse-geocoding the RoutePath's start coordinate when a Route is saved or its start moves. Derivation is asynchronous and fail-open: a Route can briefly exist without a Place; the idempotent backfill command fills gaps and doubles as the retry path. Stored in the local language as the geocoder returns it. Place feeds the RegionalHub query and Discover's place labels; it is never user-editable.
_Avoid_: location, area, geotag. "City" and "region" name the components, not the concept.

**Discover**:
The in-app browsing surface over `public` Routes: all public Routes whose bounding box intersects the current map viewport, newest **PublishedAt** first, filterable by activity and distance band. Eligibility is `public`, full stop — **Indexable governs search engines only** and never hides a public Route from Discover. Anonymous-accessible. Like the **Feed**, it is a derived view: nothing is stored per viewer, so a Route flipped back to `private` vanishes from the origin instantly; an edge-cached Discover response lags within the **VisibilityPropagation** bound.
_Avoid_: explore, browse, search, marketplace, "nearby routes" (the viewport, not the user's position, is the query).

## Product analytics

**ProductEvent**:
A behavioural event fired when a user takes an action — `route_created`, `gpx_imported`, `route_share_link_copied`, etc. Sent to self-hosted Umami via `track()` (web) or a server-side `ProductEventListener` (API, only for webhook-driven or async-completion events that have no synchronous UI moment). Distinct from operational metrics (Prometheus, system health) and business analytics (Postgres aggregates rendered in admin UI). Naming convention: `<object>_<verb_past>` in snake_case. Authenticated events carry a `user_id_hash` (server-salted SHA-256 of the Routess user ID) — never the raw `user_id`, never email or route name. See `docs/agents/product-events.md` for the canonical taxonomy.
_Avoid_: tracking event, analytics event, telemetry event, Umami event (use ProductEvent when discussing the domain shape; "Umami" is the implementation detail).
