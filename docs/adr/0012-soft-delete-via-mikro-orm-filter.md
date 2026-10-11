# Soft-delete is enforced by a global MikroORM filter

The `softDelete` filter is declared on `BaseEntity` (`apps/api/src/entities/base.entity.ts`) with `cond: { deletedAt: null }, default: true`. Because every persisted entity (`User`, `Route`, `Session`) extends `BaseEntity`, every read implicitly excludes soft-deleted rows without the call site needing to remember the filter clause. Services, repositories, and tests no longer write `deletedAt: null` by hand.

Cleanup paths that intentionally need to see (or hard-delete) soft-deleted rows pass `{ filters: { softDelete: false } }` to the query. Today the only such call sites are `RoutesService.hardDelete` and the historical-counter initialization in `MetricsService.initializeBusinessMetrics`. Test assertions that need to verify the soft-delete actually wrote a `deletedAt` use the same opt-out via a forked EntityManager.

## Considered options

- **Manual `deletedAt: null` on every read** — the prior state. Rejected: scattered across five services and any new query was a chance to leak soft-deleted rows. The check was identical at every site, so concentrating it cost nothing and removed a foot-gun.
- **A `SoftDeleteRepository<T>` base class wrapping the EntityManager** — rejected: duplicates a feature MikroORM ships natively, and the wrapper would still need the same `disableFilters` escape hatch for cleanup paths. The native filter is a smaller surface.
- **Drop soft-delete entirely; hard-delete with audit trail** — out of scope. Soft-delete is the existing contract for the `deleted account` and `deleted route` flows; replacing it is a separate decision.

## Amendment (2026-10-11): more opt-out call sites

The global filter still holds, but `{ filters: { softDelete: false } }` is now used in more places than the two listed above. The opt-outs fall into these groups:

- Login and account lifecycle: the Google and email login lookups (`auth.service.ts`, `email-auth.service.ts`), account deletion and cancel-deletion (`users.service.ts`), and admin restore (`admin.service.ts`). These must see a soft-deleted user to reactivate or reject it.
- Admin views: deleted-user counts and user/route detail pages in `admin.service.ts`.
- Seeding: `external-routes.service.ts` counts and reconciles ExternalRoutes including soft-deleted ones.
- The original two: `RoutesService.hardDelete` and the metrics initialization in `metrics.service.ts`.

New opt-outs should stay inside one of these groups; anything else is a sign the read should keep the filter.
