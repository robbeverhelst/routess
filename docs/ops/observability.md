# Observability conventions

How Routess emits, scrapes, and visualises operational data, and the rules new code must follow.

The two load-bearing decisions live in [ADR-0013](../adr/0013-domain-events-for-telemetry.md) (domain events → telemetry listener) and [ADR-0014](../adr/0014-operational-metrics-vs-business-analytics.md) (Prometheus for ops, Postgres for business). This doc is the practical guide.

## The split

There are three distinct surfaces. They are not interchangeable.

| Surface | Substrate | Endpoint | Visualisation | Examples |
|---|---|---|---|---|
| Operational metrics | Prometheus (in-process) | `GET /metrics` | Grafana dashboards | request rate, latency, route generation duration, DB pool, event loop lag |
| Business analytics | Postgres queries | `GET /admin/stats/*` | Admin UI | total signups, signups by day, top route creators, retention |
| Distributed traces | OTLP HTTP exporter | (egress) | Tempo/Jaeger | per-request spans across HTTP, DB, external calls |
| Structured logs | nestjs-pino → stdout | (egress) | Loki/Datadog | request lines, errors, audit events (`audit: true` field) |

If you find yourself wanting to add a "metric" that needs `userId` or `routeId` to be useful, it isn't an operational metric. Add it to the admin API as a Postgres query, not to Prometheus.

## Adding an operational metric

1. **Decide the labels.** Labels are bounded sets only: HTTP method, status code class, route template, error type, provider name, operation kind. **Never** user IDs, route IDs, IPs, emails, full URLs, or anything user-supplied. Cardinality is the cost; new series stick around for the retention window.
2. **Define the instrument** in `apps/api/src/telemetry/metrics.service.ts`. Counter for monotonic counts (`*_total`), Histogram for durations (`*_duration_ms`), UpDownCounter for gauges that go up and down.
3. **Choose the recording path:**
   - **Cross-cutting (every request):** wire it into `MetricsInterceptor` or `TracingInterceptor`.
   - **Domain event (signup, route created, login):** emit a typed event from the domain service into `domain-events.ts`, and translate it in `MetricsListener`. Domain services do **not** inject `MetricsService` (ADR-0013).
   - **Side-system metrics (DB query timing, external calls):** plug into the relevant subsystem's hook (e.g. `MikroOrmMetricsLogger`, an HTTP client interceptor). Register via `setDbMetricsRecorder`-style holders so you don't fight DI ordering.
4. **Add a unit test** in `metrics.service.spec.ts` that calls the new method and asserts the labels.
5. **Update the Grafana dashboard JSON** in `charts/routess/dashboards/` if the metric is dashboard-worthy.

## Adding a business analytic

1. **Write the SQL.** It belongs in `apps/api/src/admin/`, gated by `@Roles('admin')`.
2. **Cache aggregate queries** for ~60s in-memory unless real-time is essential. Admin pages are low-traffic; over-fetching is fine, hammering Postgres on every refresh is not.
3. **Render in the admin UI** under `apps/web/src/routes/admin/`. The admin UI does not query Prometheus.

## Cardinality red flags

If a label can take more than ~50 values, ask twice. If it can take an unbounded number, the answer is no.

| Allowed as label | Not allowed as label |
|---|---|
| `method=GET\|POST\|...` | `userId=42` |
| `status_code=2xx\|4xx\|5xx` (or exact codes) | `routeId=...` |
| `route=/routes/:id` (template) | `path=/routes/12345` (raw) |
| `provider=mapbox\|google` | `endpoint=/v5/directions/cycling/...` (full URL with coords) |
| `operation=select\|insert\|update\|delete` | `query="select * from route where ..."` |
| `result=success\|invalid_token\|user_not_found` | `email=bob@example.com` |

When in doubt: log the high-cardinality detail (Pino structured field) and tag the metric with the bucket.

## Enabling Prometheus scrape in the chart

The Helm chart ships a `ServiceMonitor` template, gated off by default so the chart installs in clusters without the Prometheus Operator CRDs.

```yaml
# values.yaml
monitoring:
  serviceMonitor:
    enabled: true
    interval: 30s
    scrapeTimeout: 10s
    labels: {}        # match your Prometheus Operator's serviceMonitorSelector
    path: /metrics
  grafanaUrls:
    apiOverview: https://grafana.example.com/d/routess-api
    apiLatency: https://grafana.example.com/d/routess-latency
```

For non-Operator clusters, the API Service carries `prometheus.io/scrape: "true"` annotations as a fallback for Prometheus's `kubernetes_sd_configs` annotation discovery.

## Tracing

Distributed tracing is wired through `@opentelemetry/sdk-node` with auto-instrumentation. To enable trace export, set `telemetry.otlpEndpoint` and (optionally) `telemetry.otlpHeaders` in app config. Spans correlate to log lines via `requestId` (set by `RequestIdMiddleware`).

## Logs

`nestjs-pino` emits structured JSON to stdout. Log fields you can rely on:

- `requestId` — generated or propagated from `X-Request-ID`
- `level` — pino levels
- `audit: true` — admin-mutating actions; filter on this to get an audit trail without a dedicated table (see [ADR-0015](../adr/0015-admin-role-reconciled-from-env-var.md))
