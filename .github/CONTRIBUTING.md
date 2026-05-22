# Contributing to routess

Thanks for your interest. This file is the short version; the full guide lives on the docs site at <https://docs.routess.com/docs/contributing>.

## Get set up

```bash
git clone https://github.com/robbeverhelst/routess.git
cd routess
bun install
cp .env.example .env  # fill in JWT_SECRET, GOOGLE_CLIENT_ID, VITE_MAPBOX_ACCESS_TOKEN
bun dev
```

You'll need [Bun](https://bun.sh) (version is pinned in `package.json` `packageManager`) and Docker.

## Before you open a PR

```bash
bun run ci   # postgres + format:check + lint + check-types + build + test
```

CI enforces production-strict TypeScript and Biome rules. If `bun run ci` passes locally, the GitHub workflow will too.

## Commit messages

Conventional Commits, scope is required:

```
type(scope): summary
```

- `fix(api): ...`, `feat(web): ...`, `refactor(routing): ...`
- Only `fix`, `feat`, `refactor`, `perf`, and breaking changes trigger releases. `chore`, `ci`, `docs`, `test`, `style`, `build` do not bump the version.

See [`docs/contributing/commit-conventions`](https://docs.routess.com/docs/contributing/commit-conventions) for full rules.

## Pull requests

- Reference the issue you're closing (`Closes #123`).
- Include a short test plan in the description.
- For UI changes, attach a screenshot or short clip.
- Keep PRs focused. Unrelated cleanups belong in their own PR.

## Reporting bugs and proposing features

Open a [GitHub issue](https://github.com/robbeverhelst/routess/issues/new/choose) with the appropriate template. For security issues, see [SECURITY.md](SECURITY.md) — do not open a public issue.

## License & contribution terms

routess is [MIT licensed](../LICENSE). By submitting a contribution, you agree that your contribution is licensed under MIT on the same terms.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.

## Where things live

- Domain glossary: [`CONTEXT.md`](../CONTEXT.md)
- Architecture decisions: [`docs/adr/`](../docs/adr/) (start with [`docs/adr/README.md`](../docs/adr/README.md))
- Agent / contributor conventions: [`docs/agents/`](../docs/agents/)
