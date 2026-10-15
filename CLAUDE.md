# Routess

Route-planning app for cyclists, runners, and hikers. See `CONTEXT.md` for the domain glossary.

## Stack

- Bun workspaces (`apps/*`, `packages/*`); no Turborepo, just `bun run --filter`
- `apps/api`: NestJS + PostgreSQL + MikroORM
- `apps/web`: React + Vite + Tailwind + Mapbox
- `apps/docs`: Next.js (Fumadocs)
- `apps/landing`: Next.js marketing site and public route pages
- `apps/cli`: `routess` CLI, published to npm
- `packages/*`: `core`, `api-client`, `i18n`, `design-tokens`
- Deploy: Docker images via `docker/docker-bake.hcl` → Helm chart in `charts/routess`

## Commands

```bash
bun dev              # all apps, auto-picks free ports
bun run format       # bun fmt (pinned canary)
bun run lint         # biome check (production-strict)
bun run check-types  # tsc across all workspaces
bun run test         # all tests
bun run ci           # full pipeline (postgres + format:check + lint + check:bun-native + check-types + build + test)
bun run clean        # nuke node_modules, dist, caches, docker volumes
bun run build:images # docker buildx bake all images
```

## Bun-native

- Prefer what Bun ships over an npm package: `bun test`, `bun build`, `Bun.password`, `Bun.$`, `Bun.file`, `Bun.Glob`, `Bun.YAML`, `.env` loading (`process.loadEnvFile`), running TypeScript directly.
- Check Bun first before adding a dependency; if one is still needed, say why in the PR.
- `bun run check:bun-native` (in CI) fails when a workspace depends on a package Bun replaces; the list lives in `scripts/bun-native-check.ts`.
- Not switching (no Bun equivalent that fits): ioredis, pg, Vite, Playwright, Next.js, NestJS, `ws` in NestJS, drizzle-kit.
- The npm publish job keeps Node + npm: `bun publish` has no npm trusted publishing (OIDC) or provenance yet.

## Commit convention

- Conventional Commits required: `type(scope): summary`
- `fix(scope): ...` for bug fixes; `feat(scope): ...` for features
- Scope is concrete: `web`, `api`, `auth`, `routing`, etc.
- Only `fix`, `feat`, `refactor`, `perf`, and breaking changes trigger releases. `chore`, `ci`, `docs`, `test`, `style`, `build` do not bump the version.

## Agent docs

- Issue tracker conventions: `docs/agents/issue-tracker.md`
- Triage labels: `docs/agents/triage-labels.md`
- SEO conventions: `docs/agents/seo.md`
- Domain conventions: `docs/agents/domain.md` and `CONTEXT.md`
- Architecture decisions: `docs/adr/`
