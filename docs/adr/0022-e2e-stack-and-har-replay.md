# E2E tests run against the real backend; external services are HAR-replayed

The Playwright E2E suite (`apps/web/e2e/`) runs against a real `apps/api` + Postgres stack. No MSW or service-level mocking sits between the web app and the API. External services that the web frontend calls directly (Mapbox Map Matching, Mapbox Terrain RGB, public Valhalla `trace_attributes`) are intercepted with Playwright's built-in HAR record/replay (`page.routeFromHAR`). Fixtures are recorded once against the real services with `E2E_RECORD=1`, committed under `apps/web/e2e/fixtures/har/`, and replayed deterministically on every CI run.

A scheduled workflow (`e2e-har-refresh.yml`, Mondays 07:00 UTC) re-runs in record mode and opens a PR if any HAR changed. That catches Mapbox or Valhalla response-shape drift without paying network cost, quota, or community-server load on every PR.

The contracts that matter most for E2E coverage, the `directFlags` ↔ `type` adapter in `@routess/api-client` (flagged in CONTEXT.md), the save/load round-trip through NestJS + Postgres, the share-link encode/decode, are all owned in-house and run end-to-end. Faking them via MSW would re-introduce a fictional seam (cf. ADR-0010's "one-adapter-means-hypothetical-seam" rule). External-service responses, by contrast, can't be meaningfully asserted against: Mapbox map data updates regularly, and any "Distance = 5.42 km" assertion eventually breaks for non-bug reasons. Recording once and replaying gives realism without the flake.

## Considered options

- **MSW-mocked API end-to-end** — rejected: replaces the parts of the system we actually wrote with a parallel fixture system that drifts from reality. The api-client adapter, the most bug-prone seam, becomes invisible.
- **All-real, including Mapbox and Valhalla in CI** — rejected: ~1-2% network flake per run, eats Mapbox quota, hammers a community-hosted Valhalla, and assertions can't depend on geometry the upstream service may legitimately change.
- **Hand-curated JSON fixtures via `page.route`** — rejected: smaller files but every fixture is written by hand and can drift from the real response shape silently. HAR is generated from real responses, so first-write authenticity is built in.

## Consequences

- HAR files are committed to the repo and grow with the suite. They are test data, not source: diffing them in PRs is mostly noise. Rely on the scheduled refresh PR to surface real upstream changes.
- "Mapbox is down" or "Valhalla returned a 500" is not caught by E2E. That is a job for synthetic monitoring against prod, intentionally out of scope here.
- "Real backend" includes Postgres, so DB reset between tests is required (see ADR-0023).
