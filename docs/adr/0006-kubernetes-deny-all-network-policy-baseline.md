# Kubernetes deny-all NetworkPolicy baseline

The `maps` namespace ships with a deny-all default NetworkPolicy; web, API, and database pods each open only the specific ingress/egress flows they need (web ← Cloudflare tunnel + kube-system; API ← web + Cloudflare tunnel, → database + external APIs; database ← API only). Combined with non-root containers (uids 101 / 1000 / 999), read-only filesystems where possible, dropped Linux capabilities, and per-service ServiceAccounts, this gives us a defense-in-depth posture without breaking the Cloudflare tunnel ingress path.

The deny-all default is the load-bearing decision: opt-in flows are explicit and auditable, and any new service has to declare its connectivity to function — there is no implicit trust between pods.

## Considered options

- **Allow-all default with deny rules for sensitive paths** — rejected: silently grants new services full mesh access, fails open on misconfiguration.
- **Service mesh (Istio / Linkerd) for L7 policy** — deferred: not justified at current scale; revisit if multi-tenancy or mTLS-everywhere becomes a hard requirement.
