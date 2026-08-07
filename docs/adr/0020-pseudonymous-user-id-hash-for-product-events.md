# ProductEvents carry a pseudonymous `user_id_hash`, never the raw `user_id`

Authenticated ProductEvents (see ADR-0019) attach `user_id_hash = sha256(server_salt + user_id)` instead of the raw Routess user primary key. The salt is an API-side environment variable (Kubernetes secret in production) that is never exposed to the browser; the API computes the hash and returns it on the profile endpoint alongside the existing user fields. The web stores `user.idHash` and attaches it as an event property — the web bundle never has the material needed to derive a hash from a user ID. Anonymous events carry no user identifier; the daily-rotating Umami visitor ID stitches their session within a 24h window. Every event also carries `signed_in: boolean` so signed-in and signed-out segments can be separated without joining.

GDPR deletion of a single user's behavioural trail runs as part of the hard-delete cron: the API computes that user's `user_id_hash` from the salt and the user ID, erases the matching Umami events, then proceeds with the existing purge (ADR-0017). Erasure must happen before the `user` row goes, because the hash is derived from the user ID.

> **Update:** this ADR originally specified "calls Umami's admin API". Umami has no delete-by-property endpoint — the only destructive API is a website-wide reset — so `AnalyticsErasureService` issues a direct `DELETE` against Umami's own Postgres (`event_data` joined to `website_event`), configured via `UMAMI_DATABASE_URL` + `UMAMI_WEBSITE_ID`. That couples us to two Umami tables which have been stable across v2. Erasure is best-effort: unconfigured or failing, it logs and the account deletion proceeds regardless, because stranding accounts in `pending_hard_delete` is the worse failure. Revisit if Umami ships a real deletion endpoint.

Analytics also carries a per-device opt-out (`analyticsEnabled` in the settings store, plus the browser's Do Not Track signal). It gates both `trackEvent` and the tracker `<script>` loader in `index.html`, so opting out stops pageview autotracking too, not just custom events. ProductEvents run on legitimate interest; this is the Art. 21 objection mechanism, which is what lets `user_id_hash` exist without a consent banner.

## Considered options

- **Strict anonymous (no user identifier at all)** — rejected: makes cross-session retention and funnel questions impossible. A user who plans a route on phone Monday and saves on laptop Tuesday counts as two unrelated visitors. Issue #131 explicitly calls out funnel and retention as in-scope questions.
- **Plain `user_id` as an event property** — rejected: trivial to implement and easy to delete via Umami's API, but scatters the Routess primary key across an observability store accessed by more people than the production `user` table. ADR-0014 already forbids `user_id` as a Prometheus label; the same spirit applies to Umami even though it is self-hosted. Pseudonymisation is the cheap insurance against future export / dump / role-creep scenarios.
- **Per-user random opaque ID stored on the user record** — rejected: equivalent privacy properties to the salted hash but adds a column, a migration, and a backfill. The hash is stateless and re-derivable on demand from the salt + the existing user ID.
- **Hash on the web client with a salt shipped in the bundle** — rejected: any reader of the JavaScript bundle recovers the salt and can rebuild the `user_id → user_id_hash` mapping for any guessable ID. That is plain `user_id` with extra steps. The hash must be computed where the salt lives, i.e. the API.

## Consequences

- Rotating the salt invalidates every historical `user_id_hash` for every user — funnels and retention queries across the rotation boundary break. Treat the salt as a long-lived secret; rotate only on suspected compromise, accepting the analytics discontinuity.
- Joining Umami events to Postgres data for ad-hoc analysis requires running the hash over a `user_id` via the API. This is intentional friction: ad-hoc deanonymisation should be a deliberate, auditable act, not a casual query.
- Login latency gains one SHA-256 per profile response. Negligible.
