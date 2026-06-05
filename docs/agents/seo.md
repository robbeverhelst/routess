# SEO conventions

Decided 2026-06-05. Strategy: organic user acquisition, Belgium/Dutch first, global English as the background track. Sources behind these rules: Google Search Central (AI features, structured data gallery, CWV), 2025-2026 guidance from Ahrefs/SEL/SEJ. Re-verify before citing; this field moves.

## Where things live

- **All indexable content lives on the landing app** (`routess.com` + `routess.be`), never on `app.` or `docs.` subdomains. Authority compounds on the root domains. Docs stay on `docs.routess.com` for product documentation only; editorial/marketing content does not go there.
- **Host = locale** per ADR-0017: Dutch on `.be`, English on `.com`, hreflang pairs across the two, `x-default` to `.com`. No path locales. French is parked; when it matters it becomes `routess.be/fr/...`.
- **Public route pages**: canonical shareable URL is `https://routess.com/r/{slug}-{id}` (and `.be` mirror), rendered SSR by the landing app. The web app's `/r/` route is the interactive view the landing page links to. URL contract and slug rules per the public-route-page ADR (PR #212).
- **RegionalHubs**: `routess.be/fietsroutes/{plaats}` / `routess.com/cycling-routes/{place}` (keyword-in-URL in the host's language). A hub page may only exist once its place has ≥5 Indexable Routes. See CONTEXT.md "Public discovery".

## Indexing rules

- Only **Indexable** Routes (see CONTEXT.md) go in sitemaps and may be indexed. Public-but-below-the-bar routes render with `noindex`. `unlisted` is always `noindex, nofollow` and never in a sitemap; `private` is 404 to non-owners.
- Sitemaps: segmented sitemap index per page type (static pages, routes, hubs), only canonical 200-status indexable URLs. No noindex/redirect URLs in sitemaps.
- Do not use the Google Indexing API for route pages (it is restricted to job postings/livestreams). Sitemaps + internal links only.
- Never let a templated page exist without genuinely unique data on it. Thin programmatic pages get domains demoted; when in doubt, `noindex` or don't generate the page.

## Content rules

- Editorial content (comparisons, guides) is MDX in the landing app. Dutch originals on `.be`, English mirrors on `.com`, hreflang-paired. Comparison pages concede honestly where competitors win; they exist to convert high-intent searchers and earn links, not to flatter.
- Lead with a direct answer in the first ~50 words, keep fact density high (stats, concrete numbers, quotes). This is what both Google and AI assistants (AI Overviews, ChatGPT, Perplexity) reward.
- E-E-A-T "Experience" is the edge: real screenshots, real GPX exports, routes actually ridden. No generic filler.

## Technical rules

- Every indexable page ships complete server-rendered HTML: unique `<title>`, meta description, canonical (self-referencing, never cross-locale), OG/Twitter tags, hreflang cluster including self + `x-default`.
- OG images for route pages are served first-party (`/r/{slug-id}/og.png`), proxying the Mapbox Static API server-side with a Referer header (the pk token is URL-restricted; social scrapers send no Referer and would be rejected hitting Mapbox directly).
- Structured data: `Organization` + `SoftwareApplication` site-wide (already live), `BreadcrumbList` on hubs/route pages/docs. Do not add FAQPage/HowTo for rich results (deprecated 2023-2026). No llms.txt requirement; no special "AI markup" exists (Google's own guidance).
- Core Web Vitals: the metric that bites SPAs is **INP ≤ 200ms** (replaced FID in 2024). Monitor via Search Console CWV report (field data), not lab runs.

## Measurement

- Google Search Console domain properties exist for `routess.com` and `routess.be`. Sitemaps submitted there; `docs.routess.com` is covered by the `.com` property.
- Bing Webmaster Tools imported from GSC (feeds ChatGPT browsing and other AI retrieval).
- Behavioural analytics stay on self-hosted Umami (ProductEvents); no Google Analytics.
