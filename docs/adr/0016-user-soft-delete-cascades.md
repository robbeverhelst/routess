# User soft-delete cascades to routes and sessions; Google relogin undeletes

Admin soft-delete on a `User` cascades to soft-delete all of their `Route` rows and revokes all of their `Session` rows (`expiresAt = now()`). The user's data is hidden from the application, including from the user themselves, but is fully recoverable.

If a soft-deleted user logs in again with the same `googleId`, `AuthService` undeletes the user and their routes (a "welcome back" flow) and emits a `user.undeleted` event. This treats soft-delete as reversible by definition, distinct from hard-delete.

Hard-delete (GDPR erasure) is intentionally out of scope. When first required it will get its own decision and a separate operational path (CLI or migration), not the admin UI button.

## Considered options

- **Leave routes orphaned on user soft-delete** — rejected: routes don't filter on `user.deletedAt`, so they'd remain visible in any global query, contradicting the apparent semantics of "user is deleted."
- **Anonymise routes on user soft-delete (null the user link)** — rejected: irreversible without a side-channel mapping, and undelete then has nothing to restore. Anonymisation is the right shape for hard-delete, not soft-delete.
- **Refuse re-signup with a previously-deleted email and require manual admin restore** — rejected: high-friction for the common case (user changes their mind), and creates a support workflow we'd rather not own. Undelete-on-relogin is the simpler invariant.

## Consequences

- A login can mutate state beyond session creation (it can undelete records). Future readers will be surprised; the alternative is worse.
- The soft-delete filter (ADR-0012) must be bypassed on the `googleId` lookup in the login path so that soft-deleted users are findable for undeletion.
- Any future hard-delete path must be explicitly distinct: it does not run through this cascade and is not reversible.
