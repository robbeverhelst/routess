# Biome for linting and formatting

The repo uses Biome (`biome.json` at the root) as the single tool for linting and formatting across the entire monorepo, replacing the conventional ESLint + Prettier pair. Biome is one Rust binary with one config file, runs an order of magnitude faster on the full repo, and removes the ESLint/Prettier rule-overlap problem (no more "stylistic ESLint rules vs Prettier" dance). The trade-off is a smaller plugin ecosystem; we accept that because we don't run any custom lint rules today.

## Considered options

- **ESLint + Prettier** — rejected: slower, two configs, two plugin ecosystems to keep in sync.
- **dprint** — considered but Biome's lint rules cover what we need.

## Amendment (2026-10-15): formatting moved to bun fmt

Biome no longer formats. `bun fmt` (configured in the root `bunfig.toml`, run from a pinned Bun canary until a stable release ships it) formats the repo and sorts imports; `biome.json` has its formatter and import organizing turned off. Biome is still the linter.
