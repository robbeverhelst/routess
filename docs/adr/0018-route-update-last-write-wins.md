# Route updates are last-write-wins (deferred optimistic concurrency)

Route PATCH requests carry no version token, no `If-Match` header, and no `updatedAt` echo; concurrent edits to the same Route from two tabs or two devices silently overwrite each other in last-write-wins order. This is a deliberate scoping decision for the edit-in-place flow (ADR-0017): adding optimistic concurrency requires an API change, a migration to track `version` on `Route`, and a conflict-resolution UX, none of which are in scope for the editor refactor. Routess is currently single-user-per-route and the concurrency window is small, so the risk is bounded but not zero, and the failure mode is silent data loss.

The intended future direction is server-side optimistic concurrency: `Route.version` increments on each update, PATCH sends the version it read, server returns 409 on mismatch, web surfaces a "this route was changed elsewhere" recovery flow.

A related deferred risk lives at the same seam: `routess:load-route` currently overwrites the in-progress draft without confirmation. Both gaps should be addressed before Routess gains multi-device sync or any collaborative editing surface.
