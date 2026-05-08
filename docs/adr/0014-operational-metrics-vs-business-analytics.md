# Operational metrics in Prometheus, business analytics in Postgres

Operational time-series (HTTP request rate, latency, error rate, route-generation duration, external API latency, event-loop lag, DB pool, query duration) live in Prometheus, scraped from `/metrics` and visualised in Grafana. User- and product-level KPIs (signups by day, top route creators, retention, route counts by surface) live in Postgres and are computed by aggregate queries inside an admin-only API module (`apps/api/src/admin/`); the admin UI calls those endpoints directly.

The two surfaces are kept strictly separate. Prometheus labels are bounded sets only (method, status_code, route template, error_type, provider name). User IDs, route IDs, IPs, emails, and other unbounded identifiers never become Prometheus labels — those views belong in the admin API. Per-entity dimensions on existing counters (the `user_id` label that previously sat on `routes_created_total` / `routes_deleted_total`) are removed.

The admin UI does not query Prometheus. The "system" panel links out to Grafana for operational dashboards.

## Considered options

- **PromQL proxy in the admin API** — admin UI hits `/admin/metrics/query?q=...` to render operational charts in-page. Rejected: rebuilds Grafana badly (no templating, no alerting, fiddly auth/CORS), and pulls Prometheus URL config into application code. Grafana already exists for this.
- **Everything in Prometheus, including business KPIs with `user_id` / `route_id` labels** — the prior shape on `routes_created_total`. Rejected: cardinality explodes with users and routes; per-user views aren't joinable across counters; GDPR-conscious deletion of metric series is impractical. Postgres is the right substrate for joinable, deletable, per-entity data.
- **Only Postgres, drop Prometheus entirely** — rejected: time-series aggregation, retention, and alerting are exactly what Prometheus is for; reimplementing them on Postgres is a project of its own.
