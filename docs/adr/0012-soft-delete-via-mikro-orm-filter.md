# Soft-delete is enforced by a global MikroORM filter

The `softDelete` filter is declared on `BaseEntity` (`apps/api/src/entities/base.entity.ts`) with `cond: { deletedAt: null }, default: true`. Because every persisted entity (`User`, `Route`, `Session`) extends `BaseEntity`, every read implicitly excludes soft-deleted rows without the call site needing to remember the filter clause. Services, repositories, and tests no longer write `deletedAt: null` by hand.

Cleanup paths that intentionally need to see (or hard-delete) soft-deleted rows pass `{ filters: { softDelete: false } }` to the query. Today the only such call sites are `RoutesService.hardDelete` and the historical-counter initialization in `MetricsService.initializeBusinessMetrics`. Test assertions that need to verify the soft-delete actually wrote a `deletedAt` use the same opt-out via a forked EntityManager.

## Considered options

- **Manual `deletedAt: null` on every read** — the prior state. Rejected: scattered across five services and any new query was a chance to leak soft-deleted rows. The check was identical at every site, so concentrating it cost nothing and removed a foot-gun.
- **A `SoftDeleteRepository<T>` base class wrapping the EntityManager** — rejected: duplicates a feature MikroORM ships natively, and the wrapper would still need the same `disableFilters` escape hatch for cleanup paths. The native filter is a smaller surface.
- **Drop soft-delete entirely; hard-delete with audit trail** — out of scope. Soft-delete is the existing contract for the `deleted account` and `deleted route` flows; replacing it is a separate decision.
