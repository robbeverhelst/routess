# Report format

Findings are ranked by **severity x confidence** and **grouped by family**. Safe, high-confidence wins sit at the top; speculative items are clearly marked at the bottom. The goal is a triage-able list, not a wall of text.

## Severity

- **P1** — real impact: shipped dead weight, a reuse miss that will keep diverging, an ADR or boundary violation, a type hole in a hot path.
- **P2** — should fix: drift and smells that cost maintainability but are not actively harmful.
- **P3** — nice to have: cosmetic, low-traffic, or stylistic.

## Confidence

- **high** — proven (delete candidate passed the verify gate; reuse target exists and matches; ADR reference is exact).
- **med** — likely, but a judgement call or a partial match.
- **low** — suspected only. Reported, never auto-applied. Deletions that fail the verify gate land here.

Only **high**-confidence Subtractive items are offered as ready-to-apply removals. Everything else is presented for a decision.

## Layout

Group by family in this order: Subtractive, Conformance, Smell. Within each, sort P1 before P3, and high confidence before low. One line per finding:

```
[P1 · high] core/src/geo/haversine.ts — reimplements distance(); use @routess/core `haversineMeters` (reuse inventory)
[P2 · med ] apps/web/src/route/Editor.tsx:142 — `account` should be `User` per CONTEXT.md glossary → grill-with-docs
[P3 · low ] apps/api/src/legacy/seed.ts — possibly orphaned; failed verify gate (referenced in a string), confirm before delete
```

Each finding shows: severity, confidence, `file:line`, the problem, the fix, and the rulebook reference (ADR id, glossary term, or package export) where one applies. Hand-off targets (`improve-codebase-architecture`, `grill-with-docs`) are named inline.

## After the report

Summarise counts per family and severity (for example: "Subtractive 6 P1/high, Conformance 3 P1 + 4 P2, Smell 9"). Then ask which to apply. Offer the natural batches: "all high-confidence Subtractive," "the P1 Conformance items," and so on. Do not start fixing until the user picks. Deferred findings are dropped from this run, not tracked.
