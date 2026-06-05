# ccTLD-based locale split for the marketing landing

The marketing landing ships under two top-level domains: `routess.com` serves the English landing, `routess.be` serves the Dutch landing. The application (`app.routess.com`), API (`api.routess.com`), and docs (`docs.routess.com`) live under `.com` only and are not mirrored on `.be`. Both landings are produced by a single `apps/landing` build, deployed as one Docker image; locale is resolved at request time from the `Host` header, so one Helm Deployment serves both ingresses.

The split is deliberate, not a path of least resistance. `.be` is a strong geographic-targeting signal for Google in Belgium and authentic to the launch story (a Belgian-built product, a `.be` domain) — both effects matter for the launch's "Belgian splash" framing. `.com` carries the international SEO weight and is the canonical entry point for the open-source / developer audience, who reach the product through GitHub, Hacker News, and English-language press where `.com` is expected.

The "marketing only" mirror — keeping `app`, `api`, and `docs` single-TLD — is the load-bearing half of the decision. Browser cookies are scoped per registrable domain; mirroring `app.routess.be` would force either two parallel logins per user (different sessions on different TLDs for the same human), or a cross-domain SSO bridge that exists solely to paper over the mirror. Both are bad outcomes in service of a marketing claim. The app's own i18n already serves Dutch UI when `Accept-Language` is `nl-*`, so a Dutch-Belgian user crossing from `routess.be` (landing) to `app.routess.com` (planner) sees Dutch product UI without a second-TLD app.

The reversibility cost is asymmetric and front-loaded into the decision: once SEO equity, inbound links, and bookmarks accrue to a TLD, moving away from it requires permanent 301s and dilutes both properties. Choosing two TLDs from day 1 commits to maintaining both indefinitely.

## Considered options

- **Path-based locales (`routess.com/` en, `routess.com/nl` nl)** — rejected: the Belgian splash requires `.be` in the URL and in press writeups; pushing Dutch under `/nl` makes it a footnote of the English site rather than a Belgian product.
- **Subdomain-based locales (`routess.com` en, `nl.routess.com` nl)** — rejected: subdomains share imperfect SEO authority with the apex (less benefit than a separate TLD for geo-targeting), `.be` has the Belgian signal that `nl.routess.com` lacks, and we already have to manage subdomain ingresses for `app`/`api`/`docs` — adding `nl.` increases that complexity without the geo benefit.
- **Full mirror (`routess.be` + `app.routess.be` + `api.routess.be` + `docs.routess.be`)** — rejected: cross-TLD cookie scoping forces parallel sessions or an SSO bridge; APIs and docs aren't translated, so two ingresses point at the same backend for no user-visible benefit.
- **Two separate landing builds, one per locale** — rejected as a build/deploy strategy: same content shape, same components, same engineering. Hostname-based locale resolution at request time keeps it one image, one Deployment, two Ingresses.
