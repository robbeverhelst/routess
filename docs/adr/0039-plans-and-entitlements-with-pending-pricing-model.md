# Gate Features through Plan and Entitlement checks; choose the pricing model separately

**Status:** groundwork accepted, pricing model and provider **proposed, awaiting Robbe** (#135).

There is no payment code yet, and the pricing model is still open. This ADR fixes the part that does not depend on that choice. Every User gets a **Plan** (`free` by default). An **Entitlement** table holds per-User Feature grants on top of the Plan. The API answers `can(user, feature)` against a closed, typed **Feature** list (`apps/api/src/entitlements/features.ts`). A provider-neutral billing seam (`apps/api/src/billing/`) sits behind `BILLING_ENABLED`, which defaults to false. With billing off, every Feature is unlocked. That keeps self-hosted instances and today's hosted app ungated, so the MIT/self-host story stays intact. No endpoint calls `can()` yet. The trade-off is a little unused code until the questions at the end are answered.

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

## Recommendation

**B on Mollie: a €29.99 Pro year pass paid with Bancontact, iDEAL or card.**
- Pro holds `node_network_generation`, `navigation` (once it leaves experimental) and a higher `route_generation` quota.
- Existing users keep `collections`, saved routes and PATs.

Why:
- Bancontact is how Belgians pay online, and it is a plain one-off payment under B.
- The Entitlement table already models a pass, so nothing extra is needed for it.
- No mandates, no dunning and no portal means the shortest path to a first euro.
- If passes sell, move to A on Mollie Subscriptions. Mollie's recurring flow starts with the same first Bancontact or iDEAL payment, and the Plan/Entitlement seam does not change.

Pick Stripe instead only if an existing Stripe account, Stripe Tax or Managed Payments (to offload VAT OSS) matters more than native Bancontact recurring.

## Consequences

- **Positive:**
  - Every later gate is a one-line `can()` call plus a Feature moving out of `PLAN_FEATURES.free`.
  - Self-host can never hit a paywall.
  - The Plan is written only by the billing webhook, so the API stays the source of truth (#135).
- **Negative:**
  - `PLAN_FEATURES.free` currently equals `pro`, and no endpoint calls `can()`. That is deliberate, but the code is unused until the decision lands.
  - Turning `BILLING_ENABLED` on today stops the API from starting. This is on purpose: no provider implementation exists yet.
- **Follow-ups once the questions are answered:**
  - a provider implementation, plus checkout and webhook endpoints
  - per-Plan generation quota
  - a web paywall and billing settings page
  - `payment_*` ProductEvents
  - cancelling on account deletion
  - landing copy: drop the Pro features that do not exist, and fix the "generation not live" teaser
  - terms and privacy (PR #372)

## Questions for Robbe

1. **Model:** A (subscription), B (year pass) or C (supporter only)?
2. **What is Pro:** which of `route_generation` (and what free daily allowance), `node_network_generation`, `navigation`, `collections`, `personal_access_tokens`? Do existing users keep what they already use?
3. **Price:** €29.99/year pass, or €3.99/month and €34.99/year? Both are VAT-inclusive.
4. **Provider:** Mollie (native Bancontact recurring, no portal), or Stripe (do you already have an account with products? It has a portal and Tax)? Should a merchant of record take VAT OSS off your hands?
5. **Seller:** which legal entity and VAT number sells, so that invoices, the terms and privacy (#372) and the landing copy can name it? Is the "save unlimited routes, free" promise permanent?

## References

- #135 Payments and entitlements v1; #248 competitive positioning; `docs/agents/product-events.md` (`payment_*` events).
- Sources were captured on 2026-10-09 and are linked inline above.
