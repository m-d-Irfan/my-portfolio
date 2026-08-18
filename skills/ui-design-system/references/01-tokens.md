# Tokens

Colour, and the naming layer that makes everything else possible.

## Two layers, always

```
BRAND        --color-accent: #7e5638
   ↓
SEMANTIC     --color-danger, --color-surface, --color-text-muted
   ↓
COMPONENT    background: var(--color-danger-bg)
```

A component never reaches past the semantic layer. This is what makes a
rebrand a one-file change and dark mode a surface swap rather than an audit of
every component.

**WRONG**

```jsx
<div className="bg-[#7e5638] text-white">        {/* welds the brand in */}
<div className="bg-teak-700 text-cream">        {/* brand name in a component */}
```

**RIGHT**

```jsx
<div className="bg-accent text-accent-on">
```

The second WRONG line is the subtle one. `bg-teak-700` looks like a token, but
when the brand changes from teak to something else, every one of those class
names is a lie you have to rename. Semantic names survive.

## Choosing the palette

Derive it from what the project already has. Read `tailwind.config.js` and
`index.css` first. Introducing a second palette next to an existing one is the
most common way a codebase ends up with four near-identical browns.

If there is genuinely nothing to derive from:

1. **One brand hue.** Pick from the logo, the product photography, or the
   physical product. Not from a palette generator.
2. **A soft version of it** — same hue, lower chroma, higher lightness. Used
   for watermarks, muted hairlines, disabled accents.
3. **The text colour that sits on the brand.** Compute it; do not assume white.
4. **A neutral ramp** for surfaces and text. Give the neutrals a *slight* cast
   of the brand hue — pure `#808080` grey next to a warm brand reads as dirty.
5. **Four status colours.** These are conventional (green/amber/red/blue) and
   should stay conventional. A brand-tinted "success" that is not green costs
   the user a beat of comprehension on every read.

Total: nine values. That is the whole palette.

## Contrast is a constraint, not a review note

Every foreground/background pair ships at **4.5:1** for body text, **3:1** for
large text (≥24px, or ≥19px bold) and for icons and focus rings that carry
meaning.

Check before shipping, not after:

```js
// Paste into the browser console on the actual page.
function relLuminance(hex) {
  const c = hex.replace('#', '').match(/../g).map(h => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [relLuminance(a), relLuminance(b)].sort((m, n) => n - m);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
}
contrast('#6f6559', '#faf7f2');   // 4.62 — muted text on background: passes
contrast('#8e8377', '#faf7f2');   // 3.14 — subtle: LARGE TEXT AND ICONS ONLY
```

`--color-text-subtle` in `tokens.css` is deliberately labelled as failing body
contrast. It exists because a three-level text hierarchy is genuinely useful
for timestamps and metadata at 12px+ — but 12px metadata at 3.1:1 is a
violation. Use it at `--text-sm` and above, or for icons, and never for
anything the user must read to complete a task.

The pair people forget: **text on the accent colour**. `--color-on-accent` is
declared explicitly for exactly this reason. Hardcoding white works until
someone rethemes to a pastel and every button legend disappears.

## Dark mode

Invert surfaces, text and lines. Keep the brand accent. Lighten the status
colours — `#15803d` green is 5.3:1 on cream and 2.4:1 on near-black, which
looks legible in a screenshot and is not.

The failure mode to watch for is not colour, it is **assumed background**. A
component with `bg-white` hardcoded, a PNG icon with a baked white matte, an
`<img>` with no background, a shadow tuned for light — all invisible until the
first dark-mode screenshot.

```bash
grep -rn "bg-white\|bg-black\|text-white\|text-black" src/
# PASS: no output. Use bg-surface / text-text / text-accent-on.
```

Decide at the start. Retrofitting dark mode means auditing every component
written before the decision. If the answer is no, delete the
`prefers-color-scheme` block from `tokens.css` — a half-implemented dark mode
where two screens work is worse than none, because the user now expects it.

## Where tokens must NOT go

Motion values (`--duration-*`, `--ease-*`) belong to `transitions-dev/_root.css`.
Chart palettes belong to `dataviz`. Console density and depth belong to
`admin-panel-builder/assets/admin-tokens.css`.

If a value is defined in two files, whichever loads last wins, silently, and
edits to the other stop taking effect. That has already happened once in this
suite with the two `_root.css` files.

## Verification

```bash
# No literal colour outside the token file.
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/ --include=*.jsx --include=*.tsx \
  | grep -v tokens.css
# PASS: no output

# No brand-named class in a component.
grep -rniE "teak|muqam|brown-[0-9]" src/components/ src/pages/
# PASS: no output

# No colour defined twice across token files.
grep -rhoE "^\s+--color-[a-z-]+:" src/styles/*.css | sort | uniq -d
# PASS: no output
```

Retheme test: set `--color-accent: #0f766e`, reload, confirm everything
brand-coloured is teal. Anything that is not is a literal.
