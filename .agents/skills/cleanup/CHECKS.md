# Checks

What each family looks for, and how to detect it agent-side. Not every check fires every run; pick what the surface warrants. Each check notes the rulebook reference it leans on.

## Subtractive (remove cruft)

Mechanical, mostly safe. Every deletion still passes the verify gate (SKILL.md step 3) before it is proposed.

- **Dead exports** — exported symbols with no importer anywhere in the repo. Grep the symbol across all workspaces including dynamic and string forms before proposing.
- **Orphaned files** — modules not reachable from any entrypoint (app `main`, route, test, config). A file imported only by other dead files is also dead.
- **Unreachable code** — branches after early return, `if (false)`, conditions that cannot hold.
- **Commented-out code** — blocks of dead source left in comments. Delete; git is the history.
- **Unused dependencies** — packages in a workspace `package.json` with no import. Also the inverse: imported but undeclared deps (relying on hoisting). Check per workspace, not just root.
- **Orphaned assets** — images and static files under `apps/*/public` or `src/assets` with no reference.
- **Stale i18n keys** — keys in `packages/i18n` not used by any app. Match dynamic key construction carefully before flagging.
- **Dead feature flags / env** — flags and env vars read nowhere, or always one value.
- **Aging markers** — `TODO` / `FIXME` / `HACK`, oldest first by blame; `.skip` / `.todo` / `xfail` tests; temp instrumentation (stray `console.log`, debug timers) meant to be removed.

## Conformance (make new code fit what already exists)

The highest-value family for vibecoded work. Needs the whole-repo rulebook even on a diff surface.

- **Missed reuse / duplication** — logic reimplemented that `packages/core`, `api-client`, or `design-tokens` already exports; copy-pasted blocks; two functions doing one job. Cross-check against the reuse inventory. This is the headline check.
- **Convention drift** — does not follow the established shape: NestJS module layout, React feature-folder structure, file naming, the conventions in `docs/agents/*`.
- **Vocabulary drift** — names a concept with a term that conflicts with the `CONTEXT.md` glossary (classic: "account" vs "user", "cancel" vs "delete"). Hand to `grill-with-docs` (SKILL.md step 6).
- **ADR violations** — reintroduces something a decision rejected. Examples to watch: a platform branch in `api-client` (ADR-0010), a non-canonical waypoint type (ADR-0007), an error shape outside the shared domain-error protocol (ADR-0008), an access-control path other than `RouteVisibility` (ADR-0027). Check the relevant ADR, do not re-litigate it.
- **Boundary / layering violations** — `apps/web` reaching into `apps/api` internals, a `packages/*` importing app code, cross-context leakage, circular deps. If it is a real design problem rather than a stray import, hand to `improve-codebase-architecture`.

## Smell (make code clean in itself)

- **Code smells** — long functions, deep nesting, god files, magic numbers and strings, boolean-trap parameters, primitive obsession. Shallow modules (interface nearly as complex as the implementation) are a depth problem: hand to `improve-codebase-architecture`, do not fix shallowly here.
- **Type-safety erosion** — `any`, unjustified `as` casts, `@ts-ignore` / `@ts-expect-error` without reason, non-null `!`, accumulating `biome-ignore`. Routess runs Biome 2 and strict `tsc`; these are escapes from it.
- **Styling drift** — hardcoded colors or oklch values instead of `packages/design-tokens`, inline styles where a token or class exists, Tailwind class duplication that wants extraction.
- **Error / logging inconsistency** — `console.*` instead of the project logger, ad-hoc error shapes instead of the domain-error protocol (ADR-0008), swallowed errors.
- **Test gaps** — new behaviour on the surface with no test, skipped tests, tests asserting nothing.

## Detection notes

- Prefer the import graph over text search for "is this used," but always confirm a delete candidate with a text grep for dynamic and string references.
- A finding without a concrete `file:line` and a concrete fix is not ready to report. No vague "consider improving X."
- When uncertain whether something is intentional, check for an ADR or a `CONTEXT.md` term that explains it before flagging. Intentional, documented choices are not findings.
