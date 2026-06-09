# Seeded routes: ExternalRoute as an independent ODbL Collective Database

Seeding (#248) comes in two structurally separate forms. **Generated fill** is ordinary `Route`s manufactured by `RouteGeneration` and owned by a single reserved **system seed User**; nothing new is needed except an owner that is excluded from `Profile` rollup. **ExternalRoute**s are routes derived from licensed open data (EuroVelo, RAVeL, Toerisme Vlaanderen, OSM relations) and they live in their **own table with no foreign key to `Route` or `User`**. We combine the two only at read time. This keeps user routes a legally independent database so ODbL share-alike never reaches them.

## Why the separate table

ODbL's share-alike attaches to a *Derivative Database*. If ODbL-derived geometry and user routes share one table with cross-references and we dedupe/correct one against the other, the user-routes database is arguably derivative and the whole corpus becomes share-alike. Kept in a separate table with no cross-references, the user routes are an independent **Collective Database** (merely collocated), and only the external layer carries ODbL obligations. The epic calls this invariant out explicitly; this ADR is its record.

The escape hatch ODbL gives us is *Produced Works*: a rendered map, a route page, an exported GPX, or a read-time merge of the two tables is a Produced Work, which needs **attribution only**, not share-alike. So combining the tables *in a query response* is fine; combining them *in stored data* is not.

## Decisions

- **Two tables, read-time union.** `Discover`, `RegionalHub`, and route-page lookup query both `Route` and `ExternalRoute` and merge in the service layer. No FK, no stored join, no cross-table dedup. (Cross-*source* dedup within the external layer is allowed but out of scope for v1.)
- **`SeedSource` is a first-class entity.** It carries the license, attribution string, source/homepage URL, refresh cadence, country + activity scope, and a green/yellow/red status. It is the unit of attribution (rendered on every external route page, embedded in exported GPX metadata), of refresh, and of takedown. Red status excludes prohibited providers (French GR, Fietsplatform, Wandelnet) by construction; `delete-all-by-sourceKey` is the kill switch.
- **`ExternalRoute` is ownerless, always-public, immutable.** It has no `User` and no `RouteVisibility`. `Discover`'s "public, full stop" eligibility is re-expressed for it; a max-bbox-area guard keeps continent-scale tracks (EuroVelo) from flooding every viewport (the ADR 0030 caveat made concrete).
- **URL namespacing (amends ADR 0025).** User routes stay `/r/{slug}-{id}`; external routes are `/r/{slug}-x{id}`. One SSR renderer branches on the `x` marker. Tables stay fully decoupled (no shared id sequence).
- **Indexability keys on owner, not provenance.** Human-owned `public` routes are Indexable however the geometry was made; `ExternalRoute`s are Indexable on the normal gate (open data is the SEO anchor); `Generated fill` (system-seed-owned) is always `noindex` and never counts toward the `RegionalHub` >=5 threshold. Raw machine output is map fill, not SEO content.
- **Idempotent refresh.** Each `ExternalRoute` carries `(sourceKey, sourceRecordId)`, `sourceUpdatedAt`, and a content hash. Refresh is an upsert on `(sourceKey, sourceRecordId)`: insert new, update changed, soft-delete vanished. Ids and therefore URLs stay stable (SEO-safe). A per-`SeedSource` cadence drives a scheduled job (the icoonroutes license requires keep-updated + a meldpunt link, so import is never one-shot).
- **User interaction without breaking the wall.** `Favourite` and `Collection` membership become polymorphic so a user can reference an `ExternalRoute` without copying geometry. Editing performs a user-initiated **fork**: a new user-owned `Route` with `Provenance = external-fork`, lineage to the `ExternalRoute`, and the source's license/attribution carried on the row. Forks are `private` by default (no distribution, no share-alike trigger); a `public` fork shows source attribution and is Indexable on the owner-keyed gate. Because the *user* triggers the extraction and the row is license-tagged, the rest of the user-routes table stays an independent Collective Database.

## Considered options

- **Single `Route` table with a provenance partition + null owner** — cheapest reads (no union), but relies entirely on app discipline to keep ODbL data from cross-referencing user routes; one careless dedupe or FK makes the whole table share-alike. Rejected.
- **Postgres UNION view over the two tables** — less app plumbing, but couples the two schemas at the DB and complicates the bbox/visibility indexes the discovery queries depend on. Rejected for v1.
- **Pseudo-Profiles per source / a public bot Profile for generated fill** — reuses Profile UI, but breaks "Profile is the public projection of a User" and pollutes the handle namespace and stats. Rejected; sources render as an attribution badge, generated fill as a brand badge.
- **Full copy-into-library for external routes** — best UX, but pulls ODbL geometry into the proprietary user-routes table, the exact contamination the separation prevents. Rejected in favour of reference + user-initiated fork.

## Consequences

- Every discovery read path gains a second query and a merge step; acceptable at our volumes (ADR 0030 reasoning).
- `Favourite` and `Collection` membership need a polymorphic target (Route | ExternalRoute), a real schema change.
- This is careful license reading, not legal advice. France expansion (anything labeled GR) requires an IP lawyer before ingesting; the red blocklist is the interim guard.

## References

- #248 (epic), #234 / #236 (seeded inventory + RegionalHub)
- ADR 0025 (public route page URL; amended here for the `x` external id space)
- ADR 0030 (bbox discovery; the continent-scale caveat this addresses)
- ADR 0023 (Provenance; `external-fork` added)
- ADR 0027 (RouteVisibility is the only access control; ExternalRoute is always-public, consistent with it)
- CONTEXT.md: Seeding, ExternalRoute, SeedSource, Generated fill, system seed User, Indexable
