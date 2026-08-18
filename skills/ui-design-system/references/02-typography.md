# Typography

Type does more of the work of "looking designed" than colour does, and it is
where generated interfaces give themselves away fastest.

## One scale, no exceptions

`tokens.css` ships a 1.25 (major third) scale from a 16px base. Every size in
the app is one of those eight steps.

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 12px | Metadata, table labels, badge text |
| `--text-sm` | 14px | Body in dense UI, table cells, form labels |
| `--text-base` | 16px | Body copy, inputs (see below) |
| `--text-lg` | 20px | Card titles, section leads |
| `--text-xl` | 25px | Page section headings |
| `--text-2xl` | 31px | Page titles |
| `--text-3xl` | 39px | Hero secondary |
| `--text-4xl` | 49px | Hero primary |

**Why a ratio matters.** Ad-hoc sizes — 15px here, 17px there, 22px because it
fit — produce an interface where nothing looks intentionally larger than
anything else, just *differently* sized. A fixed ratio means every size
relationship in the UI is the same relationship, and the eye reads that as
system.

```bash
grep -rnE "text-\[[0-9]+px\]|fontSize: ['\"]?[0-9]" src/
# PASS: no output
```

**Inputs are 16px on mobile, always.** Safari on iOS zooms the viewport when a
focused input has a font size below 16px, and the zoom does not reverse. This
is the single most common mobile bug in an otherwise finished form.

## Line height shrinks as size grows

A 49px heading at `1.6` looks unglued from itself; 14px body at `1.2` is
unreadable. The scale in `tokens.css` pairs each size with its leading, and the
Tailwind config binds them together so `text-2xl` cannot be used with a leading
chosen for `text-sm`.

Roughly: body 1.5–1.6, subheads 1.3–1.45, display 1.05–1.2.

## Measure

Body copy caps at **66–75 characters** per line — `--container-prose` is `68ch`.
Beyond that the eye loses the line return and re-reads the same line.

This is a *character* count, not a pixel width, which is why the token is in
`ch` and not `rem`. A 700px column at 14px and at 18px are different measures.

Table cells and form fields are exempt — they are scanned, not read.

## Pairing

Two families maximum. Three is a redesign in progress.

The reliable pattern for this project's stack: **serif for titles and headings,
sans for all data and UI**. It reads as deliberate because the contrast is
structural rather than decorative — the reader can tell at a glance which text
is chrome and which is content.

Reversing it (sans headings, serif data) makes tables hard to scan: serifs at
14px in a dense grid blur together.

If the project has one family, get the contrast from **weight and size**, not
from a second family bolted on. 400 vs 600 at two scale steps apart is plenty.

## Weight

Four weights: 400, 500, 600, 700. Load exactly the ones used.

- **400** — body, table cells
- **500** — form labels, nav items, emphasised metadata
- **600** — headings, buttons, table headers
- **700** — page titles, and nothing else

`font-weight: 900` and hairline 100 are display faces pretending to be UI type.
At UI sizes 900 fills in and 100 disappears on a non-retina screen.

Never use faux bold or faux italic — if the weight is not loaded, the browser
synthesises it by smearing the glyphs, and it looks exactly as bad as that
sounds.

## Numerals

Anything in a column — prices, quantities, order ids, dates, counters —
gets `font-variant-numeric: tabular-nums`. `tokens.css` ships a `.numeric`
class that also right-aligns.

Without it, `1` is narrower than `8` in most proportional faces and a column of
৳ figures will not line up. It is the most noticeable typographic flaw in a
data table and takes one class to fix.

```bash
grep -rn "tabular-nums\|\.numeric" src/pages/
# PASS: at least one hit per view with a numeric column
```

Currency: `৳1,250.00` — symbol, no space, thousands separators, two decimals
consistently. `৳1250` and `৳1,250.00` in the same table is the kind of detail
that makes a UI feel unfinished without the reader knowing why.

## Loading fonts

- `font-display: swap` — otherwise text is invisible for up to 3s on a slow
  connection.
- `<link rel="preload">` the one face used above the fold. One. Preloading six
  is the same as preloading none.
- Subset to the character sets actually used. A full Latin+Cyrillic+Greek
  weight is 300KB+ per file; `performance-budget` counts that against the LCP
  budget.
- Set a `size-adjust` fallback, or accept the layout shift when the web font
  lands. Reserving the space is cheaper than the CLS penalty.

## Casing and content

- **Sentence case for UI text.** "Order details", not "Order Details". Title
  Case in an interface reads as a marketing site.
- **ALL CAPS only for overlines**, at `--text-xs` with `--tracking-wide`.
  Uppercase without added tracking looks cramped because the letterforms were
  spaced for mixed case.
- **Never justify.** Browsers have no hyphenation dictionary by default, so
  justified text produces rivers of whitespace.
- **`text-wrap: balance`** on headings of two or three lines; `text-wrap:
  pretty` on body copy to prevent orphans. Both are one line of CSS and both
  are noticeable.

## Verification

```bash
# Off-scale sizes.
grep -rnE "text-\[[0-9]|fontSize: ['\"]?[0-9]" src/
# PASS: no output

# Mobile input zoom.
grep -rn "input" src/ | grep -E "text-xs|text-sm" | grep -v "sm:"
# REVIEW: each hit must be desktop-only or ≥16px at the mobile breakpoint

# Faux weights.
grep -rnE "font-(black|thin|extralight)" src/
# PASS: no output unless the face genuinely ships those weights
```

For judgement on whether the pairing is *good* — rather than merely consistent
— use `impeccable`. This file owns the system; that skill owns the taste.
