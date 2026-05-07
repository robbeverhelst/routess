# RouteDraft editor module owns all draft mutations

The RouteDraft editor (`apps/web/src/features/routing/RouteDraftEditor.ts`) is the single deep module for every RouteDraft mutation: add/insert/remove/move Waypoint, reverse, reset, recalculate, undo/redo, plus loading from API/share-link/GPX and exporting GPX or share URLs. The editor is constructed once per Mapbox map instance — capturing `map`, `accessToken`, and an optional error reporter — and exposes a small interface (15 methods, all 0–2 arguments). Everything underneath, including the Zustand `routingStore` writes, route calculation, snapping, and history snapshots, is implementation. ADR-0002 stays unchanged: Zustand remains the implementation; the editor is the interface above it.

A React provider (`RouteDraftEditorProvider`) holds the editor and a hook (`useRouteDraftEditor`) makes it available to panels, modals, and screens. The editor is created inside `useMapInitialization` once the Mapbox map fires its `load` event, then handed to map click/drag handlers (`MapInteractionManager`) and the React provider via `setEditor`. `RouteCalculationService.getRoute` no longer takes React state setters; it writes distance/duration/hasRoute to the routing store directly.

The legacy `WaypointManager.ts` (325 lines, 7-arg signatures) and `RouteIOService.ts` (243 lines, four exported functions each carrying its own copy of the same plumbing) are deleted. `useRouteActions` shrinks from 247 lines to ~120; each handler becomes `editor.<method>(...)`.

## Considered options

- **Keep `WaypointManager`, just rename it** — rejected: the friction was the *interface shape* (every function carrying `map, accessToken, setRouteDistance, setRouteDuration, setHasRoute, handleWaypointError, isMapLockedRef`), not the function names. Renaming wouldn't move locality.
- **Make the editor a static module that reads `useRoutingStore.getState()` and a global `currentMap` reference** — rejected: a captured-instance editor is testable (you can construct one with a mock map and verify), a global isn't. Captured instance also forces clean disposal on map teardown.
- **Use React context for the editor everywhere, including in the imperative click handlers** — rejected: `MapInteractionManager.initializeMapInteractions` runs imperatively at `map.load` time, outside any React render. Passing the editor in directly is simpler than threading a context through an event handler.
- **Fold `RouteIOService` later (Candidate 4 sequenced after Candidate 1)** — done together. The two refactors share the same target seam; splitting them would have left a half-migrated state where the editor existed but I/O still went through legacy plumbing. Single coherent diff is cleaner.
