# E2E gates release; flakes get fixed, not retried away

The `e2e` job in `.github/workflows/ci.yml` runs in parallel with `test` and `helm-validate`, on every PR and every push to `main`, and is included in `release.needs`. A failing E2E run blocks a release just as a failing unit test does. The retry budget in Playwright is `retries: 1` in CI and `0` locally, enough to absorb genuinely transient flakes (network timing, Playwright internals), not enough to launder a consistently broken test (1 retry × 90% per-attempt reliability → 99% apparent green).

Flake hygiene rule: any test that consumes a retry more than once per week, sustained for two consecutive weeks, gets `test.skip`'d with a TODO and a linked issue. The retry budget exists to absorb noise, not to mask broken tests; a test that depends on retries to pass is dishonest signal. Re-enabling requires a fix, not "let's try again." This is enforced by review, not tooling: Playwright's HTML reporter labels retries explicitly, and the weekly skim sits with whoever is on rotation.

The alternative (letting `release` proceed when E2E fails, or `retries: 2`+) defeats the point of having E2E. The whole reason it exists is to answer "is this shippable"; making it advisory makes it noise.

## Considered options

- **`retries: 0`** — rejected: a single network blip (e.g., Postgres healthcheck timing on a cold runner) fails the build with no signal-to-noise discrimination. One retry covers the genuine transient class.
- **`retries: 2` or higher** — rejected: hides flakes behind retries. A 50%-reliable test passes ~88% of the time with 2 retries; the suite reports green while the underlying behavior is broken half the time. The retry budget should be load-bearing for real noise, not for laundering bugs.
- **E2E job is non-blocking (advisory)** — rejected: an advisory test suite gets ignored. If a release ships against a red E2E, the convention dies the day it's introduced.
- **Allow flaky tests to remain enabled with `test.fixme`** — rejected: `test.fixme` keeps the test in the report as "expected to fail." A flaky test isn't expected to fail; it's expected to fail *sometimes*. `test.skip` plus a tracked issue is a clearer state.

## Consequences

- A genuinely broken E2E test blocks `main` until fixed or skipped. This is the desired pressure but means the on-call rotation must include "fix or skip the failing E2E" as a known task type.
- The Mondays HAR refresh PR (per ADR-0017) can fail E2E if a Mapbox response shape changed. That is the right signal: refusing the refresh PR until the suite is updated is the same convention as any other breaking-change response.
