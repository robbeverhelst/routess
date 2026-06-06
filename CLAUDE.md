# Routess

Route-planning app for cyclists, runners, and hikers. See `CONTEXT.md` for the domain glossary.

## Stack

- Bun workspaces (`apps/*`, `packages/*`); no Turborepo, just `bun run --filter`
- `apps/api`: NestJS + PostgreSQL + MikroORM
- `apps/web`: React + Vite + Tailwind + Mapbox
- `apps/docs`: Next.js (Fumadocs)
- `packages/*`: `core`, `api-client`, `i18n`, `design-tokens`
- Deploy: Docker images via `docker/docker-bake.hcl` → Helm chart in `charts/routess`

## Commands

```bash
bun dev              # all apps, auto-picks free ports
bun run lint         # biome check (production-strict)
bun run check-types  # tsc across all workspaces
bun run test         # all tests
bun run ci           # full pipeline (postgres + format:check + lint + check-types + build + test)
bun run clean        # nuke node_modules, dist, caches, docker volumes
bun run build:images # docker buildx bake all images
```

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
