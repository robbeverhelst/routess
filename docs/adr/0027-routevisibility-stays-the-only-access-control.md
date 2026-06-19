# RouteVisibility stays the only access-control concept; social grants nothing

Social v1 introduces **Follow**, **RouteShare**, and the **Feed** (CONTEXT.md "Social"). None of them grant access. A Follow is a subscription, not a permission; a RouteShare can only carry an `unlisted` or `public` Route (sharing a `private` Route prompts the owner to unlist it first); the Feed is a derived query over `public` Routes of followed Profiles. **RouteVisibility** (`private` | `unlisted` | `public`, ADR 0025) remains the single answer to "who can see this Route" everywhere in the system. The trade-off we accept: revocation is coarse. Flipping a Route back to `private` 404s it for share recipients, feed readers, and URL holders alike; there is no per-person revoke.

## Considered options

- **Capability-preserving (chosen)** — RouteShare is a first-class pointer to a URL the recipient could have received over WhatsApp anyway. Zero new ACL machinery; every route-read codepath keeps its single visibility check; revocation already works (ADR 0025: the URL is the capability).
- **Per-recipient grants (RouteShare unlocks a `private` Route for its recipient)** — friendlier semantics ("I shared with *you*"), but it creates a second access-control system: every route read becomes "owner, or visibility allows, or an active share exists", `private` stops meaning owner-only in the glossary, and revocation questions multiply (does deleting the share revoke? what about saved copies?). Once users rely on it, it cannot be cleanly removed.
- **Follower-gated visibility (a fourth `followers` visibility value)** — makes the Follow graph an access edge, so accepting/removing followers becomes a security decision and the no-approval follow model collapses. Rejected outright.

A consequence of the same principle: the **Feed is a derived view, not a stored timeline**. Feed entries are not fanned out on write, so there is no stored copy whose access would need separate revocation — a Route flipped to `private` vanishes from every Feed by simply not matching the query.

## Consequences

- Positive: one visibility check guards every read path; no share/grant tables consulted on reads; instant, consistent revocation; RouteShare, Feed, and Profile pages all inherit ADR 0025 semantics for free.
- Negative: no granular sharing — an `unlisted` share is visible to anyone who obtains the URL, and un-sharing is all-or-nothing per Route.
- Follow-ups: if per-person sharing is ever demanded, it must arrive as a deliberate new concept with its own ADR, not as a widening of RouteShare.

## Admin carve-out

The **Admin** role (ADR 0015) operates outside RouteVisibility entirely. The admin API already reads any User's Route metadata regardless of visibility (name, owner, addresses, stats) for operational and moderation purposes. As of the admin route-inspection work, this carve-out explicitly extends to a Route's **RoutePath** geometry: an Admin can view the full map of any Route, including `private` ones, in the admin surface. This is an out-of-band operator capability gated by the admin role and audit-logged, not a widening of RouteVisibility for ordinary read paths. RouteVisibility remains the only access-control concept for every non-admin reader.

## References

- ADR 0025 (public route page URL; the URL is the capability)
- ADR 0015 (admin role reconciled from env var)
- CONTEXT.md: RouteVisibility, Follow, RouteShare, Feed, PublishedAt, Admin
