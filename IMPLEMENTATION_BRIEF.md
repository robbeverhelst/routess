# routess v2 — Redesign Implementation Brief

You are implementing a visual redesign of the **routess** route-planning app (this repo). Attached is `Routess Redesign.html` — a static, self-contained spec sheet of **29 redesigned screens/components**. It is the source of truth for the *target look and behavior*. Your job is to bring the live app to match it, **without breaking existing functionality**.

---

## Ground rules (read first)

1. **This is a re-skin + a few new surfaces, NOT a rewrite.** Keep all existing data flow, hooks, stores, routing, and API calls. Change presentation, structure, and add the specifically-named new pieces. If a change would touch business logic, stop and flag it.
2. **The design system already exists — use it, don't invent.** Everything in the spec is built from `@routess/design-tokens` (warm paper `#fdfaf2`, **Bricolage Grotesque** display, **Inter** body, **JetBrains Mono** stats/eyebrows, indigo `#5b3df5` primary, earthy accents moss/terracotta/sun/sky) and the `--rds-*` token layer + `[data-redesign]` components already in `apps/web/src/index.css`. Map every color/space/radius in the spec back to an existing token. **Do not hardcode hex values** that duplicate a token. If you truly need a new value, add it as a token, don't inline it.
3. **The spec uses placeholder glyphs and inline SVG for icons** (e.g. `✎ ▤ ◈ ⬡ ⌑ ↯`). In the real app, use the existing **lucide** icon set via the `I.*` wrappers in `apps/web/src/components/icons.tsx`. Match intent, not the literal glyph. Map list below.
4. **Map areas in the spec are stylized placeholders.** The real app renders Mapbox GL — leave the map layer alone except where the spec changes overlays/markers/controls.
5. **Sample data in the spec is illustrative** (Schelde sunrise ride, Deurne, etc.). Wire each component to its real props/data; never hardcode the spec's copy.

---

## How to read the spec

Open `Routess Redesign.html`. It is a single scrolling sheet of labeled frames, grouped into sections. Each frame has a mono eyebrow label (e.g. `01 · Plan — as it sits in the shell`) and a one-line note describing intent. The number is your reference ID. Work through them section by section.

**Before writing code for a frame**, find the real component it maps to (table below), read it, and diff it against the frame. Preserve its logic; restyle its markup.

---

## Frame → source-file map

| # | Frame | Implement in |
|---|---|---|
| 01 | Plan — full sidebar in shell | `panels/PlanPanel.tsx` (+ `AppShell.tsx` for rail/panel chrome) |
| 02 | Library — Routes tab | `panels/LibraryPanel.tsx`, `panels/library/RoutesTab.tsx`, `panels/library/RouteCard.tsx`, `RouteThumb.tsx` |
| 02b | Collections | `panels/library/CollectionsTab.tsx`, `CollectionDetail.tsx` |
| 03 | Discover | `panels/DiscoverPanel.tsx`, `panels/discover/DiscoverRouteCard.tsx` |
| 04 | Route detail | `panels/RouteDetailPanel.tsx` |
| 05 | Social feed | `panels/SocialPanel.tsx`, `panels/social/FeedTab.tsx` |
| 06 | Settings (root) | `panels/SettingsPanel.tsx`, `components/settings.tsx` |
| 07 | Public route page | public route view |
| 08 | Public profile | `panels/social/ProfileView.tsx` + public profile route |
| 09–13 | Generate modal (A/B/C), candidate picker, NL editing | `modals/LoopModal.tsx` → becomes the new Generate modal; `features/generation/*`. **Build option B (split).** See §"Generate flow" |
| 14 | Library empty | `LibraryPanel` empty state |
| 15 | Sign-in gate | existing `SignInGate` |
| 16 | Discover edge states | `DiscoverPanel` (beta notice, waiting, error, empty) |
| 17 | Route detail edge states | `RouteDetailPanel` (make-public confirm, provenance) |
| 18 | Route card hover + menu | `RouteCard.tsx` `DropMenu` |
| 19 | Send route to user | `panels/social/ShareRouteDialog.tsx` |
| 20 | Profile & Following | `ProfileView.tsx`, `panels/social/FollowingTab.tsx` |
| 21 | Settings — Sports & pacing | settings sub-page |
| 22 | Settings — Map & display | settings sub-page (+ accent swatch → `[data-accent]`, language, theme) |
| 23 | Settings — Privacy & Advanced | settings sub-page, `ApiTokensSection.tsx` |
| 24 | Save modal | `modals/SaveModal.tsx` |
| 25 | Confirm delete | `modals/ConfirmDeleteModal.tsx` |
| 26 | Share modal | `modals/ShareModal.tsx` |
| 27 | Import modal | `modals/ImportModal.tsx` |
| 28 | Routing preferences | `modals/RoutingModal.tsx` |
| 29 | Command palette | `modals/CommandPalette.tsx`, `modals/SearchModal.tsx` |

