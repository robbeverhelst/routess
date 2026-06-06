# Product events

The canonical taxonomy of **ProductEvents** for Routess. ProductEvents are behavioural events ("a user did X at moment T") sent to self-hosted Umami. They are distinct from operational metrics (Prometheus) and business analytics (Postgres aggregates) — see ADR-0019 for why they live in their own pillar, and ADR-0020 for the privacy model.

The typed source of truth is **`apps/web/src/lib/analytics/events.ts`**. This document explains the *why* of each event and the rules around firing them. The two must agree; adding an event requires extending both in the same PR.

## Rules

### Naming
- `<object>_<verb_past>` in snake_case: `route_created`, `gpx_imported`, `auth_wall_hit`.
- Past tense ("the user has done X by the time we fire").
- Object first, verb last — sorts cluster related events together in Umami's UI.

### Firing
- **All events fire from the web client** via `trackEvent()` (see ADR-0019). The API does not fire ProductEvents in v1.
- Fire on **discrete user intent**, never inside `useEffect` cleanups, scroll handlers, or render-time.
- Events corresponding to a server-truth domain event (e.g. `route_created` ↔ API's `route.created`) fire from the web after the API call returns 2xx. The sub-second tab-close-between-success-and-fire loss is acceptable.

### Common context (auto-attached by `trackEvent()`)
Every event automatically carries:
- `signed_in: boolean`
- `user_id_hash?: string` (when signed in; pseudonymous server-salted SHA-256 of the user ID — see ADR-0020)
- `app_version?: string`
- `locale: string`
- `theme: "light" | "dark"`
- `units_preference: "km" | "mi"`

Per-event property tables below list only the *event-specific* properties on top of the common context.

### Property allow-list and forbid-list
**Allowed** (in addition to the common context above):
- Counts and bounded measurements: `waypoint_count`, `distance_m`, `tag_count`, `step_number`, …
- Categorical results: `result`, `failure_reason`, `provider`, `creation_source`, …
- Bounded enums: `activity`, `privacy`, `route_type`, `surface_type`, `loop_direction`
- Bucketed numerics: `url_length_bucket`, `duration_ms_bucket`, `target_distance_m_bucket`, …
- Booleans: `is_first_route`, `had_names`, `route_was_saved`, …

**Forbidden** (never put these on an event):
- Email, name, raw `user_id`, route ID, lat/lng coordinates, IP address
- Route name, route description, tag text, free-text user input
- Session IDs, JWT contents
- Anything that fingerprints when combined (e.g. exact `created_at` second-precision + exact `distance_m` to the metre)

When in doubt, bucket the numeric and drop the identifier.

### Country, device, browser, OS, referrer
Umami captures these automatically from the request. Do not duplicate them as event properties.

## Auth / signup funnel

| Event | When | Properties |
|---|---|---|
| `user_registered` | First-ever successful login for a user | `provider: "google" \| "email"` |
| `user_logged_in` | Every successful login (including the first) | `provider: "google" \| "email"` |
| `user_logged_out` | User clicks logout | — |
| `auth_wall_hit` | Sign-in prompt shown because an action requires auth | `action_attempted: string` (e.g. `"save_route"`, `"share_route"`) |
| `signup_started` | User clicks any sign-in / sign-up CTA | `entry_point: string` (e.g. `"auth_wall"`, `"header_cta"`) |

`user_registered` and `user_logged_in` both fire on a first-time login — `_registered` is the funnel signal, `_logged_in` is the recurring engagement signal.

## Route lifecycle

| Event | When | Properties |
|---|---|---|
| `route_created` | API `POST /routes` returns 2xx | `waypoint_count`, `distance_m`, `elevation_gain_m`, `has_description`, `activity`, `privacy`, `tag_count`, `is_first_route`, `creation_source: "manual" \| "generated" \| "imported"` |
| `route_updated` | API `PATCH /routes/:id` returns 2xx | `changed: string[]` (e.g. `["name", "tags"]`) |
| `route_deleted` | API `DELETE /routes/:id` returns 2xx | — |
| `route_loaded_into_editor` | Saved route opened into the editor | `creation_source: "manual" \| "generated" \| "imported" \| "unknown"` |

`creation_source` on `route_created` currently always reports `"manual"` because RouteDraft does not yet track its origin (GPX-imported drafts and manually placed drafts look identical at save time). The same applies to `route_loaded_into_editor`, which reports `"unknown"`. Both will be refined when route generation lands (#136) and the draft schema gains an origin field.

## Import / export / share

| Event | When | Properties |
|---|---|---|
| `gpx_imported` | After successful GPX parse, before the route lands in its target | `waypoint_count`, `distance_m`, `had_names`, `source: "file_upload" \| "drag_drop" \| "url"`, `target: "draft" \| "library"` |
| `gpx_exported` | After GPX blob download triggered | `waypoint_count`, `distance_m`, `route_was_saved` |
| `route_share_link_copied` | Share URL successfully copied to clipboard | `route_was_saved`, `url_length_bucket: "short" \| "medium" \| "long"` |
| `route_share_link_opened` | A shared route URL is loaded on the receiving end | — |

`route_share_link_opened` is deferred — call site not yet wired (need to identify the receiver-side load path).

## Route generation (feature pending — #136)

| Event | When | Properties |
|---|---|---|
| `route_generation_started` | User submits the generation form | `activity`, `route_type`, `target_distance_m_bucket`, `surface_type`, `loop_direction?` |
| `route_generation_succeeded` | Candidate(s) returned | `activity`, `route_type`, `candidate_count`, `duration_ms_bucket`, `delta_from_target_pct_bucket` |
| `route_generation_failed` | Generation failed | `activity`, `route_type`, `failure_reason: "no_route_found" \| "timeout" \| "provider_error" \| "invalid_input"` |

A generated route that gets *saved* fires `route_created` with `creation_source: "generated"` — there is no separate `route_generation_accepted`.

## Library

| Event | When | Properties |
|---|---|---|
| `library_searched` | Search input settled (1s debounce) or explicit submit | `query_length_bucket`, `result_count_bucket` |
| `library_filtered` | Filter applied | `filter_type`, `result_count_bucket` |
| `route_favourited` | Heart toggled on a route | `favourite` (new state) |

`library_searched` must not fire on every keystroke — debounce at the input layer.

## Collections

| Event | When | Properties |
|---|---|---|
| `collection_created` | Collection created from the library panel | `visibility` |
| `collection_deleted` | Collection deleted (after confirm) | — |
| `collection_share_link_copied` | Share link copied to clipboard | `visibility` (after any auto private→unlisted flip) |

Membership changes (add/remove/reorder) are deliberately not events — too noisy, and `collection_created` + route counts in Postgres answer the adoption question.

## Payment (feature pending — #135)

| Event | When | Properties |
|---|---|---|
| `payment_started` | Stripe Checkout redirect | `plan`, `interval: "monthly" \| "yearly"` |
| `payment_completed` | Success-return URL from Stripe | `plan`, `interval` |
| `payment_cancelled` | Cancel-return URL from Stripe | `plan`, `interval` |

`payment_completed` fires web-side, not from the Stripe webhook. The webhook is the source of truth for entitlement state in the DB; ProductEvents only need the UI moment. Tab-close-before-return is acceptable loss for v1 (reconcile from Stripe if needed).

## Onboarding (feature pending)

| Event | When | Properties |
|---|---|---|
| `onboarding_step_completed` | User advances past a step | `step_number`, `step_name` |
| `onboarding_skipped` | User skips a step | `step_number`, `step_name` |
| `onboarding_completed` | Final step reached | — |

## Events explicitly NOT in this taxonomy

- `waypoint_added` / `waypoint_removed` / `waypoint_dragged` — too noisy. The eventual `route_created` with `waypoint_count` answers the same questions.
- `map_clicked`, `panel_opened`, `drawer_toggled` — UX debug noise. Use session recordings if/when added.
- Anything firing inside `useEffect` cleanups, scroll handlers, or render-time.

## Process for changing the taxonomy

- **Add an event**: extend the discriminated union in `apps/web/src/lib/analytics/events.ts`, add a row in this doc, fire it from the appropriate web call site. Single PR.
- **Rename an event**: breaking for any existing Umami dashboard. Fire both names for one release, then remove the old name.
- **Add a property**: extend the type in `events.ts`. No migration needed.
- **Remove a property**: dashboards depending on it silently return empty in Umami. Treat as a breaking change for any consumer; coordinate before removing.

## Cross-session identity caveat

Umami does not natively support identify-and-merge across anonymous and authenticated sessions. A user who visits signed-out on day 1 and signs up on day 2 appears as two distinct Umami visitors. Within a single session (signed up on first visit), the funnel stitches because the anonymous ID is shared and `user_id_hash` attaches from the first authenticated event onward. Accept this for v1; revisit if cross-session conversion becomes a critical blocker.
