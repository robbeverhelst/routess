# Zustand for RouteDraft state

The in-progress RouteDraft (waypoints, directFlags, RoutePath, distance, duration, undo/redo history, map lock state) is held in a single Zustand store at `packages/core/src/stores/routing.ts`. Zustand was chosen over Redux/RTK because the UI mutates this state at high frequency (every map click, every drag) and Zustand's hook-based subscription model lets components subscribe to narrow slices without reducer/action plumbing. The store is shared across web (and any future native) consumers via `@routess/core`, with persistence layers injected by the platform (localStorage on web, AsyncStorage on mobile).

## Considered options

- **Redux Toolkit** — rejected: too much ceremony for what is largely ephemeral UI state with a clear single-owner domain object.
- **React Context only** — rejected: re-render granularity is too coarse for a high-frequency editing surface.