---

## Icon mapping (spec glyph → lucide / `I.*`)

`✎`=edit/pencil · `▤`=library/layers · `◈`=compass/discover · `♡`=heart/social · `⚙`=settings · `✦`=sparkles (AI) · `⬡`=hexagon (node networks) · `⌑`/`📍`=map-pin · `↯`=zap/direct-line · `⠿`=grip (drag) · `⇅`=arrow-up-down (reverse/sort) · `↩`=corner-down-left (back to start) · `⤴`=share · `↥`/`↓`=download/import · `⧉`=copy · `⟳`/`↻`=refresh · `▲`=alert-triangle · `›`=chevron-right. Use the existing wrapper, keep sizes consistent with current usage (don't shrink below the app's current icon scale).

---

## Generate flow (frames 09–13, 28) — the one new behavior

Today this is `LoopModal`. The redesign turns it into a richer **Generate** modal + a **candidate picker** + an optional **natural-language layer**. Decisions already made with the designer:

- **Use option B — the split modal** (frame 12): left = a **refinement log** (chat-style turns that each collapse to a mono diff line; one-line input pinned at the bottom — NOT a growing textarea), right = the **live form** (tabs, start/end, distance slider, surface, node-networks toggle, pass-through). When the NL parse lands, the corresponding control updates **with a brief highlight/animation** (240ms, the same easing as the existing panel transition). An utterance can switch Loop→A-to-B itself.
- **Candidate picker** (frame 10): after Generate, show scored candidate **cards in the panel** with surface-mix bars, overlap as "% repeat", async elevation filling in (`↗ …` → value). On hover, **highlight that candidate's geometry on the map** (this handshake is the whole point — keep cards in the panel, routes on the map). Include the `all_candidates_low_quality` failure state (frame 10, bottom).
- **NL is additive and gated.** Every `✦` surface (interpret line, NL Discover search, generated prose, tag suggestions, edit-by-typing) must **render nothing when no LLM key is configured** — they are enhancements, never required paths. This tracks ticket **#312** (translator over deterministic surfaces; fill-the-form, never a chatbot; unresolved places become "pick on map" chips, never guessed coordinates). Frames 11 and 13 are forward-looking — scaffold the UI but it's fine to ship them behind a flag.

The working **`Routess Prototype.dc.html`** (also in this project) demonstrates the option-B parse animation and the card↔map hover linkage end-to-end — use it as the interaction reference.

---

## Definition of done

- Every panel, modal, and state in the spec is reproduced in the live app using real tokens, real lucide icons, real data/props.
- Light **and** dark mode both correct (tokens already have dark variants — verify, don't assume).
- Responsive: the spec shows desktop; honor the existing mobile bottom-tab + sheet layout (`BottomTabBar.tsx`) — restyle to match, don't regress it.
- No hardcoded spec copy; no duplicated-token hex; no removed functionality.
- i18n: keep using `useT()` / `t("…")` keys — add new keys for any new strings (Generate flow, edge states), don't inline English.
- Accessibility preserved: focus states, `aria-*`, keyboard nav on modals and the command palette.

## Process

1. Start with the **shell + Plan (frame 01)** — it establishes the rail/panel chrome and token usage everything else inherits.
2. Then panels (02–08), then states (14–20), then settings sub-pages (21–23), then modals (24–29), then the Generate flow (09–13).
3. Open a PR per section. In each PR description, list which frame #s it covers and any place you had to deviate from the spec (and why).
4. If anything in the spec conflicts with existing logic or is ambiguous, **ask before guessing**.
