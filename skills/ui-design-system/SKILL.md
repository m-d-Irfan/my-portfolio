---
name: ui-design-system
description: The token layer and component primitives that make an interface look designed rather than generated — colour, type scale, spacing, radius, elevation, states, focus, and the specific tells of generic AI-built UI. Use when starting a new frontend, setting up Tailwind or CSS variables, picking a palette or type scale, building a button/input/card/badge/table primitive, fixing an interface that "looks like a template", or adding empty/loading/error states. Trigger on "design system", "design tokens", "set up Tailwind", "pick a palette", "type scale", "spacing scale", "it looks generic", "looks AI-generated", "make it look designed", "dark mode", "component variants", "focus ring", "empty state", "loading state", "theme the app", "retheme".
---

# UI design system

The token layer every other frontend skill reads from. One palette, one type
scale, one spacing scale, one radius scale, one elevation scale — defined once
and referenced everywhere.

## When to use

- Starting a frontend, or setting up `tokens.css` / `tailwind.config.js`
- Building or fixing a primitive: button, input, card, badge, table, modal
- An interface that works but "looks like a template"
- Adding the loading / empty / error / partial states a view is missing
- Retheming, or adding dark mode

Do **not** use it for open-ended visual judgement — "does this look good",
"make this feel premium", "redesign this page", live browser iteration. That is
`impeccable`. This skill owns *the project's tokens*; `impeccable` owns
*taste*. Charts, KPI tiles and dashboards are `dataviz`.

## The rule

**No literal design value in a component.** Not a hex, not a `px` radius, not a
shadow stack, not a font size off the scale. Every one is `var(--*)` or a
Tailwind class bound to a token.

This is mechanical, not aesthetic. `admin-panel-builder` previously called
itself theme-adaptive while hardcoding ~40 brand hexes into `className`
strings, so every project built from it came out the same brown and retheming
meant a find-and-replace across every file. The indirection *is* the
adaptability. It is also the only version of the claim that can be verified:

```bash
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/components/ src/pages/
# PASS: no output
```

## Route by task

| Task | Read |
|---|---|
| Palette, dark mode, semantic vs brand colour, contrast maths | [01-tokens.md](references/01-tokens.md) |
| Type scale, pairing, measure, weights, numerals | [02-typography.md](references/02-typography.md) |
| Spacing scale, grid, container widths, breakpoints, alignment | [03-layout.md](references/03-layout.md) |
| Button / input / card / badge / table variants and sizes | [04-components.md](references/04-components.md) |
| Loading, empty, error, partial, success — the five states | [05-states.md](references/05-states.md) |
| Contrast, focus, keyboard, reduced motion, targets, labels | [06-accessibility.md](references/06-accessibility.md) |
| "It looks generated" — the tells and their fixes | [07-anti-slop.md](references/07-anti-slop.md) |

Copy [`assets/tokens.css`](assets/tokens.css) into the global stylesheet before
writing a component, and [`assets/tailwind.config.js`](assets/tailwind.config.js)
if the project uses Tailwind. The Tailwind config reads the CSS variables rather
than restating the values — two sources of truth for one palette drift within a
week.

## Decisions

**Brand token or semantic token?** Components reference semantic names
(`--color-danger`, `--color-surface`), never brand names (`--color-teak`). A
semantic layer is what lets a rebrand touch one file, and what lets dark mode
swap surfaces without touching a component.

**Tailwind or plain CSS?** Whichever the project already uses. If Tailwind,
bind the theme to the CSS variables so runtime theming still works. Never both
palettes side by side — that is how a project ends up with `bg-brown-700` and
`bg-[#7e5638]` meaning almost the same thing.

**How many shades per colour?** Two brand stops and one "on" colour is enough
for most projects: base, soft, and the text colour that sits on the base.
Generating a 50–950 ramp you use three of is busywork.

**Dark mode now or later?** Now or never. Retrofitting means auditing every
component for an assumed light background. If the project will not have dark
mode, delete the `prefers-color-scheme` block rather than leaving it half done.

**Off-scale value, ever?** Only optical corrections, and only with a comment
saying what is being corrected — an icon nudged 1px to sit on the text baseline
is legitimate; `mt-[13px]` because it looked better is not.

## Workflow

1. Read the host project's existing `index.css` / `tailwind.config.js`. Derive
   the palette from what is there. Never introduce a second palette next to one
   that already exists.
2. Copy `assets/tokens.css`; replace the values in `:root` — brand stops first,
   then confirm each pairing's contrast per [06](references/06-accessibility.md).
3. Copy `assets/tailwind.config.js` if Tailwind is in use.
4. Build primitives from [04](references/04-components.md) — variants and sizes
   as data, not as one-off classNames per usage site.
5. For every view, ship the five states from [05](references/05-states.md)
   before styling the populated one.
6. Run the retheme test, then
   [checklists/design-system-acceptance.md](checklists/design-system-acceptance.md).

## What this skill does not own

| Concern | Owner |
|---|---|
| Visual judgement, redesign, live browser polish | `impeccable` |
| Charts, stat tiles, KPI rows, chart palettes | `dataviz` |
| Motion values, transitions, micro-interactions | `transitions-dev`, `transitions-polish` |
| Admin shell, sidebar, CRUD table pattern | `admin-panel-builder` |
| Form wiring, validation, error mapping | `forms-and-validation` |
| Image formats, bundle size, LCP | `performance-budget` |
| Whether a hidden control is actually protected | `security-hardening` |

`admin-panel-builder`'s `admin-tokens.css` is a superset of this file's
`:root` for console-specific depth and density. If both are installed, this
file is the source of truth for colour and the admin file adds only the
`--shadow-*` and density values on top. Do not define a colour twice.

## Verification

```bash
# 1. No literal colour in components.
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/components/ src/pages/
# PASS: no output

# 2. No off-scale type or spacing.
grep -rnE "text-\[[0-9]|p-\[[0-9]|m-\[[0-9]|gap-\[[0-9]" src/
# PASS: no output, or a comment on the same line naming the optical correction

# 3. Focus is never removed.
grep -rn "outline-none\|outline: none" src/
# PASS: every hit is paired with focus-visible styling on the same element

# 4. Reduced motion is honoured.
grep -rn "prefers-reduced-motion" src/
# PASS: at least one hit
```

**The retheme test** is the one that proves the tokens are real. Set
`--color-accent: #0f766e` in `:root`, reload, and every button, active state,
hairline, link and focus ring should be teal. Anything still the old colour is
a literal. Then set `--radius-md` to `0` and confirm the whole UI squares off.

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| — | ~40 brand hexes hardcoded in `className` while claiming theme-adaptive | [01](references/01-tokens.md) |
| — | `bg-radial from-… to-…` used as a Tailwind v3 utility, which it is not | [04](references/04-components.md) |
| — | Views shipping no empty, loading or error state | [05](references/05-states.md) |
| **P3** (part) | Decorative background images chosen before a budget existed | delegated to `performance-budget` |
