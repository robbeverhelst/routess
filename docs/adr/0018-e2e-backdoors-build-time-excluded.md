# E2E test-support endpoints are excluded at build-time, not gated at runtime

The NestJS API exposes one E2E backdoor, `POST /test/login`, which mints a session JWT for a given email by reusing the real `auth.issueSession`. It lives at `apps/api/src/test-support/`. The `TestSupportModule` is imported only by `app.test.module.ts` (used by `bun dev` and the E2E API container). The production entry, `app.module.ts`, does not import it. The production Docker stage builds from `app.module.ts`, so the prod image **physically does not contain** the test-support code.

Three additional layers gate the endpoint even in test builds: the module refuses to register unless `E2E_TEST_LOGIN_SECRET` is set, `NODE_ENV !== "production"`, and the connected DB name matches a test pattern (`*_e2e` or `*_test`). Each request must carry the secret in the `x-test-secret` header. These are belt-and-suspenders. The load-bearing defense is build-time exclusion: misconfiguration cannot expose what is not in the binary.

DB reset between tests does **not** go through an HTTP endpoint at all. Playwright connects to Postgres directly via the `pg` client (`apps/web/e2e/support/db.ts`) and TRUNCATEs in `beforeEach`. The API binary therefore contains no "wipe everything" code path. The attack surface for that operation is a Postgres credential, not an HTTP route.

## Considered options

- **Single runtime-gated test endpoint for both login and reset** — rejected: a `TRUNCATE ... CASCADE` endpoint reachable from any HTTP client, even gated by env + secret, has catastrophic blast radius if config drift, secret leak, or a misconfigured Helm values file ever exposes it. Runtime gates rely on configuration being correct; build-time exclusion makes the question moot.
- **No test-login endpoint either; Playwright signs its own JWT with `JWT_SECRET`** — rejected: tests would re-implement the session JWT shape (claims, expiry, signing algorithm) and silently drift from `auth.issueSession`. Reusing the real session-issuance code keeps test/prod parity for the part of auth that matters.
- **Pre-seeded `storageState` from a one-time real Google login** — rejected for CI use: sessions expire on a weeks-long cadence, breaking the suite until someone manually re-logs-in.

## Consequences

- The API has two module compositions (`app.module.ts` for prod, `app.test.module.ts` for dev/E2E), and the Dockerfile builds the prod stage explicitly from the former. Future modules added for tests must follow the same pattern.
- Bypassing Google OAuth in E2E means the credential-verification path (Google ID token → JWKS → session) is not exercised end-to-end. That path is covered by unit tests on `auth.issueSession` against known sample tokens; E2E covers the post-auth flow.
- The `pg`-client DB reset assumes Playwright has the test DB credentials. The test DB instance is separate from prod by name and connection string; even credential leak only affects the test DB.
- ADR-0015's `ADMIN_EMAILS` reconciliation runs through `auth.issueSession` like any other login, so seeding an admin user via `/test/login` works for free as long as the email is in the test environment's `ADMIN_EMAILS`.
