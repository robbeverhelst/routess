# Admin role reconciled from `ADMIN_EMAILS` env var on every login

The `User.role` column (`'user' | 'admin'`) is a cache; the source of truth is the `ADMIN_EMAILS` environment variable plumbed through Helm `values.yaml`. On successful Google login, `AuthService` sets `role = 'admin'` if the verified email is in `ADMIN_EMAILS`, else `'user'`. The role column is therefore declarative and version-controlled — promoting or demoting an admin is a `values.yaml` change reviewed in a PR, not a database mutation.

If `ADMIN_EMAILS` is unset or empty, reconciliation is skipped and existing roles are preserved. This guards against a deploy with the variable accidentally missing silently locking everyone out of the admin surface.

There is no in-app UI for granting admin to another user in this iteration; the admin set is small (one person) and the declarative path is sufficient.

## Considered options

- **CLI promotion (`bun run cli admin:promote <email>`)** — rejected: imperative, requires `kubectl exec` access, easy to forget after a fresh database, leaves no audit-trail in version control.
- **Database seed migration** — rejected: per-environment toil (different emails per env), brittle when seeding production, and admin set changes still require a migration.
- **Hybrid (env var bootstraps, in-app endpoint promotes others)** — deferred. Adds a runtime mutation surface and a "env var only promotes, never demotes" rule that's easy to get wrong. Revisit when there is a second admin and a real reason to delegate role management out of Helm.

## Consequences

- A future reader will see `user.role` overwritten on every login. This is intentional, not a bug.
- The session JWT does not encode the role; `RolesGuard` does a DB lookup per admin request, so a demotion via `values.yaml` takes effect on the demoted user's next login (or sooner if their session is revoked).
- If a Google account email changes, admin status is lost until `ADMIN_EMAILS` is updated.
