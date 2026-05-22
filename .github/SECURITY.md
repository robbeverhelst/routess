# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in routess, please report it privately. **Do not** open a public issue.

1. Open a [private security advisory](https://github.com/robbeverhelst/routess/security/advisories/new) on GitHub.
2. Describe the issue with enough detail to reproduce it (steps, version, deployment shape).
3. Give us a reasonable amount of time to fix it before any public disclosure.

We aim to **acknowledge new reports within 5 business days** and to ship a fix or a documented mitigation as fast as we reasonably can, scaled to severity. Critical issues take priority over everything else.

## Supported Versions

Only the latest release of routess receives security updates. We don't backport fixes to older minor versions; upgrade to the latest tag before reporting an issue that may already be fixed.

## Supply chain & dependencies

- Dependencies are managed by [Renovate](renovate.json) and reviewed in PRs.
- Container images are built from minimal bases (`nginx:alpine`, `node:20-alpine`), run as non-root with `readOnlyRootFilesystem` where possible, and drop all Linux capabilities. See [ADR-0006](../docs/adr/0006-kubernetes-deny-all-network-policy-baseline.md) for the Kubernetes baseline.
- Personal access tokens are hashed with HMAC-SHA-256 using a server-side pepper, and the plaintext is shown to the user exactly once. See [ADR-0022](../docs/adr/0022-personal-access-tokens-for-non-browser-clients.md).
- Secrets must never be committed to the repository. The `.env.example` and `docker/.env.selfhost.example` files document required variables with placeholders only.

## Scope

In scope:
- The routess web app, API, CLI, and docs site
- The official Docker images at `ghcr.io/robbeverhelst/routess-*`
- The Helm chart at `charts/routess`

Out of scope:
- Vulnerabilities in upstream dependencies that we have not yet patched (please report those to the upstream project)
- Findings that require a privileged position on the host or cluster running routess
- Self-hosted instances misconfigured in ways the docs warn against (e.g. running with a default `JWT_SECRET`)
