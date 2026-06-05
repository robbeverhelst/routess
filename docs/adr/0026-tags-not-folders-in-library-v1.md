# Tags are the flat cross-cutting filter primitive, complementary to Collections

The RouteLibrary has two organisational primitives, and they do different jobs:

- **Tags** (the **Tag** entry in CONTEXT.md): a flat list of lowercase keywords attached per Route, for *filtering*. A Tag is a lowercase alphanumeric-plus-hyphen string of 1 to 24 characters; a Route carries up to 10; the same Tag on two Routes is recognised as the same Tag for filter chips and aggregation but is not stored as a shared entity. The library filters by activity, visibility, tag, distance band, and free-text search across name, description, and tags.
- **Collections** (ADR 0024): a curated, manually ordered, shareable many-to-many set of Routes with its own `RouteVisibility`. A Collection is a stored entity owned by the User.

This ADR records *why both exist and stay distinct*, because "isn't a Collection just a tag?" is the obvious conflation and the two should not be merged without new evidence.

A Tag answers "show me anything I labelled `hilly`": cross-cutting, zero-ceremony, many per Route, no ordering, no sharing semantics. It is one `tags` column on the Route and one filter row in the UI. A Collection answers "here is the curated five-day tour I want to share as a unit": ordered, named, individually shareable by URL, a Route belongs to it explicitly. Collapsing tags into collections would force every cross-cutting label to become a stored, ordered, shareable entity (heavy for "hilly"); collapsing collections into tags would lose ordering and per-set sharing (the whole point of a curated trip). They are cheap to keep separate and expensive to conflate.

Tags deliberately stay flat: no folders, no nesting, no per-tag entity. Folders would force a parent/child schema decision (one folder per Route or many?), a move-between-folders UI, and a "default/unfiled" question. The cross-cutting case folders cannot express ("hilly", "with friends", "race-prep" on the same Route) is exactly what flat tags do best, and the curated-bucket case is already served by Collections. The 10-tag and 24-character caps keep the filter row a single horizontal scroll and stop the column absorbing free-form notes; both are conservative enough to raise without a data-model change.

## Considered options

- **Tags as a flat filter primitive alongside Collections (chosen).** Each primitive is cheap and covers a job the other cannot: tags for cross-cutting filtering, Collections for curated ordered sharing. One `tags` column plus the Collection entity from ADR 0024.
- **Folders instead of Tags.** Rejected: forces every Route into a single bucket and makes cross-cutting labels impossible without duplicating Routes. The bucket case is covered by Collections and by `RouteActivity` plus `RouteVisibility`.
- **Fold tags into Collections (one primitive).** Rejected: would make every lightweight label a stored, ordered, shareable entity, which is far too heavy for the "find anything tagged X" job tags exist for.
- **No Tags at all, free-text search only.** Rejected: search misses the "give me anything I tagged `hilly`" use case, which is the one a user performs while planning a Sunday ride.
