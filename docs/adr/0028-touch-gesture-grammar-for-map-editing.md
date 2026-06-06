# Give touch its own gesture grammar instead of reusing mouse handlers

Touch interactions on the planning map get a dedicated grammar: tap a waypoint for its action popup, long-press (500ms) a waypoint to lift it into a drag, long-press the route line to insert-and-lift, long-press empty map for the direct-waypoint popup, and tap empty map to add a routed waypoint. Touch never starts a drag on contact; immediate finger movement always pans the map. Mouse behavior is unchanged (mousedown-drag, hover insert, right-click popup). The constraint that forced this: the shared mouse/touch handlers made touchstart on a waypoint start a drag immediately while the long-press delete timer ran, so holding to delete committed a small accidental move, touching near the route silently inserted waypoints, and the single-pixel hit-test made taps that barely missed a waypoint add a new one beside it. The trade-off we accepted: two interaction models to maintain, and drag on touch sits behind a 500ms hold instead of being instant.

## Considered options

- **Tap = actions, long-press = grab (chosen)** — matches the Google Maps pin convention every phone user already knows; removes all gesture ambiguity because no drag can start by accident; delete becomes a single tap instead of a 750ms hold.
- **Deferred drag (movement threshold before drag starts)** — rejected because a finger landing on a waypoint while panning still drags it, which stays error-prone on dense routes.
- **No drag on touch** — rejected because fine route tweaks on mobile are a core flow; delete-and-re-add is too lossy.
- **Unify mouse onto the touch grammar** — rejected because mousedown-drag is correct for pointers and desktop had no complaints; degrading it buys only code symmetry.
- **Confirm pin for tap-to-add** — rejected because it doubles the taps for the most common action; accidental adds are instead prevented by tap suppression (popup-open taps only dismiss, gesture cooldown after pinch/pan/drag) and a padded touch hit-test.

## Consequences

- Positive: long-press-to-delete, which was unreachable on touch (the drag path returned before the timer was ever scheduled), is replaced by tap-to-delete that always works; no more accidental moves or silent waypoint inserts; padded hit-testing (waypoint > route > empty) makes fat-finger taps land on the intended target.
- Positive: the popup grammar stays small, the waypoint popup remains delete-only; rename and type changes stay in the plan panel.
- Negative: touch and mouse paths in `MapInteractionManager` diverge and must be reasoned about separately.
- Negative: drag on touch is discoverable only by holding; mitigated by the visual lift on long-press.
- Follow-up: plan panel reorder moves from HTML5 drag-and-drop (dead on mobile browsers) to pointer-event drag on the grip handle, one code path for mouse and touch.

## References

- ADR-0009 (RouteDraft editor module): the interaction manager keeps calling editor methods; this decision only changes when gestures fire them.
- Prior behavior: `MapInteractionManager.ts` started drags in `touchstart` and inserted waypoints on route contact (`insertAndStartDrag`).
