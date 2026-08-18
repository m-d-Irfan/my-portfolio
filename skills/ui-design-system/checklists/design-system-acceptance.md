# Design system acceptance

Run before declaring frontend work done. Each line is written to be
mechanically checkable, so `testing-harness` can turn it into a test.

## 1. Tokens

- [ ] `tokens.css` is imported once, before any component styles
- [ ] No hex, `rgb()` or `hsl()` literal anywhere under `src/` except
      `tokens.css` — `grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/ --include=*.jsx`
- [ ] No brand-named class in a component (`teak-700`, `muqam-*`)
- [ ] No `--color-*` name is defined in two files —
      `grep -rhoE "^\s+--color-[a-z-]+:" src/styles/*.css | sort | uniq -d`
- [ ] `--color-on-accent` is set and used on every accent-background element
- [ ] Retheme test: `--color-accent: #0f766e` turns every branded element teal
- [ ] Radius test: `--radius-md: 0` squares off the whole UI

## 2. Contrast

- [ ] Body text ≥ 4.5:1 against its background, light and dark
- [ ] Large text, meaningful icons and focus rings ≥ 3:1
- [ ] Placeholder text ≥ 4.5:1
- [ ] Disabled controls ≥ 3:1
- [ ] Text over an image has a scrim
- [ ] `--color-text-subtle` is used only at `--text-sm`+ or on icons

## 3. Typography

- [ ] Every font size is a scale token — `grep -rnE "text-\[[0-9]" src/` is empty
- [ ] Inputs are ≥ 16px at the mobile breakpoint (iOS zoom)
- [ ] Body copy is capped at `--container-prose`
- [ ] At most two families
- [ ] Numeric columns use `.numeric` / `tabular-nums`
- [ ] Currency is formatted consistently (`৳1,250.00`)
- [ ] Only loaded weights are used — no faux bold or italic
- [ ] `font-display: swap` on every `@font-face`

## 4. Layout

- [ ] Every spacing value is a scale token, or has a comment naming the optical
      correction
- [ ] Related elements are visibly closer than unrelated ones
- [ ] Page content is capped at a container width
- [ ] Gutters scale with the viewport
- [ ] No `z-index` outside the `--z-*` layers
- [ ] `100dvh`, not `100vh`
- [ ] No horizontal page scroll at 320px
- [ ] Numbers right-aligned, text left-aligned, headers matching their column

## 5. Components

- [ ] Button variants and sizes are data, not per-usage classNames
- [ ] Every button has default, hover, active, focus-visible, disabled and
      loading states
- [ ] Button width does not change between idle and loading
- [ ] Every `<button>` inside a form has an explicit `type`
- [ ] Every icon-only control has `aria-label`
- [ ] Every input has a `<label htmlFor>` — placeholder is not the label
- [ ] Every input has `inputMode` and `autoComplete` where a standard token exists
- [ ] Error states use border + icon + text, never colour alone
- [ ] Elevation uses the four named intents, not Tailwind's `shadow-*` scale
- [ ] One elevation level per surface
- [ ] Radius varies with element size
- [ ] Status badges carry a text label
- [ ] Every utility class used exists in this project's Tailwind version

## 6. States

Per view that fetches data:

- [ ] **Loading** — skeletons matching the final shape, ~200ms delay,
      `aria-busy`, no layout shift when data lands
- [ ] **Empty (default)** — what this holds, why it is empty, the action
- [ ] **Empty (filtered)** — names the query and offers Clear filters
- [ ] **Error** — plain language, no raw exception or status code, working retry
- [ ] **Error (403)** — no retry button; retrying cannot succeed
- [ ] **Partial** — one failing region does not blank the page
- [ ] **Success** — destructive and financial actions confirm what happened,
      naming the thing
- [ ] No optimistic update on price, total, stock or payment

## 7. Accessibility

- [ ] `npx axe http://localhost:5173 --exit` — zero violations
- [ ] Focus is visible on every interactive element; no unpaired `outline: none`
- [ ] Focus order follows visual order; no `tabIndex > 0`
- [ ] Focus is managed on modal open/close, route change, failed submit, and
      row delete
- [ ] One full task completable with no mouse
- [ ] Escape closes every overlay; focus returns to the trigger
- [ ] One `<h1>` per page; no skipped heading levels
- [ ] Landmarks present; exactly one `<main>`
- [ ] Skip link is the first focusable element
- [ ] Decorative icons `aria-hidden`; meaningful images have purposeful `alt`
- [ ] Post-load errors have `role="alert"`; live regions have `aria-live`
- [ ] Touch targets ≥ 44×44px with ≥ 8px between adjacent targets
- [ ] Text zooms to 200% without clipping
- [ ] `user-scalable=no` is absent from the viewport meta
- [ ] Reduced motion stops all animation

## 8. Anti-slop

- [ ] No `blue-500` / `#3B82F6`
- [ ] Radius is not a single value across badges, cards and modals
- [ ] No Tailwind `shadow-sm|md|lg|xl|2xl`
- [ ] No emoji used as an icon
- [ ] No placeholder content — lorem ipsum, John Doe, `example.com`
- [ ] No generic microcopy — "Something went wrong", "No data"
- [ ] Card grids have a visual entry point
- [ ] Screenshot test: with the logo removed, it could not be any other product

## Sign-off

Frontend work is done when every box is ticked, or when an unticked box has a
written reason next to it. "Will do later" is not a reason; "no dark mode this
release, `prefers-color-scheme` block deleted" is.
