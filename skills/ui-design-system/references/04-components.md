# Components

Primitives, and the rule that keeps them primitives.

## Variants are data, not copies

**WRONG**

```jsx
<button className="bg-accent text-accent-on px-4 py-2 rounded-md font-semibold">
<button className="bg-accent text-accent-on px-4 py-2 rounded-md font-semibold shadow-resting">
```

Two buttons that were meant to be identical and are not. This is how a codebase
ends up with eleven button styles nobody chose.

**RIGHT**

```jsx
const variants = {
  primary:   'bg-accent text-accent-on hover:brightness-110',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-sunk',
  ghost:     'bg-transparent text-text hover:bg-surface-sunk',
  danger:    'bg-danger text-white hover:brightness-110',
};
const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
```

Four variants and three sizes cover everything. If a fifth variant is needed,
it is usually a `secondary` in a different context — check before adding.

## Button

Every button ships all of: default, hover, active, focus-visible, disabled, and
**loading**. Loading is the one that gets skipped and the one that causes
duplicate orders.

```jsx
<button disabled={loading} aria-busy={loading}>
  {loading ? <Spinner aria-hidden /> : icon}
  <span>{loading ? 'Placing order…' : 'Place order'}</span>
</button>
```

Rules:

- **Width does not change** between idle and loading. A button that shrinks
  when its label becomes "Saving…" makes the whole row jump. Reserve the width,
  or keep the label and add the spinner beside it.
- **Disabled must look disabled and stay 3:1 legible.** `opacity-50` on an
  already-muted button drops it below readable.
- **A disabled submit is not double-submit prevention.** The state has to be
  set before the request, and the server needs the idempotency key
  (`data-layer/05`). React will happily fire two clicks in the same tick.
- **Icon-only buttons need `aria-label`.** Always. There is no exception where
  the icon is "obvious".
- **44×44px minimum touch target** on mobile, including padding.

`<button type="submit">` and `<button type="button">` explicitly — the default
inside a form is `submit`, which is how a "Add another row" button reloads the
page.

## Input

The label is a `<label htmlFor>`, not a paragraph above the field, and not a
placeholder.

Placeholder-as-label fails four ways: it disappears on focus (so the user
forgets what the field was), it is unreadable at typical placeholder contrast,
screen readers may not announce it, and autofill covers it.

```jsx
<label htmlFor="phone">Phone</label>
<input
  id="phone" type="tel" inputMode="numeric" autoComplete="tel"
  aria-invalid={!!error} aria-describedby={error ? 'phone-error' : 'phone-hint'}
/>
<p id="phone-hint" className="text-sm text-text-muted">01XXXXXXXXX</p>
{error && <p id="phone-error" role="alert" className="text-sm text-danger">{error}</p>}
```

- **`inputMode` and `autoComplete` on every field.** A numeric keypad for a
  phone number is a one-attribute change users notice immediately.
- **Error state is never colour alone** — border plus icon plus text. Red
  border on its own is invisible to ~8% of male users.
- **The error message says what to do**: "Phone must be 11 digits starting
  01", not "Invalid input".
- **16px font size on mobile** or iOS zooms the viewport, permanently.

Form wiring, validation timing and API error mapping belong to
`forms-and-validation`. This file owns the field's appearance and semantics.

## Card

```jsx
<article className="bg-surface rounded-lg shadow-resting p-6">
```

Elevation by intent, not by blur size:

| Token | Means |
|---|---|
| `--shadow-resting` | Sits on the page. Lists, static cards. |
| `--shadow-raised` | Interactive, or above its neighbours. Hovered cards. |
| `--shadow-floating` | Temporarily above the page. Dropdowns, popovers. |
| `--shadow-overlay` | Modal layer. |

Two rules: **one elevation level per surface** (a raised card containing a
raised card reads as noise), and **`shadow-md` on everything is the same as
shadow on nothing** — if every element is elevated, none is.

Prefer a background-colour step to a border for separation. A 1px
`border-gray-200` on white is the strongest template signal in a UI. Where a
line is genuinely needed, use `--color-border` (a translucent tint of the text
colour) rather than a solid grey — it adapts to dark mode for free.

Radius follows size: `--radius-sm` on a badge, `--radius-lg` on a card,
`--radius-xl` on a modal. Uniform `rounded-lg` on a 20px chip and a 600px panel
is the tell described in [07-anti-slop.md](07-anti-slop.md).

## Badge

Status is semantic and never carried by colour alone. `tokens.css` pairs each
status with a `-bg`; the label is required.

```jsx
<span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5
                 text-xs font-semibold uppercase tracking-wide
                 text-success bg-success-bg">
  <CheckIcon aria-hidden /> Delivered
</span>
```

A bare coloured dot is unreadable to a colour-blind user and prints grey.

## Table

- Header: `text-xs font-semibold uppercase tracking-wide`, background
  `--color-surface-sunk`, sticky on scroll.
- Numeric columns: `.numeric` (tabular + right-aligned). Headers align with
  their content.
- Row height 48–56px, cell padding `--space-4`. Admin users scan hundreds of
  rows; storefront spacing wastes their time.
- Long values truncate with `title=` — wrapping to three lines breaks every row
  height in the table.
- Row actions are visible, not hover-revealed. Hover-only actions do not exist
  on touch and are undiscoverable on desktop.
- Below `md`, a six-column table becomes a card list. Horizontal scroll on a
  phone is a last resort, and if used, the first column pins.

Every table ships the five states from [05-states.md](05-states.md). A table
with no empty state renders as a header row and nothing else, which reads as a
bug.

## Modal

- Focus moves into the modal on open and returns to the trigger on close.
- Focus is trapped inside while open.
- `Escape` closes. Backdrop click closes unless there is unsaved input.
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing at the title.
- Background scroll locks — but preserve the scroll position, or the page jumps
  to the top on close.
- `--z-modal`, `--shadow-overlay`, `--radius-xl`.

Anything with tabs, uploads, or more than ~8 fields is a route, not a modal.
Routes are linkable and survive a refresh.

## Things that do not compile or do not exist

Verify a utility exists in the project's Tailwind version before using it.
`admin-panel-builder` previously shipped `bg-radial from-… to-…`, which is not
a Tailwind v3 utility at all — the class silently did nothing, and nobody
noticed because a missing background looks like a design choice.

```bash
npx tailwindcss --help >/dev/null 2>&1 && npx tailwindcss -v
# then check the class against that version's docs
```

The same applies to `text-wrap: balance`, `field-sizing`, `@starting-style` and
`100dvh` — all fine in current browsers, all silently ignored in older ones.
Silently-ignored CSS is the failure mode to watch for, because nothing errors.

## Verification

```bash
# Icon-only buttons are labelled.
grep -rn "<button" src/ -A2 | grep -B1 -E "Icon|svg" | grep -v "aria-label"
# PASS: no output

# Inputs have real labels.
grep -rn "placeholder=" src/ | grep -v "aria-label\|htmlFor\|<label"
# REVIEW: each hit needs an associated <label>

# Button type is explicit inside forms.
grep -rn "<button" src/ | grep -v "type="
# PASS: no output

# One elevation vocabulary.
grep -rnE "shadow-(sm|md|lg|xl|2xl)\b" src/
# PASS: no output — use shadow-resting/raised/floating/overlay
```
