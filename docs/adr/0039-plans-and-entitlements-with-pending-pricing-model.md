# Gate Features through Plan and Entitlement checks; sell a Pro year pass through Stripe

**Status:** Decided by Robbe on 2026-10-10 (#135). The groundwork (Plan, Entitlement, `can()`, the provider seam) was accepted first; the pricing model, provider and Pro contents are now decided as recorded under [Decision](#decision). Everything still sits behind `BILLING_ENABLED`, which defaults to false.

Every User gets a **Plan** (`free` by default). An **Entitlement** table holds per-User grants on top of the Plan: one Feature, or the whole Pro Plan for a while. The API answers `can(user, feature)` against a closed, typed **Feature** list (`apps/api/src/entitlements/features.ts`) and resolves the Plan in effect from the stored Plan plus any running Pro grant. A provider-neutral billing seam (`apps/api/src/billing/`) has one implementation, Stripe. With billing off, every Feature is unlocked and one generation quota applies to everyone. That keeps self-hosted instances ungated, so the MIT/self-host story stays intact.

## Decision

Decided on 2026-10-10:

- **Model: B, a Pro year pass.** €29.99 incl. VAT, one-off payment, no subscription. A pass is a Pro Entitlement (`plan = 'pro'`, source `billing`) for 365 days from the payment. Buying again extends from the current Pro expiry, so no paid day is lost.
- **Provider: Stripe** (Robbe already has an account). Stripe Checkout in payment mode, payment methods Bancontact, iDEAL and card. The seller is Robbe (robbeverhelst, under Robbe's own VAT number); there is no merchant of record.
- **What Pro is:** a higher `route_generation` quota, nothing else for now. Free keeps `node_network_generation`, `collections`, saved routes and `personal_access_tokens`, so `PLAN_FEATURES.free` still equals `pro`. The daily RouteGeneration allowance per tier is config, not code: free signed-in **3/day** (`GENERATION_QUOTA_PER_DAY_FREE`), Pro **50/day** (`GENERATION_QUOTA_PER_DAY_PRO`, today's cap).
- **Anonymous** (proposed in the PR, config `GENERATION_QUOTA_PER_DAY_ANONYMOUS`): **1/day per IP**. One try shows the feature; signing in, which is free, triples it. The quota is keyed by IP for signed-out callers, so a shared network shares that one attempt, which is acceptable because the free account is the way out.
- **Existing users keep everything they have,** and every account created before the billing launch (`BILLING_LAUNCHED_AT`) gets **three months of Pro free on its next login**: the "OG user" grant. It is an Entitlement with source `og-grant` and an expiry, granted once per User (the row's existence is the marker, checked under a row lock) and extending any Pro time the User already holds. A User whose session outlives the launch gets it the next time the app reads the billing status.

### How it works

- `POST /billing/checkout` (session cookie only, so a PAT cannot spend money) creates a Checkout Session with the User id as `client_reference_id` and in metadata, and returns its URL. Stripe returns the browser to `/upgrade?checkout=success|cancelled`; that page only shows a message and fires the `payment_*` ProductEvent.
- `POST /billing/webhook` verifies the `Stripe-Signature` header over the raw body (`rawBody: true` in `main.ts`; the async verifier, since the API runs on Bun). `checkout.session.completed` with `payment_status = 'paid'` is the source of truth. All three payment methods confirm immediately; a delayed method such as SEPA would also need `checkout.session.async_payment_succeeded`.
- Idempotency: the `payment` table has unique provider event ids and checkout refs. The webhook takes the User row lock, inserts the payment with `on conflict do nothing`, and only extends the pass when the insert happened. A redelivered or concurrent event is acknowledged with 200 and changes nothing.
- `GET /billing` (anonymous or signed in) reports whether billing is on, the offer with its Stripe price, the allowance per tier, and the account's Plan, Pro expiry and OG grant.
- The generation quota guard answers 429 with `details: { reason: 'generation_quota', limit, tier, upgrade }`. The web turns that into a sign-in prompt for anonymous users and a link to `/upgrade` for free users.
- **Cancel and account deletion:** a pass does not renew, so there is nothing to cancel at Stripe and no Stripe Customer is created. A cancelled checkout charges nothing. An account pending deletion cannot start a checkout. On hard delete, Entitlements cascade (remaining Pro time ends) and `payment` rows stay for bookkeeping with `user_id` cleared. A payment that arrives for a User who no longer exists is recorded without a grant and logged for a manual refund. Refunds are done by hand in the Stripe dashboard; revoking the matching Entitlement is a manual step for now.

## What the app has today that a Plan could gate

None of these is gated today. The only limits are throttles and the generation quota.

| Feature (`features.ts`) | Where it lives | Today |
|---|---|---|
| `route_generation` | `POST /generation`, `apps/api/src/generation/generation.controller.ts:27` | Live for everyone, including anonymous users. Capped at 50/day per user or IP (`GENERATION_QUOTA_PER_DAY`, `generation-quota.guard.ts`) |
| `node_network_generation` | `preferNodeNetworks`, `apps/api/src/generation/dto/generate.dto.ts:138` | Live, needs `NODE_TILES_URL` |
| `navigation` | `POST /routing/cues`, `apps/api/src/routing/routing.controller.ts:59` | Experimental, hidden behind a per-device web flag (`apps/web/src/stores/redesignSettingsStore.ts:92`) |
| `collections` | `/collections`, `apps/api/src/collections/collections.controller.ts:47` | Live, no count cap |
| `unlimited_saved_routes` | `POST /routes`, `apps/api/src/routes/routes.controller.ts:73` | No cap on saved routes |
| `gpx_export` | `GET /routes/:ref/gpx`, `routes.controller.ts:162`, plus client-side blob export | Live, open to anonymous users |
| `personal_access_tokens` | `/auth/tokens`, `apps/api/src/auth/personal-access-tokens.controller.ts:40`, and the CLI | Live |

Some things should stay free whatever the model:
- **Cannot be enforced server-side:** elevation is computed in the browser, and the knooppunten overlay is public PMTiles.
- **Promised free on the landing page** (`apps/landing/lib/content/en.ts:123`): planning, GPX in/out, unlimited saved routes, public sharing, and surface and elevation data.
- **Required by GDPR:** the data export.

"Heatmaps & advanced layers" and AI prompt generation, both listed as Pro on the landing page, do not exist in code. Route generation, also listed there as Pro, is already free and live.

## Considered options

Prices are VAT-inclusive, which is what BE and NL consumers expect.

- **A. Free + Pro subscription** (proposed price: €3.99/month or €34.99/year). Pro unlocks:
  - `node_network_generation` and `navigation`
  - `route_generation` above a small free allowance, e.g. 3/day signed in. This needs per-Plan quota values.
  - `collections` and `personal_access_tokens`, with grandfathering for existing users.

  This gives recurring revenue and a monthly price below Komoot. It is also the most work: recurring mandates, dunning, cancel and manage flows, and cancelling on account deletion.
- **B. Free + Pro year pass, one-time and non-renewing** (proposed price: €29.99 for 12 months). It gates the same Features as A. A pass is one payment that writes an `Entitlement` with `expires_at` = +12 months, and a reminder email goes out before it expires.
  - Bancontact and iDEAL are native one-off payments here, so there are no mandates, no dunning and no portal.
  - It is the least build, and it tests willingness to pay while the Pro value is still thin.
  - Revenue does not renew on its own.
- **C. No gating; a voluntary "Supporter" payment** (pay-what-you-want, from €2/month or €24/year). It keeps every landing promise as-is. Supporters get a badge and a higher generation quota. It is the lowest risk, earns the least, and leaves #135's "entitlements" mostly unused.

Self-host stays free (MIT) under every option. `BILLING_ENABLED=false` means nothing is gated.

### Comparable apps

All accessed 2026-10-09 from Belgium. The App Store figures are in-app prices; the interval for each is inferred.

| App | Price | Source |
|---|---|---|
| Komoot Premium | €4.99 / €59.99 | [App Store BE](https://apps.apple.com/be/app/komoot-hike-bike-run/id447374873). The web price sits behind a login. |
| Komoot World Pack (one-time) | €29.99 | [komoot.com/nl-nl/shop](https://www.komoot.com/nl-nl/shop) |
| RouteYou Plus | €3.99–4.99 / €35.99–42.99 | [App Store BE](https://apps.apple.com/be/app/routeyou-walking-and-cycling/id942989228). routeyou.com was not reachable. |
| Ride with GPS Basic | $9.99 / $59.99 (USD even from Belgium) | [ridewithgps.com/pricing](https://ridewithgps.com/pricing) |
| Wikiloc Premium | €19.99/year | [App Store BE](https://apps.apple.com/be/app/wikiloc-trails-of-the-world/id432102730) |

The positioning is "everything Komoot charges €60/yr for, free" (#248). So the Pro price should sit at or below RouteYou and well under Komoot.

### Stripe vs Mollie

Fees are from [stripe.com/en-be/pricing](https://stripe.com/en-be/pricing) (no page date) and [mollie.com/be/pricing](https://www.mollie.com/be/pricing) (page dated 2026-10-08), both accessed 2026-10-09. "Per payment" means on the VAT-inclusive price.

| | Stripe (BE) | Mollie (BE) |
|---|---|---|
| EEA consumer card | 1.5% + €0.25 | 1.80% + €0.25 |
| Bancontact | €0.35 | €0.39 |
| iDEAL \| Wero | €0.29 | €0.32 |
| SEPA Direct Debit | €0.35 (a failed debit costs €3.50) | €0.35 |
| Subscription fee | Billing: +0.7% of volume | none, recurring is included |
| Bancontact → recurring | Not in Checkout ("Recurring payments: No", [docs](https://docs.stripe.com/payments/bancontact)). Needs a custom SEPA-mandate flow. iDEAL → SEPA DD works in Checkout ([docs](https://docs.stripe.com/billing/subscriptions/ideal)). | Built in: a first Bancontact or iDEAL payment creates a SEPA DD mandate ([docs](https://docs.mollie.com/docs/recurring-payments), updated 2026-05-18) |
| Hosted customer portal | yes | none, so Routess builds its own cancel/manage page (#135 asks for a billing settings page anyway) |
| VAT | Stripe Tax 0.5%/txn; Managed Payments (merchant of record) +3.5%, open to BE businesses ([link](https://stripe.com/en-be/managed-payments)) | No tax feature |

Fees per payment:
- **A on Mollie:** about €0.35 on a €3.99 monthly charge (8.8%) and €0.35 on €34.99 yearly (1.0%), both by SEPA DD.
- **A on Stripe:** about €0.38 (9.5%) and €0.60 (1.7%), SEPA DD plus Billing.
- **B (€29.99):**
  - Bancontact: Stripe €0.35, Mollie €0.39 (about 1.2%)
  - iDEAL: Stripe €0.29, Mollie €0.32
  - card: Stripe €0.70, Mollie €0.79
- **Merchant of record:** Paddle's 5% + €0.50 ([paddle.com/pricing](https://www.paddle.com/pricing)) would take €2.00 of a €29.99 pass and €0.70 of a €3.99 month.

Monthly pricing loses about 9% to fees under either provider, so yearly should be the headline price.

## Recommendation (2026-10-09, superseded by the Decision)

The proposal was B on Mollie, for native Bancontact recurring if passes later turned into a subscription. Robbe chose B on Stripe because Robbe already has a Stripe account. For a one-off pass, Stripe's Bancontact, iDEAL and card fees are slightly lower than Mollie's (see the table above), and the native-recurring advantage only matters for model A.

## Consequences

- **Positive:**
  - Every later gate is a one-line `can()` call plus a Feature moving out of `PLAN_FEATURES.free`.
  - Self-host can never hit a paywall.
  - Pro state is written only by the webhook, so the API stays the source of truth (#135).
  - No mandates, dunning, portal or subscription state to keep in sync.
- **Negative:**
  - Revenue does not renew on its own; a reminder before a pass expires needs the email system (#343).
  - The API needs four more values to boot with billing on, and refuses to start without them.
  - Anonymous generation drops from 50 to 1 a day per IP once billing is on.
- **Follow-ups:**
  - a pass-expiry reminder email (#343)
  - landing copy: drop the Pro features that do not exist, and fix the "generation not live" teaser
  - terms and privacy naming the seller and Stripe as processor (PR #372)
  - refunds through the `charge.refunded` webhook instead of by hand, if they become common

## Questions for Robbe (answered 2026-10-10)

1. **Model:** B, the year pass.
2. **What is Pro:** a higher `route_generation` quota (free 3/day signed in, Pro 50/day). Existing users keep everything, plus three months of Pro as OG users.
3. **Price:** €29.99 incl. VAT for 365 days.
4. **Provider:** Stripe, no merchant of record.
5. **Seller:** Robbe (robbeverhelst), under Robbe's VAT number.

## References

- #135 Payments and entitlements v1; #248 competitive positioning; `docs/agents/product-events.md` (`payment_*` events).
- Sources were captured on 2026-10-09 and are linked inline above.
