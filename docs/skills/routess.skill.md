# Routess agent skill

Operating instructions for AI agents and scripted clients that work with a user's Routess library through the public API or the `routess` CLI.

This file targets a generic LLM context. The OpenClaw wrapper at `docs/skills/openclaw/SKILL.md` includes this file verbatim and adds harness-specific framing.

## What Routess is

Routess is a route-planning product for cyclists, runners, and hikers. A user places **Waypoints** on a map; the system snaps them to roads (or leaves them as straight-line **direct** segments) and produces a **RoutePath** with **Distance**, **Duration**, and **ElevationGain** metrics. Routes can be hand-drawn, AI-generated, imported from GPX, saved to a personal library, and exported.

You can read a user's library, edit metadata on saved Routes, organise them into Collections, export GPX, import GPX files as new Routes, generate loop Routes from high-level parameters, and download the full account export. The interactive planning flow (place search, draft editing, recalculation) remains web-only; see "Planning" below.

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

- **`read`** — list and inspect routes and collections, GPX export, account export, read profile, list PATs.
- **`write`** — `read` plus route creation (`POST /routes`, including GPX import and saving generated loops), metadata mutations on owned routes (`PATCH` name/activity/visibility/tags/favourite, `DELETE`), collection management, PAT revocation, and user preferences.

A PAT is **never** valid against `/api/v1/admin/*` or `DELETE /api/v1/users/me`, regardless of the owning user's role. PATs cannot mint other PATs; minting is cookie-only.

Install the CLI:

```
npm install -g routess
```

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

`visibility: public` is a destructive operation in the eyes of the API: once public, the URL may be archived externally and reverting does not unshare. Confirm with the user before doing this.

```
routess routes update 42 --visibility public --confirm
```

### Export and import GPX

```
routess routes gpx 42 -o sunday-loop.gpx        # route id, owner sees any visibility
routess routes gpx 9f86d081884c7d659a2feaa0c55ad015   # share token, no auth needed
routess routes import ./ride.gpx --activity cycle
```

### Organise routes into collections

```
routess collections list
routess collections create --name "Alps 2026" --description "Summer trip"
routess collections set-routes 3 --routes 12,7,31    # full ordered membership
routess collections get 3
```

### Generate a loop route

Generation is anonymous (no token needed); saving the result needs a `write` token.

```
routess generate --start 50.8467,4.3525 --activity cycle --distance 40 --heading north
routess generate --start 50.8467,4.3525 --activity run --distance 10 --save 1 --name "Morning loop"
routess --json generate --start 50.8467,4.3525 --activity walk --distance 5
```

A response with zero candidates exits 1 and carries a structured failure code (`start_not_routable`, `all_candidates_low_quality`, …) that suggests what to vary on retry.

### Favourites and tags

```
routess routes favourite 42
routess routes update 42 --tags "gravel,long"
```

### Credential hygiene and account backup

```
routess tokens list
routess tokens revoke 7                      # another token
routess tokens revoke 3 --confirm           # the token you are using now (locks you out)
routess export -o backup.zip                 # full account dump: JSON + one GPX per route
```

## Guardrails

These are the operations that **require explicit user confirmation in your conversation** before you call them:

1. `DELETE` on any route or collection. The API soft-deletes (admin can recover within retention), but the user does not see the recovered route until restored.
2. `PATCH` or `POST` that sets `visibility: public`. The URL becomes potentially indexable and archivable externally.
3. Revoking the PAT that authenticates your own session (`tokens revoke` on the active token): it locks you out immediately.
4. Bulk operations (more than 5 mutations in one chain). Even when each individual op is benign, the volume can surprise the user.
5. Anything you cannot describe in one sentence to the user.

The API enforces (1), (2), and (3) at the protocol level: a PAT call against any of them without `X-Routess-Confirm: true` returns **428 PRECONDITION_REQUIRED** with an `impact` description in `details`. Surface that `impact` verbatim to the user before retrying with the header.

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

## Planning

Route *creation* is now available to `write`-scoped PATs in three forms:

1. **GPX import** — `routess routes import <file.gpx>` parses waypoints and track geometry and saves a private Route.
2. **Loop generation** — `routess generate … --save` turns a scored GenerationCandidate into a saved Route (provenance `generation`).
3. **Raw payload** — `routess routes create --from payload.json` posts a full CreateRoute body for callers that compute their own Waypoints and geometry.

The interactive planning flow — search for a place, build a draft, add or move waypoints, recalculate distance/elevation/surface incrementally — remains web-only. An agent that needs that flow must ask the user to use the web UI; everything else in issue [#170](https://github.com/robbeverhelst/routess/issues/170) has landed.

## Links

- Domain glossary: `CONTEXT.md` at the repo root.
- ADRs: `docs/adr/0022-personal-access-tokens-for-non-browser-clients.md`, `docs/adr/0023-confirmation-header-for-destructive-pat-operations.md`.
- OpenAPI: served at `/api` on a running API instance.
- Issue tracker: <https://github.com/robbeverhelst/routess/issues>.

## Version compatibility

This skill is written against the API surface introduced by issue #139 (developer foundation). Future skill versions will be additive; the protocol commitments above (`code` taxonomy, exit-code mapping, `routess_pat_` prefix, `X-Routess-Confirm` header) are stable.
