# Route generation is a scored candidate pipeline, not a single-shot loop algorithm

Two earlier attempts at loop generation produced out-and-back routes and dead-end spurs. Both failures share one root cause: via points were placed geometrically and routed once, with nothing validating where points snapped and nothing measuring whether the result was actually a loop. A routing engine answers "cheapest A→B"; it has no concept of "a good 40km loop", so loop quality must be *measured by us*, not hoped for.

RouteGeneration is therefore a staged pipeline of pure functions in `@routess/core`, orchestrated by a NestJS module behind `POST /api/v1/generation` (synchronous, anonymous with a strict throttle bucket):

1. **Anchors** — v1: just the start point. The stage exists so a future LLM interface can inject geocoded landmark anchors ("past the Kasteel van Horst") without restructuring anything.
2. **Candidates** — v1 tactic: a geometric fan of ~8 bearings (restricted by the requested **Heading**); each candidate places 3–4 via points on a circle sized `target / (2π × circuity)`, batch-validated via Valhalla `/locate` so points never land on dead-ends or driveways (the spur failure). Future tactics (isochrone-anchored, exclude-return retry) slot in as additional generators.
3. **Routing** — one multi-leg Valhalla `/route` call per candidate, in parallel under the existing concurrency cap, using `valhallaCostingFromPreferences` so generated routes obey the same RoutingPreferences semantics as manual planning (ADR 0023 reproducibility holds: the confirmed candidate's via points become the draft's Waypoints, so recalc reproduces the loop).
4. **Scoring** — weighted: **Overlap** via duplicated `way_id`s from `/trace_attributes` (heaviest weight — the out-and-back failure becomes a number), distance match, surface fit (`bucketMatchesPreference`), shape compactness. Elevation is displayed but not scored (v1 has no hilliness input; scoring it would bake in a flatness bias). Road/trail suitability is not re-scored (the costing already optimised for it). Weights are one exported tunable constant.
5. **Selection** — mutual-overlap dedupe picks up to 3 diverse survivors; a tiered quality gate shows mediocre candidates with their flaw labeled and rejects unusable ones with structured reason codes that the UI maps to retry suggestions.

## Considered options

- **Scored candidate pipeline (chosen).** Every past failure mode becomes a scored penalty or a validation step; quality is observable (overlap %, score distributions, reason codes feed Prometheus and ProductEvents); algorithm improvements and the LLM interface are new stage inputs, not rewrites.
- **Single-shot geometric loop.** Rejected: this is what failed twice. Without scoring there is no defence against out-and-back and no way to know quality is bad before users do.
- **Second engine with native round-trip (GraphHopper/ORS).** Rejected: a second provider with costing semantics that don't match `valhallaCostingFromPreferences`, no scoring hooks, no anchor concept for the LLM future, and generated routes whose RoutingPreferences could no longer reproduce them.
- **Client-side orchestration (ADR 0021 pattern).** Rejected for generation: a fan of ~16 calls per attempt belongs next to self-hosted Valhalla, server-side metrics/cost tracking is an explicit requirement, and CLI/agent/LLM clients reuse the endpoint instead of reimplementing the pipeline.

## Consequences

- v1 is loop-only; generated a-to-b ("stretch the shortest path to ~X km") is a future candidate tactic in the same pipeline, not a separate system.
- `LoopDirection` (clockwise/counter-clockwise) is retired from the vocabulary in favour of **Heading** (compass arc the loop extends toward), which is what candidate generation can actually use.
- Generation quality is a dashboard, not a vibe: accepted-route overlap %, candidate score distributions, failure reason codes by area, latency, and Valhalla calls per generation.
