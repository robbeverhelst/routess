# Verify and commit

Two gates: the **verify-before-delete** gate (before proposing), and **verify-then-commit** (after applying).

## Verify before delete (the proposal gate)

A Subtractive finding may only be proposed as a removal once proven unreferenced. Search, across all workspaces, for:

- static imports of the symbol or file;
- dynamic imports and `require`;
- string references (symbol name in a string, a route path, a config value);
- i18n key usage, including dynamically constructed keys;
- public-API re-exports (a package `index` barrel);
- env and config references.

If every search is clean, the finding is **high confidence** and offered for removal. If any search is ambiguous, downgrade to **low confidence**, report it with the reason, and do not delete.

## Verify after applying (per batch)

Apply fixes in batches. After each batch:

1. `bun run lint` (Biome).
2. `bun run check-types` (tsc across workspaces).
3. Tests for the affected workspaces: `bun run --filter <ws> test`.

At the very end, run the full `bun run test` once. Per the project rule, tests run before anything is considered done, not just lint and types.

If a batch fails, stop, surface the failure, and fix or revert that batch before moving on. Never commit a red batch.

## Commit per family

After a family's batch is green, commit it. One Conventional Commit per family per scope (a family can split across scopes; do not cross scopes in one commit).

- **Scope** is concrete: `web`, `api`, `core`, `routing`, `i18n`, `auth`, etc. Match the workspace or domain area.
- **Type controls release impact.** `refactor`, `perf`, `fix` trigger a release; `chore`, `test`, `style`, `docs` do not. Choose deliberately:
  - Removing dead code or unused deps (behaviour unchanged): `chore`.
  - Restructuring to reuse an existing module, or fixing convention/boundary drift (behaviour unchanged but code changed meaningfully): `refactor`.
  - Correcting a real bug found during cleanup: `fix`.
  - Test-only or style-only changes: `test` / `style`.
- Before committing, **tell the user which commits will trigger a release** so a tidy pass does not ship an unintended version bump.

Example commit set for one run:

```
chore(web): remove dead exports and unused assets
refactor(core): reuse haversineMeters instead of local distance()
refactor(api): route errors through the domain-error protocol
test(web): add missing coverage for the route editor
```

**Never push.** Leave the commits on the branch for the user to review and push themselves.
