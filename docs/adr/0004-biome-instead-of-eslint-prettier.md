# Biome for linting and formatting

The repo uses Biome (`biome.json` at the root) as the single tool for linting and formatting across the entire monorepo, replacing the conventional ESLint + Prettier pair. Biome is one Rust binary with one config file, runs an order of magnitude faster on the full repo, and removes the ESLint/Prettier rule-overlap problem (no more "stylistic ESLint rules vs Prettier" dance). The trade-off is a smaller plugin ecosystem; we accept that because we don't run any custom lint rules today.

## Considered options

- **ESLint + Prettier** — rejected: slower, two configs, two plugin ecosystems to keep in sync.
- **dprint** — considered but Biome's lint rules cover what we need.
