# Shared routing logic, dual-credential execution

The orchestration that turns a RouteDraft into a RoutePath + metrics (compute routed/direct segments, sample elevation, classify SurfaceBuckets) lives in `packages/core` as a pure `computeDraft(draft, providers)` function. Both `apps/web` and `apps/api` import it. Web constructs `providers` backed by the browser's `fetch` against Mapbox Directions, Mapbox terrain, and Stadia Maps Valhalla with a public anon key; API constructs `providers` backed by server-side `fetch` against the same vendors with server-side keys. Same algorithm, different transports, different credentials.

This shape exists because issue #139 requires headless agents and a CLI to recalc and save Routes, while the web app's sub-200ms waypoint UX must not regress. Routing the web app through `apps/api` would have added a backend round-trip to every waypoint interaction (measured at 150-400ms vs. 80-200ms today) and would have made the web UI dependent on API availability for a flow that currently degrades to "can build but can't save" when the API is down. Sharing only the algorithm avoids that regression while still giving CLI/agent clients a server endpoint (`POST /v1/draft/recalc`) that produces the same result the web app would produce.

The footgun we accept: identical waypoints can produce subtly different RoutePaths between a browser session and a server session if Mapbox returns tier-dependent results to the two API accounts. We do not architect against this; we detect it through spot-check tests in `packages/core` that pin known waypoint sequences to expected RoutePath shapes and run against both provider sets in CI.

When the per-request cost or upstream rate limits of Mapbox+Stadia become painful, the migration to self-hosted Valhalla is a server-side change to the API's provider implementation. The web app stays on Mapbox until a separate decision retires its client-side routing entirely.

## Considered options

- **Centralize on the API; web app calls `POST /v1/draft/recalc` for every interaction** — rejected: regresses waypoint UX from "instant" to "responsive but not instant", makes the web UI critical-path-dependent on the API, and shifts every drag onto our server-side Mapbox account.
- **Keep web app routing in `apps/web`, duplicate the orchestration server-side for the agent path** — rejected: two implementations drift. Agents would silently produce different routes than users for identical inputs, and the divergence would only surface as user-reported "the AI route doesn't match what I'd draw."
- **Move all routing client-side, ship the same code in the CLI/agent bundle with their own Mapbox tokens** — rejected: forces every agent author to provision SaaS credentials, leaks routing logic into every consumer, and makes auditability/rate-limiting impossible.
