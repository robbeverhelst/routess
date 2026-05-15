# RoutingPreferences live on the Route; legacy routes carry a Provenance

**RoutingPreferences** is a property of the **Route** (and, transitively, of its **RouteDraft**), not of the **User**. The User holds *defaults* keyed by **Activity** (`cycle`, `run`, `walk`); when a new RouteDraft starts, the relevant per-Activity default is *copied* onto the draft. From that moment the prefs travel with the draft, get persisted on save, and are read back when the Route is loaded. The user-level defaults are never re-read for a draft that already has prefs.

The reason is reproducibility. A saved Route is the canonical record of *what was computed*; recomputing it later should produce the same RoutePath. Holding prefs on the User would mean "recalculate" silently uses today's preferences, not the ones that produced the route — a class of "recalc destroyed my saved route" failure that we explicitly designed against. Anchoring prefs to the Route also closes the loop in CONTEXT.md: `SurfaceType` was already documented as an *input* to a Route, but had nowhere to live; now it does.

Legacy routes (computed by Mapbox before #137) have no meaningful prefs. They are migrated with `routingPreferences = null` and a new immutable **Provenance** column set to `mapbox-legacy`. New routes carry `provenance = 'valhalla'` and a non-null `routingPreferences`. GPX imports carry `provenance = 'gpx-import'` and `routingPreferences = null` permanently (the route came from a file, never had inputs). AI-generated routes carry `provenance = 'generation'` with the generation parameters captured as prefs.

"Recalculate with new prefs" on a legacy route **forks**: a new Route is created with `provenance = 'valhalla'`, the original Mapbox-legacy Route stays put untouched. The user explicitly saved the original; silently overwriting its geometry is the same failure mode as the per-User-prefs model.

## Considered options

- **Prefs on the User only, never on the Route (M1)** — simplest data model, but reintroduces the silent-recalc problem on day one and leaves `SurfaceType` (already documented as an input) homeless. Rejected.
- **Prefs on the User with a per-Route override that's editable but not persisted (M3 minus saving)** — half-state: drafts could carry overrides but saved Routes couldn't remember them. Rejected as a worst-of-both compromise.
- **Backfill legacy routes with a "best guess" preference set (B3)** — rejected: the guess is wrong for the routes the user cared most about (the ones planned for specific surface/hill reasons), and recalculating those produces something that *looks like* the original preference but isn't.
- **Lazy default on read for legacy routes (B1)** — no migration, render with current user defaults. Rejected for the same reason M1 was: silent recalc, hidden lie about what produced the geometry.
- **In-place replacement on recalculate, not fork** — rejected: the user saved the original deliberately; "Set preferences and recalculate" is an exploratory action, not a destructive one. Forking preserves both, and the user can delete the old one explicitly if they choose.
