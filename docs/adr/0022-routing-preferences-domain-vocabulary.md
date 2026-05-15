# Routing preferences speak Routess's vocabulary, not Valhalla's

**RoutingPreferences** is a small, opinionated, Routess-owned vocabulary — `SurfaceType` (`paved | mixed | unpaved`), `HillPreference` (`flat | mixed | hilly`), `BikeType` (`road | hybrid | gravel | mountain`, cycle only), `avoidFerries`, `avoidHighways`. The translation from this vocabulary to Valhalla's costing JSON (`bicycle_type`, `use_hills`, `use_tracks`, `avoid_bad_surfaces`, etc.) is a pure function `valhallaCostingFromPreferences(activity, prefs)` in `@routess/core`, table-driven and table-tested. Provider-specific names never appear in the domain, the DTOs, the stores, the routes, or the UI.

The boundary protects the domain from the provider. If routing moves off Valhalla later (ADR-0021's #171 trigger, or a switch to a different engine entirely), the work is rewriting one translator function, not migrating saved Routes, DB columns, DTOs, UI strings, and the glossary. The user's vocabulary stays stable across provider swaps.

The cost of this boundary is that we don't expose every Valhalla knob (e.g. `use_tracks: 0.3` as an individual slider). That cost is a feature: route-planning UX is not improved by exposing twenty 0..1 sliders. Three-value enums match how users actually think ("paved", "mixed", "unpaved"), and the small finite cross-product makes the translation table reviewable and testable.

## Considered options

- **Absorb Valhalla's vocabulary directly into the domain** — `RoutingPreferences { useHills: number; useTracks: number; bicycleType: 'Road'|'Hybrid'|'Cross'|'Mountain'; ... }`. Rejected: leaks the provider name into the glossary, forces UI to either expose sliders (bad UX) or hide them behind presets that re-build the small vocabulary anyway, and makes a future provider swap a domain migration rather than a translator rewrite.
- **No explicit vocabulary; pass raw costing JSON through the stack** — rejected: same problems plus turns every consumer (UI, DTO, store) into a Valhalla parser.
- **Expose a "custom costing" escape hatch alongside the small vocabulary** — deferred. The escape hatch can be added later if a power-user use case materialises; it can't be retreated from once shipped.
