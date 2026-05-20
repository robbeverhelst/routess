---
name: routess
description: Operate a user's Routess library through the API or the routess CLI. Read routes, edit metadata, delete, change visibility. Mints/lists/revokes PATs are explicitly out of scope (the user does that in the web Settings page). Route creation and planning are out of scope for now (tracked in #170).
---

# routess

You are operating a user's library on Routess, a route-planning product for cyclists, runners, and hikers. The user holds a Personal Access Token (PAT) and expects you to use the `routess` CLI or the public REST API to read and edit metadata on their saved Routes.

## When to invoke this skill

- The user asks you to list, search, count, rename, retag, or change the visibility of their Routes.
- The user asks you to delete a Route, change its visibility to public, or perform a bulk edit. **These are destructive operations**; surface a confirmation prompt before calling the API.
- The user mentions "Routess", "my routes", "the route I cycled yesterday", "share my Brussels loop", etc., in a context where they expect you to act on the library, not just answer informationally.

## What you must not do

- Mint additional PATs on the user's behalf. The endpoint refuses PATs and you cannot reach the web Settings page from this context.
- Hit any `/api/v1/admin/*` endpoint.
- Delete the user account.
- Create new Routes. The API does not currently accept route creation from a PAT (tracked in issue #170). If the user asks for "a new route" or "plan me a 10km loop," explain that this flow is coming and ask them to use the web UI for now.

## How to operate

Read the full operating instructions in [routess.skill.md](../routess.skill.md). The vocabulary, auth setup, common flows, guardrails, error-shape table, and exit-code table all live there and apply verbatim.

Specifically before any API call:

1. **Confirmed mode.** If the operation is destructive (DELETE, PATCH to `privacy: public`, or any bulk loop with more than five mutations), produce a one-sentence summary of what will happen and ask the user to approve before issuing the call.
2. **Pass `--confirm`** on the CLI for the approved destructive calls; over raw HTTP that maps to `X-Routess-Confirm: true`.
3. **Read the response.** A 428 PRECONDITION_REQUIRED contains a human-readable `details.impact` string. Surface that string verbatim to the user when you ask for confirmation; do not paraphrase.

## Worked example

User: "Delete all my routes from 2024."

You:

1. `routess --json routes list` → parse output.
2. Filter to routes whose `createdAt` is in 2024.
3. Present the list to the user with names and ids: "I found 12 routes from 2024. Here they are: …. Should I delete all 12?"
4. On approval: loop with `routess routes delete <id> --confirm` for each.
5. Report progress per delete; stop and surface any non-zero exit code immediately.

Do **not** skip step 3. The user has not pre-approved any specific delete; only the *kind* of operation.
