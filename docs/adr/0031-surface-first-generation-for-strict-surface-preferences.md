# Strict surface preferences steer candidate placement, not just costing

Loop generation with `surfacePreference: unpaved` produced mostly-paved loops even in areas with plenty of gravel. The root cause is structural: the candidate fan (ADR 0029) places via points geometrically, blind to where the unpaved network is, and Valhalla cannot compensate. Edge costs can never go negative, so costing knobs (`use_tracks`, `avoid_bad_surfaces`) only stop penalising unpaved edges; the router never detours to ride gravel, and `use_tracks` only touches `highway=track` edges anyway. If a via lands in a paved pocket, every route through it is paved no matter the costing.

Finding the preferred surface is therefore our job, applied at three points in the pipeline:

1. **Surface nudge (snap stage).** With a strict preference (`paved` or `unpaved`), the batched `/locate` sends a 500 m search radius per via and the edge picker prefers the nearest edge whose surface matches the preference over the nearest edge overall. A via on the right surface drags the whole loop onto that network; this is the only lever that genuinely changes where the loop goes. The start never nudges (the user picked it deliberately).
2. **Surface wave (second-wave candidate tactic).** When the fan's best candidate still fits the preference poorly (surfaceFit < 0.85), exploit what the fan already learned. The fan's own `/trace_attributes` results record exactly where the preferred surface is, so the wave harvests **surface anchors** — the matching runs the fan crossed, each anchored at the edge holding its halfway point, kept only if the run is long enough to be through-routable (≥0.6 km, shorter runs are dead-end stubs) and within loop range of the start. It then plans a candidate whose via points sit on the longest anchors that fit the distance budget, visited in angular order, and routes it (a cascade of descending via counts handles the common case where many `through` points defeat the router). This **iterates**: each anchored loop crosses fresh surface the fan never saw, so re-harvesting yields richer anchors, until a round stops improving fit or a bound (3 rounds) is hit. Anchored candidates that spur in and back out (overlap above the low-quality line) are rejected so the wave never trades dead-ends for gravel. Only when no anchors ever surface does the wave fall back to probing two bearings at ±22.5° around the best-fitting spoke. Vias are trace midpoints, already on the network, so anchored candidates skip the snap and refinement passes.
3. **Strict score weights.** A strict preference is the point of the request, so `surfaceFit` weighs 0.35 (from 0.2) with overlap at 0.35; `mixed` keeps the ADR 0029 weights. An out-and-back gravel loop is still a bad loop, so overlap stays heavy.

Two supporting semantics changes:

- **Unpaved cycling sends `bicycle_type: Mountain`** (plus `use_tracks: 1.0`). Mountain raises Valhalla's internal speeds on dirt/gravel/path, the closest the engine has to rewarding unpaved; it applies to manual routing too, keeping ADR 0023 reproducibility intact.
- **The `compacted` bucket matches the `unpaved` preference** in `bucketMatchesPreference`. Compacted gravel is the canonical unpaved riding surface; counting it as a violation penalised exactly the network the preference asks for. It still violates `paved`.

## Considered options

- **Steer placement and selection (chosen).** Works with the engine instead of against it; reuses the `/locate` and `/trace_attributes` data the pipeline already fetches.
- **Costing tuning only.** Rejected as sufficient on its own: kept (Mountain, `use_tracks`) but a cost model that cannot reward a surface cannot make the router seek it out.
- **A denser fan.** Rejected: linear cost increase, still surface-blind; the wave spends the same calls only where the fan's own evidence says gravel is.
- **Bearing-probe wave only (the original v1 of this ADR).** Rejected as the primary tactic: nudging a geometric ring toward a gravel-rich bearing still routes paved between the vias, because the vias themselves rarely land on gravel. Anchoring vias directly on traced gravel runs is what moves the loop; the bearing probe survives only as the no-anchor fallback.
- **Gravel-density prescan (Overpass or isochrone sampling).** Rejected for now: a new data dependency and latency stage, when the nudge plus anchored wave exploit data we already have. Revisit if surface fit telemetry stays poor.

## Consequences

- A nudged via can sit up to 500 m off the geometric circle; the existing one-shot distance refinement absorbs the drift.
- The anchored wave is sequential across its rounds (each feeds the next), adding up to a few route+trace pairs per round under the `MAX_WAVE_ROUNDS` bound; the surfaceFit threshold keeps it off the happy path and `mixed` never waves. The `/trace_attributes` filter now also requests `edge.begin/end_shape_index` and `shape` so edge midpoints are known.
- Anchored loops favour gravel over circularity, so they tend to carry higher overlap than fan loops; the low-quality overlap gate on wave candidates caps how spurry they may get, and effectiveness is bounded by what the fan crossed (a start ringed by pavement still yields little).
- Surface-fit badges shift: compacted-heavy routes no longer flag as mismatching an unpaved preference.
- Wave candidates carry arbitrary bearings outside the fan's grid; regenerate's `excludeBearings` already handles arbitrary values, and the wave skips a bearing already excluded.
