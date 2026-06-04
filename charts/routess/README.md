# routess Helm chart

Helm chart for deploying [routess](https://github.com/robbeverhelst/routess): web, API, docs, and landing apps plus services, ingress, network policies, and optional ServiceMonitor.

## TL;DR

```sh
helm install routess oci://ghcr.io/robbeverhelst/charts/routess \
  --version <VERSION> \
  --namespace routess --create-namespace \
  -f my-values.yaml
```

Find the latest chart version on the [releases page](https://github.com/robbeverhelst/routess/releases) (chart version tracks app version).

## What it deploys

| Component | Default image                                      | Purpose                                |
| --------- | -------------------------------------------------- | -------------------------------------- |
| web       | `ghcr.io/robbeverhelst/routess-web:latest`         | React SPA served by nginx              |
| api       | `ghcr.io/robbeverhelst/routess-api:latest`         | NestJS API on Bun                      |
| docs      | `ghcr.io/robbeverhelst/routess-docs:latest`        | Next.js documentation site             |
| landing   | `ghcr.io/robbeverhelst/routess-landing:latest`     | Next.js marketing site (multi-domain)  |

Plus:
- One `Service` per app
- One `Ingress` per app (when `ingress.enabled=true`)
- A baseline of NetworkPolicies implementing the [ADR-0006 deny-all baseline](../../docs/adr/0006-kubernetes-deny-all-network-policy-baseline.md)
- A `PodDisruptionBudget` for web, api, and landing
- An optional `ServiceMonitor` for the api (`monitoring.serviceMonitor.enabled=true`)
- An optional `HorizontalPodAutoscaler` per app (`autoscaling.enabled=true`)

Postgres is **not** managed by this chart. Bring your own database (managed Postgres, a cluster-internal Postgres operator like CloudNativePG, or whatever you already operate).

## Required values

Pass these via `--set` from a secret manager, or via `-f values.yaml`:

```yaml
api:
  secrets:
    jwtSecret: <random>
    analyticsSalt: <random>
    patPepper: <random>
    googleClientId: <from-google>
    googleClientSecret: <from-google>
    dbHost: <postgres-host>
    dbUser: <postgres-user>
    dbPassword: <postgres-password>

networkPolicies:
  postgresEgress:
    enabled: true
    host: <postgres-host>   # for the egress rule
```

The API refuses to start in production without `JWT_SECRET`, `ANALYTICS_SALT`, and `PAT_PEPPER`. See [ADR-0022](../../docs/adr/0022-personal-access-tokens-for-non-browser-clients.md) for the pepper requirement.

## Choose an ingress strategy

The chart ships with example overlays for two common topologies. Pick one and adapt:

### Cloudflare Tunnel

```sh
helm install routess oci://ghcr.io/robbeverhelst/charts/routess \
  -f values.example.cloudflare.yaml \
  --set ingress.web.hosts[0]=routess.example.com \
  --set ingress.api.hosts[0]=api.routess.example.com \
  --set ingress.docs.hosts[0]=docs.routess.example.com \
  --set networkPolicies.cloudflareNamespace=cloudflare
```

The `allow-cloudflare` NetworkPolicy expects your Cloudflare Tunnel pods to run in a namespace labelled `kubernetes.io/metadata.name=<your-cloudflare-ns>`.

### cert-manager + ingress-nginx

```sh
helm install routess oci://ghcr.io/robbeverhelst/charts/routess \
  -f values.example.nginx.yaml \
  --set ingress.web.hosts[0]=routess.example.com \
  --set ingress.api.hosts[0]=api.routess.example.com \
  --set ingress.docs.hosts[0]=docs.routess.example.com
```

Requires `ingress-nginx` and `cert-manager` already installed in the cluster, plus a `ClusterIssuer` named `letsencrypt-prod` (or override `cert-manager.io/cluster-issuer` in the example file).

## Values reference

See [`values.yaml`](values.yaml) for every key and default. The most commonly tuned ones:

| Path                                    | Default          | Notes                                            |
| --------------------------------------- | ---------------- | ------------------------------------------------ |
| `web.replicaCount` / `api.replicaCount` | `2`              | `docs.replicaCount` is `1`                       |
| `*.image.tag`                           | `latest`         | Pin to a release in production                   |
| `*.resources.{requests,limits}`         | conservative     | Tune for your workload                           |
| `ingress.enabled`                       | `true`           | Disable for port-forward / proxy-only setups     |
| `ingress.className`                     | `cloudflare-tunnel` | Override per environment                      |
| `autoscaling.enabled`                   | `false`          | HPA off by default                               |
| `monitoring.serviceMonitor.enabled`     | `false`          | Enable when Prometheus Operator is present       |
| `networkPolicies.enabled`               | `true`           | Disable only when you've got cluster-wide policies |

## Render locally

```sh
helm template routess ./charts/routess \
  --set api.secrets.jwtSecret=test \
  --set api.secrets.analyticsSalt=test \
  --set api.secrets.patPepper=test \
  --set api.secrets.googleClientId=test \
  --set api.secrets.googleClientSecret=test \
  --set api.secrets.dbHost=10.0.0.1 \
  --set api.secrets.dbUser=test \
  --set api.secrets.dbPassword=test
```

## Upgrade

```sh
helm upgrade routess oci://ghcr.io/robbeverhelst/charts/routess \
  --version <NEW_VERSION> \
  -n routess \
  -f my-values.yaml
```

The API runs MikroORM migrations on startup. There is no manual migration step. Standard rolling-update mechanics: roll a single API pod first, watch logs, then let the rest go.
