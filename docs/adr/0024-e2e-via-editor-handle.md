# E2E drives the map via the editor handle, not canvas pixel clicks

For the v1 E2E suite, RouteDraft mutations in flow tests (`apps/web/e2e/flows/*.spec.ts`) are issued through an imperative handle on `window.__routess`, exposed by an `<E2ETestApiBridge>` component mounted at the app root only when `import.meta.env.VITE_E2E === "true"`. Tests call `await page.evaluate(([lng, lat]) => window.__routess.editor.addWaypoint(lng, lat), [4.40, 51.22])`. The handle wraps the same `RouteDraftEditor` instance (per ADR-0009) the live UI uses, so tests exercise the editor's full orchestration: snap-writeback, history snapshots, route calculation, store updates.

A separate file, `apps/web/e2e/input-layer/map-interaction.spec.ts`, exercises the input layer with **real pixel events** (`page.mouse.click`, drag) against the canvas. The map is pinned to a fixed center/zoom and `boundingBox()` resolves click targets. Its sole job is to catch input-wiring regressions: click on the map adds a Waypoint at the right lng/lat, click on a NavigationControl does not, drag moves an existing Waypoint, double-click deletes. Logic-layer assertions (Distance, Duration, persistence, share round-trip) live exclusively in the flow tests.

The bridge does not violate ADR-0009's rejection of a "global editor": the editor is still constructed once per Mapbox map instance and captured. The bridge merely surfaces a reference to that captured instance for the test runner to invoke. The reference is gated by a Vite env var that is statically false in production, so the import is tree-shaken from prod bundles.

## Considered options

- **All pixel clicks, no imperative handle** — rejected: every flow test would carry pixel-math setup; layout changes (control placement, responsive breakpoints, tile-load timing) ripple into unrelated specs. Setting up a 5-Waypoint route via clicks is also slow.
- **Mutate `routingStore` directly** — rejected: skips the `RouteDraftEditor` orchestration that ADR-0009 frames as the single deep module above the store. Tests would pass while user-visible behavior breaks.
- **Carve the input-layer specs into the flow tests via real clicks too** — rejected: every flow test would pay the input-layer's flake cost (canvas + tile load + pixel math) without gaining any logic-layer signal it didn't already have through the editor handle.

## Consequences

- The flow tests don't catch input-wiring regressions; that responsibility lives entirely in `map-interaction.spec.ts`. If that file is skipped or deleted, the input layer becomes untested.
- The `<E2ETestApiBridge>` and `window.__routess` shape are part of the test contract. Renaming an editor method means updating the bridge and any specs that call it.
- Production builds (where `VITE_E2E !== "true"`) tree-shake the bridge entirely. Verifying this via bundle-size diff at least once on first integration is worth doing.
