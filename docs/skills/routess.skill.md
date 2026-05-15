# Routess agent skill

Operating instructions for AI agents and scripted clients that work with a user's Routess library through the public API or the `routess` CLI.

This file targets a generic LLM context. The OpenClaw wrapper at `docs/skills/openclaw/SKILL.md` includes this file verbatim and adds harness-specific framing.

## What Routess is

Routess is a route-planning product for cyclists, runners, and hikers. A user places **Waypoints** on a map; the system snaps them to roads (or leaves them as straight-line **direct** segments) and produces a **RoutePath** with **Distance**, **Duration**, and **ElevationGain** metrics. Routes can be hand-drawn, AI-generated, imported from GPX, saved to a personal library, and exported.

You can read a user's library, edit metadata on saved Routes, and (in a future release) plan brand-new Routes through the API. This skill covers the read + metadata-write surface that exists today. Route *creation* and the live planning flow are tracked separately in issue #170.

## Vocabulary

Use these terms in user-facing messages. Never substitute synonyms.

- **Route** — A persisted path made up of an ordered sequence of Waypoints, with a computed RoutePath and metrics. Owned by a User.
- **Waypoint** — A geographic point (lat/lng) on a Route, with a per-segment Type.
- **Type** — How a Waypoint segment connects to the previous one: `routed` (snap to roads) or `direct` (straight line).
- **RoutePath** — The ordered coordinates rendered on the map, computed by stitching together routed and direct segments. Distinct from Waypoints.
- **Activity** — One of `run`, `cycle`, `walk`. A property of a Route.
- **RouteVisibility** — One of `private`, `link` (unlisted), `public`. Default is `private`.
- **PersonalAccessToken (PAT)** — A long-lived bearer credential a User mints for non-browser clients. Carries scope `read` or `write`. Never valid against admin operations.

Avoid: "stop", "marker", "pin", "track", "trip", "polyline", "API key", "Bearer token" (use **PAT** when describing the credential model).

The complete glossary lives in `CONTEXT.md`. If a user introduces a term that contradicts these definitions, gently surface the Routess word for it rather than silently adopting their phrasing.

## Auth setup

The user mints a Personal Access Token in the Routess web app: **Settings → API Tokens → Create**. The plaintext is shown exactly once. Two scopes:

- **`read`** — list and inspect routes, GPX export (when available), read profile.
- **`write`** — `read` plus metadata-only mutations on owned routes (`PATCH` name/activity/privacy, `DELETE`) and on user preferences.

A PAT is **never** valid against `/api/v1/admin/*` or `DELETE /api/v1/users/me`, regardless of the owning user's role. PATs cannot mint other PATs; minting is cookie-only.

Pass the token to the CLI:

```
routess auth login --token routess_pat_…
```

Or set `ROUTESS_TOKEN` in the environment. For direct HTTP use:

```
Authorization: Bearer routess_pat_…
```

## Common flows

### List the user's routes

```
routess routes list
routess --json routes list                    # JSON output for parsing
```

### Inspect one route

```
routess routes get 42
```

### Bulk-rename routes by activity

```
routess --json routes list \
  | jq -r '.[] | select(.activity == "run") | .id' \
  | while read id; do
      routess routes update "$id" --name "Run – $(date +%Y-%m-%d)"
    done
```

### Clean up stale routes (with confirmation)

Always show the user the list first; only delete after they approve. The confirmation flag on the CLI maps to `X-Routess-Confirm: true`.

```
routess routes delete 17 --confirm
```

### Make a route shareable (public)

`privacy: public` is a destructive operation in the eyes of the API: once public, the URL may be archived externally and reverting does not unshare. Confirm with the user before doing this.

```
routess routes update 42 --privacy public --confirm
```

## Guardrails

These are the operations that **require explicit user confirmation in your conversation** before you call them:

1. `DELETE` on any route. The API soft-deletes (admin can recover within retention), but the user does not see the recovered route until restored.
2. `PATCH` that sets `privacy: public`. The URL becomes potentially indexable and archivable externally.
3. Bulk operations (more than 5 mutations in one chain). Even when each individual op is benign, the volume can surprise the user.
4. Anything you cannot describe in one sentence to the user.

The API enforces (1) and (2) at the protocol level: a PAT call against either without `X-Routess-Confirm: true` returns **428 PRECONDITION_REQUIRED** with an `impact` description in `details`. Surface that `impact` verbatim to the user before retrying with the header.

Cookie-authenticated requests bypass the confirmation header — only PAT callers see the gate. This is intentional: the web UI expresses confirmation through its own dialogs.

You may not:

- Mint additional PATs on the user's behalf (the endpoint refuses PATs and you cannot reach the web Settings page from this context).
- Hit any `/api/v1/admin/*` endpoint.
- Delete the user account.

## Error shape

All errors come back as `{ statusCode, code, message, details? }`. Branch on `code`:

| Code | Recovery |
|---|---|
| `VALIDATION_FAILED` | Read `details` for field paths; correct the input and retry. |
| `NOT_FOUND` | The id does not exist or belongs to another user. Do not retry. |
| `UNAUTHORIZED` | Token is missing, expired, or revoked. Stop and ask the user to mint a new one. |
| `FORBIDDEN` | Token scope is insufficient, or the endpoint is not PAT-accessible. Stop. |
| `CONFLICT` | A concurrent edit lost. Re-fetch the route and decide whether to retry. |
| `PRECONDITION_REQUIRED` | Surface `details.impact` to the user and retry with `X-Routess-Confirm: true`. |
| `RATE_LIMITED` | Wait and retry. The bucket is per-token, so this is your own loop, not someone else's traffic. |
| `INTERNAL` | Server failure. Stop, report the message; do not retry blindly. |

## Exit codes (CLI)

Stable across versions:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic / unexpected |
| 2 | Usage error (bad flag, missing arg) |
| 3 | `VALIDATION_FAILED` |
| 4 | `NOT_FOUND` |
| 5 | `UNAUTHORIZED` |
| 6 | `FORBIDDEN` |
| 7 | `CONFLICT` |
| 8 | `RATE_LIMITED` |
| 9 | `PRECONDITION_REQUIRED` |
| 10 | Network failure |
| 11 | `INTERNAL` |

## Planning is coming

Today this skill covers reading routes and editing metadata. The planning flow — search for a place, build a draft, add or move waypoints, recalculate distance/elevation/surface, save as a new Route — lives in issue [#170](https://github.com/robbeverhelst/routess/issues/170) and is not yet available. When it lands, this skill will gain a "Planning" section with the `places search → draft add-waypoint → draft recalc → draft save` sequence.

Until then, an agent that wants a new route in the user's library must ask the user to create it through the web UI.

## Links

- Domain glossary: `CONTEXT.md` at the repo root.
- ADRs: `docs/adr/0022-personal-access-tokens-for-non-browser-clients.md`, `docs/adr/0023-confirmation-header-for-destructive-pat-operations.md`.
- OpenAPI: served at `/api` on a running API instance.
- Issue tracker: <https://github.com/robbeverhelst/routess/issues>.

## Version compatibility

This skill is written against the API surface introduced by issue #139 (developer foundation). Future skill versions will be additive; the protocol commitments above (`code` taxonomy, exit-code mapping, `routess_pat_` prefix, `X-Routess-Confirm` header) are stable.
