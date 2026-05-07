# Single canonical Waypoint type

There is one `Waypoint` type, defined in `@routess/core` as `{ coord: [lng, lat], type: "routed" | "direct", name?, timestamp? }`. The `@routess/api-client` package and the `apps/api` entity both re-export this type rather than defining their own. The wire format (API request/response and DB JSONB) uses the same shape — `coord: [lng, lat]` rather than separate `lat`/`lng` fields. Routes persisted before this change are migrated by `Migration20260507120000`. Share-link wire keeps the legacy `{w, f}` boolean-array format readable for back-compat, but new shares always emit the canonical form. GPX exports embed the Waypoint Type in a `<routess:type>` extension under `<extensions>`; foreign GPX without the extension falls through to the existing road-proximity heuristic.

## Considered options

- **Three Waypoint definitions, adapters at each seam** — the prior state. Rejected: nothing meaningful varied between the three shapes; the per-seam conversions in `RouteIOService`, `MapWithRouting`, `shareUtils`, and `CommandPalette` were doing pure shape translation, not real adaptation. By the *one-adapter-means-hypothetical-seam* rule, this was indirection without payoff.
- **Keep `{lat, lng}` on the wire and DB, `coord: [lng, lat]` only in memory** — rejected: that locks in a permanent boundary adapter to avoid a one-shot JSONB migration. Mismatched in-memory and wire shapes are exactly the smell we're cleaning up.
- **Drop the share-link legacy format on the next release** — deferred: existing share links are external state we don't control; cost of the 5-line legacy decoder is negligible compared to breaking outstanding URLs.
