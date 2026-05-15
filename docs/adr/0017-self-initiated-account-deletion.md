# Self-initiated account deletion: soft-delete + 30-day grace + hard-delete cascade

A User can delete their own account from settings. The action soft-deletes immediately (cascading to Routes and Sessions per ADR 0016) and schedules a hard-delete after a 30-day grace window. During the grace window the User can cancel by signing back in; after it, a scheduled job hard-deletes the User row, hard-deletes their Routes, and scrubs their `userId` from any retained domain events. This is a separate path from ADR 0016's admin-driven soft-delete, which remains indefinitely reversible by relogin.

## Context

ADR 0016 left hard-delete (GDPR Right to Erasure, Art. 17) explicitly out of scope: _"When first required it will get its own decision and a separate operational path."_ Issue #134 ("User and account system v1") is the trigger and requires a self-service deletion flow.

The existing soft-delete cascade (User → Routes → Sessions, login-relogin undeletes) is the right primitive for "user changed their mind" but is not GDPR-compliant on its own: data is hidden, not erased.

## Considered options

- **One-shot hard-delete with confirmation modal.** Rejected: a single misclick is irreversible. Consumer apps that do this (early Twitter) generated heavy support load for "I deleted by accident, please restore from backup."
- **Soft-delete only.** Rejected: not GDPR-compliant; the ticket explicitly requires erasure semantics.
- **Async deletion job triggered immediately.** Rejected: gives no recovery window and merges "I clicked the button" with "the data is gone" in a way that is harder to test and operate.

## Consequences

- A new column or status enum on `User` distinguishes _admin-soft-deleted_ (ADR 0016, undeletable on relogin) from _self-pending-hard-delete_ (this ADR, login lands on a "pending deletion, cancel?" screen instead of silently restoring). The ADR 0016 relogin-undelete path must check this flag before undeleting.
- Re-signup with the same email during the grace window is rejected with "account pending deletion." Treating re-signup as restore would confuse "fresh account" with "restore old account."
- A daily scheduled job hard-deletes Users past their grace window, cascades to Routes (`DELETE`, not soft-delete), and scrubs `userId` from retained domain events (replace with null or a stable hash; the events themselves are kept for analytics under Recital 26 once they can no longer be linked to a person).
- After hard-delete the email is freely reusable for a new signup; there is no Alice anymore.
- Operational metrics (Prometheus) and aggregate business analytics already contain no per-user PII and are not touched.
