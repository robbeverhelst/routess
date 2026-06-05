# Collections are ordered many-to-many; favourites are a boolean on the Route

The library redesign introduces **Collection**: a curated, manually ordered, shareable set of Routes (CONTEXT.md "Collection"). The entity is deliberately Komoot-shaped: a Route can live in any number of Collections, the order within a Collection is user-defined, and the Collection has its own **RouteVisibility** so a whole trip can be shared by URL.

Membership and order live in a pivot entity (`collection_route`) carrying a `position` column, with a unique constraint on `(collection_id, route_id)`. The membership API is a single idempotent endpoint — `PUT /collections/:id/routes` with the full ordered ID list — covering add, remove, and reorder in one shape instead of three mutation endpoints whose interleavings would need conflict rules. The service diffs in place (updates `position` on surviving pivots, inserts/removes the rest) because remove-all + re-insert trips the unique constraint: the ORM flushes inserts before orphan deletes.

Sharing a Collection never widens the visibility of the Routes inside it. Non-owners (including anonymous visitors) of a `public`/`unlisted` Collection see only its non-`private` Routes; `private` Collections 404 to non-owners, mirroring Route semantics so existence doesn't leak.

**Favourites** move from client-only localStorage (which silently diverged across devices) to a `favourite` boolean on the Route entity, toggled via the existing PATCH endpoint. A one-time client migration pushes legacy localStorage favourites to the server on first authenticated library load, then clears local state. Routes are always owned by the favouriting user today, so a join table would model a relationship ("user favourites route") that cannot yet involve anyone else's routes.

In the same change, `GET /routes` gains `limit`/`offset` pagination with the total in an `X-Total-Count` header, replacing a silent hardcoded 100-route cap. The response stays a plain array so existing PAT consumers keep working; the web client walks all pages into its cache and keeps filter/sort/search client-side and instant.

## Considered options

- **Tags only, no Collection entity** — zero schema work (tags already existed), but tags are flat labels: no ordering, no curation, no shareable unit. Both were wanted; tags are now surfaced for filtering *alongside* Collections.
- **One folder per Route (exclusive membership)** — simpler mental model, but routes genuinely belong to multiple groupings ("gravel" and "Ardennes weekend"). Rejected as a regret-in-waiting.
- **Separate add/remove/reorder endpoints** — finer-grained, but three endpoints whose interleavings need conflict rules; the full-list PUT is idempotent and matches how the client mutates (drag reorder produces the full order anyway).
- **Favourites as a join table** — future-proofs favouriting *other* users' public routes, but that feature doesn't exist; a boolean column is sufficient and trivially filterable. Revisit when discovery lands.
- **Paginated envelope (`{ items, total }`) for `GET /routes`** — cleaner shape, but breaks the response contract for existing PAT/agent consumers. The header carries the total without breaking anyone.
