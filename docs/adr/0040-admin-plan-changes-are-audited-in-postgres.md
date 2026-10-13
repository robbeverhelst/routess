# Admin Plan changes are audited in Postgres, not only in logs

Admins can now grant, extend and revoke Pro from the admin panel. Those changes move money-adjacent state (a revoke can end time a User paid for), so each one writes an `AdminAuditEntry` row in the same transaction as the Entitlement change: who acted, when, what changed (the action's input and the Plan before and after), and a required reason. Every admin request is still logged through Pino by `AuditInterceptor`; the table is the durable, queryable trail the admin panel shows on the User detail page. The grants themselves are ordinary Entitlement rows with source `admin`, read through the same Plan resolution the Pro gates use (`entitlements/plan-status.ts`), so there is no second Plan mechanism. We accept one more table and the rule that new admin actions that change a User's Plan must write an entry.

## Considered options

- **Audit table written in the action's transaction** — chosen: the entry cannot exist without the change or the other way round, it survives log retention, and the panel can show it next to the payments.
- **Pino log lines only (`AuditInterceptor`)** — rejected for Plan changes: no reason field, not visible in the app, and gone when log retention runs out. Kept for every other admin request.
- **Reuse the `manual` Entitlement source for admin grants** — rejected: `manual` stays the operator's out-of-band comp (a script or SQL), so the panel can tell an audited admin grant apart from one with no trail.

## Consequences

- Revoking marks the User's running Pro grants deleted (their rows stay, so history and the once-only OG marker survive), leaves a `source = admin` row ending now (an already-lapsed admin grant keeps its real end), and resets a stored Pro Plan to free. Refunds stay in Stripe; the panel only links to the payment's event in the Stripe dashboard, built from the stored event id.
- The metrics page's limit-to-Pro conversion hashes each payer's id (ADR 0020) to match Payments against `saved_route_limit_hit` and `generation_quota_hit` ProductEvents. It reports counts only, never which User converted.
- Audit entries outlive both Users: deleting either account clears the link and keeps the actor's email.
- Follow-up: other state-changing admin actions (soft-delete, session revoke) could move onto the same table if their trail ever needs a reason.

## References

- ADR 0039 (Plans and Entitlements), `apps/api/src/admin/admin-pro.service.ts`, `Migration20261013000000`.
