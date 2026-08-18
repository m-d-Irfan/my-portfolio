# Design language

What makes an admin console read as considered rather than generated.

## Tokens, never literals

Every colour in every component is `var(--color-*)`. Copy
[`assets/admin-tokens.css`](../assets/admin-tokens.css) and change the nine
values in `:root`.

This is not a style preference. The previous version of this skill described
itself as "theme-adaptive" and then hardcoded roughly forty `#2D2722` /
`#7E5638` / `#FAF7F2` literals into `className` strings. Every project built
from it came out the same brown, and retheming meant a find-and-replace across
every file. The indirection *is* the adaptability.

Derive the values from what the host project already has — its
`tailwind.config.js`, its `index.css`. Do not invent a palette next to an
existing one.

```bash
grep -rnE "#[0-9a-fA-F]{3,8}" src/pages/Admin/
# PASS: no output
```

If `ui-design-system` is installed, take tokens from its `tokens.css` instead
of redefining them.

## Depth instead of borders

A flat `border-gray-200` on a white card is the strongest "template" signal in
an admin UI. Replace it with three layered cues:

| Cue | Value |
|---|---|
| Surface | `linear-gradient(to bottom, --color-surface-light, --color-surface-dark)` |
| Shadow | Two stacked: a tight contact shadow **and** a wide ambient one |
| Border | A translucent hairline, `rgb(184 164 143 / 0.25)` — not a solid grey |

```css
box-shadow:
  0 10px 35px -5px rgb(45 39 34 / 0.10),   /* ambient  */
  0 4px 12px -2px  rgb(45 39 34 / 0.05);   /* contact  */
```

Two shadows rather than one because that is how physical objects sit on a
surface: a soft wide halo plus a darker line where the object nearly touches.
A single large blur reads as a glow.

Use `.card-depth` from the tokens file rather than repeating the stack.

Keep the gradient subtle — the two stops should be within a few percent
lightness. A visible gradient on every card looks like 2013.

## Density

Admin users scan hundreds of rows. Storefront spacing wastes their time; too
tight and rows blur together.

| Element | Value |
|---|---|
| Table cell padding | `p-4` (16px) |
| Row height | 48–56px |
| Body text | `text-sm` (14px) |
| Labels, metadata | `text-xs` (12px) |
| Section gap | `space-y-6` (24px) |
| Card padding | `p-6` |

Numbers get `tabular-nums`. Without it, digit widths differ and a column of
prices will not align vertically — the single most noticeable typographic flaw
in a data table.

## Hierarchy

Three levels, no more. A page where everything is bold has no emphasis at all.

1. **Page title** — `font-serif text-2xl font-bold`, in the banner
2. **Section headings** — `text-sm font-semibold uppercase tracking-wide`
3. **Body** — `text-sm`, muted for secondary values

The serif/sans pairing is what makes the console feel deliberate: serif for
titles and headings, sans for all data. Reversing it makes tables hard to scan.

## Status colour

Status is semantic and **never** the only signal. Pair every colour with a
label or an icon.

| State | Token | Label |
|---|---|---|
| Active, paid, delivered | `--color-success` | "Active" |
| Pending, low stock | `--color-warning` | "Pending" |
| Cancelled, failed, out of stock | `--color-danger` | "Cancelled" |
| Draft, informational | `--color-info` | "Draft" |

A green dot with no text is unreadable to a colour-blind user, and it prints as
grey. Use `.badge-success` and its siblings, which carry text by construction.

## Motion

Motion clarifies causality — what changed, and because of what. It is not
decoration.

| Interaction | Duration |
|---|---|
| Hover, focus | 150ms |
| Card lift, expand | 200ms |
| Route change, modal | 250–300ms |
| Anything | Never over 400ms |

Animate `transform` and `opacity`. Animating `width`, `height`, `top` or
`left` triggers layout on every frame and drops the animation below 60fps on a
mid-range laptop with a large table open.

`assets/admin-tokens.css` includes the `prefers-reduced-motion` block. Keep it —
sustained motion is genuinely painful for people with vestibular disorders.

For anything beyond hover and lift, use `transitions-dev`; that skill owns
motion and has 27 documented transitions.

## The anti-slop checks

What separates a considered console from a generated one, in rough order of how
often it is missed:

- **Empty states say what to do next**, not "No data". "No orders yet. Orders
  appear here once a customer checks out."
- **Loading states match the shape of what is coming** — skeleton rows in the
  table, not a centred spinner that shifts the whole layout when data lands.
- **Error states offer a retry.** A red toast that vanishes leaves the user
  with a blank table and no way forward.
- **Destructive actions confirm**, and the confirmation names the thing:
  "Delete Teak Door 900mm?" not "Are you sure?"
- **Numbers are right-aligned and tabular.** Text is left-aligned.
- **Long values truncate with a title attribute**, not wrap to three lines and
  break every row height in the table.
- **Focus is visible.** Do not remove the outline.
- **Nothing shifts after load.** Reserve space for images and async values.

The first three are where most admin panels fail. They are also the cheapest to
fix, and they are what users actually notice.

For open-ended visual critique — "does this look good", "make this feel
premium" — use the `impeccable` skill. It owns judgement; this file owns the
console-specific rules.

## Verification

```bash
# No hex literals in admin components.
grep -rnE "#[0-9a-fA-F]{3,8}" src/pages/Admin/ src/pages/Inventory/
# PASS: no output

# Numeric columns are tabular.
grep -rn "tabular-nums" src/pages/Admin/
# PASS: at least one hit per table with a numeric column

# Reduced motion is respected.
grep -rn "prefers-reduced-motion" src/styles/
# PASS: one hit
```

Retheme test, the real one: change `--color-accent` in `:root` to `#0f766e`
and reload. Every active nav pill, button, hairline and focus ring should turn
teal. Anything still brown is a hardcoded literal.
