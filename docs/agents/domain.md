# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one `CONTEXT.md` at the root and one `docs/adr/` directory.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — domain glossary for the Routess product.
- **`docs/adr/`** — read any ADRs that touch the area you're about to work in.

If a specific file doesn't exist yet, proceed silently. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-monorepo-with-turborepo.md
│   ├── 0002-zustand-for-state-management.md
│   └── …
├── apps/
│   ├── api/
│   ├── web/
│   └── docs/
└── packages/
    ├── core/
    ├── api-client/
    ├── i18n/
    └── design-tokens/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0003 (self-hosted CI instead of EAS) — but worth reopening because…_
