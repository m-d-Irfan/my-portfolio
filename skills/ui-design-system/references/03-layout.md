# Layout

Spacing, grid, and alignment. The layer where "generated" is most visible and
cheapest to fix.

## Spacing communicates grouping

This is the rule the other spacing rules serve. Elements that belong together
sit closer than elements that do not, and the *ratio* between those two
distances is what the eye reads as structure.

**WRONG** — uniform `space-y-4` down the page. Every element equidistant from
every other. The reader has to parse the content to find the groups, because
the layout gives them nothing.

**RIGHT**

```jsx
<section className="space-y-8">        {/* between sections: --space-8 */}
  <div className="space-y-2">          {/* label → field: --space-2 */}
    <label>Product name</label>
    <input />
    <p className="text-sm">Shown on the storefront.</p>
  </div>
  <div className="space-y-2">
    <label>Category</label>
    <select />
  </div>
</section>
```

A label 8px from its input and 32px from the previous field needs no divider
line, no box, and no heading to read as a group.

The corollary: **a label closer to the field above it than to its own field is
a bug**, and it is extremely common. Check the rendered gaps, not the JSX
nesting.

## The scale

4px base, named by step. Use `--space-1` … `--space-24`; never a raw pixel.

| Step | Value | Typical use |
|---|---|---|
| `--space-1` | 4px | Icon-to-label inside a button |
| `--space-2` | 8px | Label to field, badge padding |
| `--space-3` | 12px | Input padding, tight list rows |
| `--space-4` | 16px | Table cell padding, card internal gap |
| `--space-6` | 24px | Card padding, between form fields |
| `--space-8` | 32px | Between sections |
| `--space-12` | 48px | Between major page blocks |
| `--space-16` / `--space-24` | 64 / 96px | Page top and bottom, landing sections |

An off-scale value needs a comment naming the optical correction it makes.
`mt-[13px]` with no comment is a value someone nudged until it looked right,
and it will not survive a font change.

```bash
grep -rnE "(p|m|gap|space)-\[[0-9]+px\]" src/
# PASS: no output, or a same-line comment naming the correction
```

## Containers

| Token | Width | Use |
|---|---|---|
| `--container-prose` | 68ch | Body copy, articles, terms pages |
| `--container-app` | 80rem | Standard app and storefront pages |
| `--container-wide` | 96rem | Data tables, dashboards, image grids |

Content does not run edge to edge on a 27" monitor. Nothing signals "unstyled"
faster than a paragraph 1800px wide.

Horizontal page padding scales with the viewport: `--space-4` on mobile,
`--space-8` from `md`, `--space-12` from `xl`. A 16px gutter on a desktop
monitor looks like the CSS failed to load.

## Grid

Use CSS Grid for two-dimensional layout, Flexbox for one-dimensional. Not
because of a rule — because `justify-between` on a wrapping row produces
uneven final-row spacing, and grid does not.

The pattern that removes most responsive breakpoints:

```css
grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
```

Cards reflow at whatever width they need to, with no media query. Use
`auto-fill` (keeps empty tracks, so three cards in a five-track row stay
card-width) rather than `auto-fit` (collapses empty tracks, so three cards
stretch to a third of the screen each).

For a dashboard or admin shell, name the areas — a `grid-template-areas` block
is readable in a way that six nested flex containers is not.

## Breakpoints

Tailwind's defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
Do not invent new ones. Mobile-first — write the mobile styles unprefixed and
add `md:` upward.

Three breakpoints do real work in most projects:

- **`md`** — sidebar appears, single column becomes two
- **`lg`** — tables stop being horizontally scrollable, three columns appear
- **`xl`** — max width caps, gutters widen

Test at **320px**. It is the narrowest phone still in real use, and it is where
a table with six columns and a fixed-width sidebar breaks. If 320 works,
everything above it works.

## Alignment and optical correction

**One alignment axis per region.** Left-aligned label above a centred field
above a right-aligned button reads as three unrelated things.

Centre only what is genuinely symmetric and short: an empty state, a modal
title, a login card. Centred body copy over three lines is hard to read because
each line starts in a different place.

Numbers right-align. Text left-aligns. Table headers align with their column's
content — a left-aligned "Price" header over right-aligned figures is a
mismatch the eye catches immediately.

Optical corrections that are legitimate, each with a comment:

- An icon-only button needs slightly less right padding than left when the
  glyph has trailing whitespace baked in.
- A circular avatar next to square cards sits ~1px low against a shared
  baseline.
- A play triangle in a circular button centres ~2px right of geometric centre.

Everything else is a nudge, and nudges do not survive a font or icon-set change.

## Sticky, fixed, and z-index

Use the named `--z-*` layers. An arbitrary `z-index: 9999` is a bug report from
the future — the next person needs something above it and writes 10000.

A sticky header needs `scroll-margin-top` on anchor targets, or in-page links
land with the heading hidden underneath it.

A fixed element on mobile must account for the browser chrome that appears and
disappears on scroll. `100vh` is wrong on iOS Safari; use `100dvh`.

## Verification

```bash
# Off-scale spacing.
grep -rnE "(p|m|gap|space)-\[[0-9]+px\]" src/
# PASS: no output

# Arbitrary z-index.
grep -rnE "z-\[?[0-9]{3,}" src/
# PASS: no output

# Viewport height on mobile.
grep -rn "100vh" src/
# PASS: no output — use 100dvh

# Uniform spacing (a grouping smell, not an error — review each hit).
grep -rn "space-y-4" src/pages/ | wc -l
# REVIEW: if this is the only spacing value in a page, grouping is not encoded
```

In a browser: resize from 320px to 1920px continuously and watch for the width
where something overlaps, overflows horizontally, or leaves a stranded orphan
in a grid. Those three are almost always the only responsive bugs present.
