# Architecture Decision Records

This directory captures decisions that are **hard to reverse**, **surprising without context**, and the result of **a real trade-off**. If a future contributor would ask "why is it done this way?", an ADR should answer it.

Use the [template](0000-template.md) when adding a new one. Number sequentially from the highest existing ADR; do not reuse a number even if you see historical collisions in this index.

> **Note:** ADRs 0014, 0017, 0018, 0019, and 0021 each have two records under the same number. These are historical artefacts from parallel work and have not been renumbered to preserve permalinks. Treat each pair as two independent records sharing a prefix.

## Index by topic

### Repository & tooling
- [0001 — Monorepo with Turborepo and Bun workspaces](0001-monorepo-with-turborepo-and-bun-workspaces.md)
- [0004 — Biome for linting and formatting](0004-biome-instead-of-eslint-prettier.md)
- [0003 — Shared design tokens package using OKLCH colors](0003-shared-design-tokens-package-with-oklch-colors.md)

### API & backend
- [0005 — NestJS and MikroORM for the API](0005-nestjs-and-mikro-orm-for-the-api.md)
- [0008 — Shared DomainError protocol across API and web](0008-shared-domain-error-protocol.md)
- [0011 — Route API module stays shallow until invariants exist](0011-route-api-module-stays-shallow.md)
- [0012 — Soft-delete enforced by a global MikroORM filter](0012-soft-delete-via-mikro-orm-filter.md)
- [0018 — Route updates are last-write-wins (deferred optimistic concurrency)](0018-route-update-last-write-wins.md)
- [0030 — Discovery geo queries use persisted bbox columns, not PostGIS](0030-bbox-columns-not-postgis-for-discovery.md)
- [0032 — Layered caching and provider cost control](0032-layered-caching-and-provider-cost-control.md)
- [0033 — Node networks as self-hosted vector tiles, not a live Overpass proxy](0033-node-network-tiles-from-self-hosted-pmtiles.md)

### Routing & domain
- [0007 — Single canonical Waypoint type](0007-single-canonical-waypoint-type.md)
- [0009 — RouteDraft editor module owns all draft mutations](0009-routedraft-editor-module.md)
- [0010 — Drop the api-client platform branch](0010-drop-api-client-platform-branch.md)
- [0014 — Uniform Waypoint snap policy, no silent Type downgrade](0014-uniform-waypoint-snap-policy.md)
- [0017 — RouteDraft `unsaved | editing` mode lifecycle](0017-routedraft-mode-lifecycle.md)
- [0021 — Shared routing logic, dual-credential execution](0021-shared-routing-logic-dual-credential-execution.md) (superseded by 0034)
- [0029 — Route generation is a scored candidate pipeline](0029-route-generation-as-scored-candidate-pipeline.md)
- [0031 — Strict surface preferences steer candidate placement, not just costing](0031-surface-first-generation-for-strict-surface-preferences.md)
- [0034 — Centralize routing in the API; share only pure costing logic in core](0034-centralize-routing-in-the-api.md)

### Frontend state
- [0002 — Zustand for RouteDraft state](0002-zustand-for-routedraft-state.md)

### Frontend interaction
- [0028 — Touch gets its own gesture grammar on the planning map](0028-touch-gesture-grammar-for-map-editing.md)

### Identity & access
- [0015 — Admin role reconciled from `ADMIN_EMAILS` env var on every login](0015-admin-role-reconciled-from-env-var.md)
- [0016 — User soft-delete cascades to routes and sessions](0016-user-soft-delete-cascades.md)
- [0017 — Self-initiated account deletion (30-day grace + hard-delete cascade)](0017-self-initiated-account-deletion.md)
- [0022 — Personal access tokens for non-browser clients](0022-personal-access-tokens-for-non-browser-clients.md)
- [0023 — Confirmation header for destructive PAT operations](0023-confirmation-header-for-destructive-pat-operations.md)

### Email
- [0018 — Resend for transactional email; console fallback in dev](0018-resend-for-transactional-email.md)

### Observability
- [0013 — Domain services emit events; telemetry listens](0013-domain-events-for-telemetry.md)
- [0014 — Operational metrics in Prometheus, business analytics in Postgres](0014-operational-metrics-vs-business-analytics.md)
- [0019 — Browser error reporting via Sentry SDK + GlitchTip backend](0019-browser-error-reporting-via-sentry-sdk-and-glitchtip.md)
- [0019 — ProductEvents as a fourth observability pillar, sent to self-hosted Umami](0019-product-events-as-fourth-observability-pillar.md)
- [0020 — ProductEvents carry a pseudonymous `user_id_hash`](0020-pseudonymous-user-id-hash-for-product-events.md)
- [0021 — Same-origin nginx tunnel for browser error envelopes](0021-same-origin-tunnel-for-browser-error-reporting.md)

### Operations
- [0006 — Kubernetes deny-all NetworkPolicy baseline](0006-kubernetes-deny-all-network-policy-baseline.md)
