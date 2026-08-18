# Accessibility

The subset that is mechanical, verifiable, and covers most real failures. Not a
WCAG conformance guide — full validation needs assistive-technology testing and
expert review, which no checklist replaces.

## Contrast

4.5:1 body text. 3:1 for large text (≥24px, or ≥19px bold), icons that carry
meaning, focus rings, and the boundary of an input.

The contrast function is in [01-tokens.md](01-tokens.md). Pairs people forget:

- **Text on the accent colour** — `--color-on-accent` exists for this.
- **Placeholder text.** Usually the worst contrast on the page. It must clear
  4.5:1 too, which is why placeholders make bad labels.
- **Disabled controls.** WCAG exempts them; users do not. 3:1 minimum, or
  nobody can tell what the disabled button would have done.
- **Status colours in dark mode.** `tokens.css` lightens them for this reason.
- **Text over an image.** Needs a scrim, not hope. A semi-opaque overlay or a
  gradient behind the text block.

## Focus

Never remove the outline. `outline: none` without a replacement is a WCAG 2.4.7
failure and makes the app unusable by keyboard.

`tokens.css` ships a `:focus-visible` ring on every interactive element.
`:focus-visible` rather than `:focus` so a mouse click does not ring — that
distinction is why people remove outlines in the first place.

```bash
grep -rn "outline-none\|outline: none" src/
# PASS: every hit has focus-visible styling on the same element
```

Focus order follows visual order. `tabIndex` above 0 breaks that and is almost
never right; `tabIndex={-1}` for a programmatic target is fine.

**Focus must be managed on:**

| Event | Where focus goes |
|---|---|
| Modal opens | First focusable element inside, or the heading |
| Modal closes | The trigger that opened it |
| Route change | The `<h1>`, with `tabIndex={-1}` |
| Form submit fails | The first invalid field |
| Row deleted | The next row, or the table heading if it was the last |

The last one gets missed: deleting the focused row leaves focus on a detached
node, and the next Tab starts from the top of the document.

## Keyboard

Everything reachable by mouse is reachable by keyboard. Test by unplugging the
mouse and completing one full task — place an order, or add a product.

- **`<button>` for actions, `<a>` for navigation.** A `<div onClick>` is not
  focusable, not activated by Enter or Space, and not announced as a control.
  If a div must be interactive it needs `role`, `tabIndex={0}` and both key
  handlers — at which point use a button.
- **Escape closes** any overlay. Enter submits a form.
- **Arrow keys within a composite widget** — tabs, menus, listboxes — with Tab
  moving past the whole widget, not through each item.
- **No keyboard trap.** Focus can always leave, except inside an open modal,
  where trapping is correct.
- **Skip link** to `#main` as the first focusable element on the page.

## Screen readers

- **`<label htmlFor>`** for every input. `aria-label` is the fallback, not the
  default — a visible label helps everyone.
- **`aria-invalid` + `aria-describedby`** pointing at the error text, so the
  message is announced with the field rather than orphaned in the DOM.
- **`role="alert"`** on errors that appear after load. Without it, a screen
  reader user submits a form and hears nothing.
- **`aria-live="polite"`** on regions that update in place — a cart total, a
  filtered result count.
- **`aria-hidden`** on decorative icons. An icon inside a labelled button read
  aloud is noise.
- **`aria-busy`** on a loading container, so placeholders are not read as data.
- **`alt` describes purpose, not appearance.** A product photo's alt is the
  product name. A decorative background is `alt=""` — empty, not missing.
- **One `<h1>` per page**, headings in order, no level skipped. Screen reader
  users navigate by heading; a page of styled `<div>`s has no structure to
  navigate.
- **Landmarks**: `<header>`, `<nav>`, `<main>`, `<footer>`. One `<main>`.

`aria-label` on a `<div>` does nothing unless the div has a role. This is the
most common piece of ARIA that appears to work and does not.

## Motion

`prefers-reduced-motion: reduce` is honoured globally in `tokens.css`.
Vestibular disorders make sustained motion genuinely painful — this is a
requirement, not a preference.

Under reduced motion: no parallax, no autoplaying carousel, no continuous loop.
Cross-fades are fine. `transitions-dev` ships a guard in every snippet; keep it.

Nothing flashes more than three times per second.

## Targets and zoom

- **44×44px minimum** touch target, including padding. Adjacent targets need
  8px between them.
- **Text zooms to 200%** without loss of content or function. Fixed-height
  containers with text inside are where this breaks.
- **`user-scalable=no` is never acceptable.** Check the viewport meta.
- **Reflow at 320px** with no horizontal scroll on the page body. A wide table
  scrolling inside its own container is fine; the page scrolling is not.

## Forms

Beyond the field semantics in [04-components.md](04-components.md):

- Errors are announced, listed, and each links to its field.
- Errors say what to do: "Phone must be 11 digits starting 01".
- Required fields are marked in text, not by colour or a bare asterisk.
- **Never validate on keystroke** — a field that errors while the user is still
  typing their email is announced repeatedly and reads as hostile. Validate on
  blur, and on submit.
- `autoComplete` on every field with a standard token. It is the difference
  between a 30-second and a 3-minute checkout for a keyboard or switch user.

## Verification

Automated first — it catches maybe a third of real issues:

```bash
npm i -D @axe-core/cli
npx axe http://localhost:5173 --exit
# PASS: zero violations

npx lighthouse http://localhost:5173 --only-categories=accessibility
# PASS: 100. Below that, read the specific failures — the score is not the goal.
```

Then manually, per view — this is where the other two thirds are:

1. Tab through the whole page. Focus is always visible and follows visual
   order.
2. Complete one full task with no mouse.
3. Zoom to 200%. Nothing is clipped or overlapped.
4. Narrow to 320px. No horizontal page scroll.
5. Enable reduced motion at the OS level. Nothing animates.
6. Read one screen with a screen reader — VoiceOver (Cmd+F5) or NVDA. Every
   control announces its name, role and state.

Step 6 is the one that finds what the others cannot, and the one most worth
doing on the checkout flow specifically.

For broader UX and design critique, use `impeccable`.
