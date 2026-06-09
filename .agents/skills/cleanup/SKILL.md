---
name: cleanup
description: Post-sprint cleanup pass for the routess monorepo. Scans a chosen surface for dead code, unused deps, missed reuse, convention and vocabulary drift, ADR violations, and code smells, then reports, fixes the items you pick with verification, and commits per family. Use after weeks of coding or vibecoding, or when asked to clean up / tidy the repo, remove dead code, find duplication, or hunt code smells.
---

# Cleanup

A broad, fast tidy pass for code that works but does not yet fit how this repo does things. Vibecoded changes reinvent helpers that already exist, drift from the glossary and the established module shapes, and leave cruft behind. This skill finds that, reports it ranked by safety, and fixes what you approve.

It is deliberately tool-free (no knip, no depcheck): everything is agent-driven so the skill stays self-contained and portable. It is report-then-approve, never silent.

## Glossary

Use these terms exactly.

- **Family** — the three kinds of finding. **Subtractive** (remove cruft), **Conformance** (make new code fit what already exists), **Smell** (make code clean in itself). Full check list in [CHECKS.md](CHECKS.md).
- **Surface** — the code analysed this run: a changed diff, one workspace, or the whole repo. Chosen at the start (see Process step 0).
- **Rulebook** — the repo's own source of truth the Conformance family checks against: `CONTEXT.md`, `docs/adr/`, `docs/agents/`, and the public exports of `packages/*`.
- **Severity** — P1 / P2 / P3 impact. **Confidence** — high / med / low certainty the finding is real and safe to act on. Defined in [REPORT-FORMAT.md](REPORT-FORMAT.md).
- **Reuse inventory** — what `packages/core`, `packages/api-client`, `packages/design-tokens`, and `packages/i18n` already export. The thing reinvented code should have used.

Key principle: **the rulebook wins.** If code contradicts an ADR or the glossary, the code is the finding, not the rulebook. Never re-litigate a recorded decision; if a finding genuinely conflicts with an ADR's reasoning, mark it and hand off (see Process step 6).

## Process

### 0. Establish the surface

Ask which surface to scan (the hybrid frame):

- **Changed** — code touched since a git ref. Ask for the ref (a tag, a branch point like `main`, or "last N weeks" → resolve to a commit by date). This is the default for a post-sprint tidy.
- **Workspace** — one app or package, audited whole. Ask which (`apps/web`, `packages/core`, ...).
- **Whole repo** — everything. Warn it is noisy and re-surfaces known debt; better as an occasional deep pass.

Conformance and reuse checks always read the **whole-repo rulebook** even when the surface is a diff. The point of those checks is "you reinvented something that exists elsewhere," which a diff alone cannot see.

### 1. Load the rulebook

Read before scanning, so findings speak the repo's language:

- `CONTEXT.md` glossary (domain vocabulary).
- `docs/adr/README.md` index plus any ADR relevant to the surface.
- `docs/agents/*` (issue-tracker, triage-labels, seo, domain conventions).
- The public exports of `packages/*` for the reuse inventory.

### 2. Scan

Use the **Agent tool with `subagent_type=Explore`**, parallelised by family and workspace. Apply the checks in [CHECKS.md](CHECKS.md). Each finding carries: family, file:line, the problem, the proposed fix, and any rulebook reference (ADR id, glossary term, or package export it should reuse).

### 3. Verify before proposing any deletion

Hard gate. Before a Subtractive finding can be proposed for deletion, prove it is unreferenced: grep for dynamic imports, string references, i18n key usage, public-API re-exports, config and env references, and cross-workspace imports. Anything you cannot prove is unreferenced becomes **low confidence** and is reported, not proposed for removal. See [VERIFY-AND-COMMIT.md](VERIFY-AND-COMMIT.md).

### 4. Report

Present the findings using [REPORT-FORMAT.md](REPORT-FORMAT.md): severity x confidence, grouped by family, safe high-confidence wins first, speculative items clearly marked last. Then ask which to apply. Deferred findings are not routed anywhere; they resurface next run.

### 5. Apply what is picked

Fix in batches. For judgement-heavy Conformance items, grill briefly before changing rather than assuming the rewrite. Hand off where a specialist skill owns the work (step 6).

### 6. Hand off, do not reimplement

- **Genuine architectural depth or seam refactor** (shallow module, leaky boundary, circular dep that is really a design problem) → flag it and point the user to run `improve-codebase-architecture`. Do not attempt the deep refactor inside a cleanup pass.
- **Domain vocabulary drift** (a term conflicts with the `CONTEXT.md` glossary) → apply the `grill-with-docs` discipline: sharpen the term, update `CONTEXT.md` inline, and offer an ADR only if the decision is hard to reverse, surprising, and a real trade-off.

### 7. Verify and commit per family

After each batch: `bun run lint`, `bun run check-types`, and tests for the affected workspaces; full `bun run test` at the end. Then commit each family as its own Conventional Commit, grouped by scope, choosing the commit type to control release impact (recall: `refactor`, `perf`, `fix` bump a release; `chore`, `test`, `style`, `docs` do not). Never push. Full policy in [VERIFY-AND-COMMIT.md](VERIFY-AND-COMMIT.md).
