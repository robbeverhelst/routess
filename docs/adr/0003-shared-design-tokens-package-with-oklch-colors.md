# Shared design tokens package using OKLCH colors

Design values (colors, typography, spacing, border radius, animation timings) live in `@routess/design-tokens` and are consumed by every app — web (via CSS variables / utility functions), the docs site, and any future native app. Colors are expressed in OKLCH rather than hex/RGB so that perceptually-uniform shifts (lightness, chroma) compose predictably across the product's themes, and so future native consumers can derive platform-specific color objects from the same canonical source. An earlier iteration auto-flipped to dark mode based on system preference; this was reverted because it overrode product defaults — see the "Fixed dark mode issue" note in CLAUDE.md.

## Considered options

- **Tailwind defaults / per-app Tailwind configs** — rejected: drift between web and native, and no clean handoff to non-CSS targets.
- **Hex colors in tokens** — rejected: harder to reason about derived shades and accessibility contrast across themes.
