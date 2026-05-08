# Grafana dashboards

Versioned Grafana dashboards for Routess. Per ADR-0014, operational visualisations live in Grafana, not in the admin UI; the admin UI's `/admin/system` panel links to these.

## Files

- `api-overview.json` — HTTP, auth, DB, external request, business, runtime metrics for the API service. Targets the metrics defined in `apps/api/src/telemetry/metrics.service.ts`.

## Importing

Two paths:

1. **Manual import** (one-off, fastest): in Grafana → Dashboards → Import → upload JSON or paste contents. Pick your Prometheus datasource for `${DS_PROMETHEUS}`.
2. **Sidecar / GitOps** (recommended): mount this directory into the kube-prometheus-stack Grafana sidecar, e.g. as a ConfigMap with the `grafana_dashboard: "1"` label. Each `.json` file becomes a provisioned dashboard.

Once imported, copy the dashboard URL into `monitoring.grafanaUrls.apiOverview` in your Helm `values.yaml` so the admin UI's System panel links to it.

## Adding a new dashboard

1. Build it in the Grafana UI against your existing metrics.
2. Export → Save as JSON → drop the file here.
3. Replace any concrete datasource UID with the `${DS_PROMETHEUS}` template variable so the JSON is portable across clusters.
4. Reference the new URL from `monitoring.grafanaUrls.*` in `charts/routess/values.yaml` if it should appear in the admin System panel.
