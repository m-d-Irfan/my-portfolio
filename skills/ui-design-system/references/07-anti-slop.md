# Anti-slop

The specific tells that make an interface read as generated rather than
designed, and the fix for each. These are mechanical — every one is either
grep-able or visible in a screenshot.

The underlying cause is always the same: a default was accepted where a
decision belonged.

## The nine tells

| Tell | Why it reads as generated | Fix |
|---|---|---|
| Everything is `#3B82F6` | Tailwind's `blue-500` is the default nobody chose. It is on half the demos ever built. | One brand hue, derived from the product. [01](01-tokens.md) |
| Uniform `rounded-lg` | A 20px badge and a 600px modal at the same radius means radius carries no information. | Radius scale tied to element size. `--radius-sm` → `--radius-xl`. |
| `shadow-md` on everything | If every element is elevated, none is. Elevation stops meaning "above". | Four elevations by intent: resting / raised / floating / overlay. |
| Ad-hoc type sizes | 15px, 17px, 22px — nothing looks intentionally larger, just differently sized. | One 1.25 ratio scale, eight steps, nothing off it. [02](02-typography.md) |
| Even spacing everywhere | `space-y-4` down the page. Grouping is invisible; the reader parses content to find structure. | Spacing communicates grouping — tighten related, loosen unrelated. [03](03-layout.md) |
| No empty / loading / error state | The states a real user hits first are the ones that were never built. | All five states per view. [05](05-states.md) |
| Everything centred | Centring is the default when no alignment was chosen. Centred body copy over three lines is hard to read. | One alignment axis per region. Centre only short symmetric content. |
| Emoji as icons | 🚀 📦 ✅ render differently per platform, do not inherit colour, cannot be sized on a grid, and are announced by screen readers as their full CLDR name. | A real icon set — lucide, heroicons — at consistent weight and size. |
| Gradient + glass + blur as decoration | Applied because they are available, not because the design needed depth. Three effects on one card is a demo, not a product. | Each effect earns its place or is removed. At most one per surface. |

## Four more, less discussed and equally reliable

**Placeholder content that shipped.** "Lorem ipsum", "John Doe",
`example.com`, a stock avatar, "Product Name Here". Grep before every release —
this one is embarrassing rather than merely generic.

```bash
grep -rniE "lorem ipsum|john doe|jane doe|example\.com|placeholder text|your (name|text) here" src/
# PASS: no output
```

**Perfectly even card grids with no hierarchy.** Twelve identical cards in a
3×4 grid, every one the same size, weight and treatment. Real interfaces have a
featured item, a different first row, or a size that varies with importance.
When everything has equal visual weight, the user has no entry point.

**Icon + label where the icon adds nothing.** A "Save" button with a floppy
disk. A "Delete" with a trash can *and* the word Delete *and* a red background.
Redundant encoding is fine for status; on a button it is clutter. Ask what the
icon tells the user that the word does not.

**Copy written by nobody in particular.** "Something went wrong." "Manage your
products." "Welcome back!" Generic microcopy is the fastest tell of all because
it appears everywhere at once. Write the sentence a person at this company
would say: "Couldn't reach the server. Your draft is saved." / "Products,
stock and pricing." The exclamation mark is almost always wrong.

## The diagnostic

When something "looks generic" and the reason is not obvious, ask in order:

1. **Would this look identical for a different product?** If yes, nothing in it
   is specific to this one. Start with colour and copy.
2. **What is the most important thing on this screen?** If nothing is visually
   dominant, hierarchy is missing — that is size, weight and space, not colour.
3. **What did I accept as a default?** The blue, the radius, the shadow, the
   spacing, the font stack. Each accepted default is one decision not made.
4. **What happens at the edges?** Zero items, one item, a thousand. A 60-
   character product name. An offline network. Handling the edges is most of
   what separates a product from a demo.
5. **Does the motion mean anything?** Decoration that fires on every mount is
   noise. Motion should show causality — what changed, and because of what.

## What this file cannot do

It catches the mechanical tells. It does not produce good design.

Beyond the checklist — composition, whether the hierarchy is right, whether the
type pairing works, whether the whole thing is *good* — is judgement, and that
is `impeccable`. Use it for "does this look good", "make this feel premium",
"redesign this page", and live browser iteration.

The division: this file gets an interface to *not obviously generated*.
`impeccable` gets it to *good*. They are different problems and the second one
does not have a checklist.

## Verification

```bash
# Default blue.
grep -rnE "#3[Bb]82[Ff]6|blue-(400|500|600)" src/
# PASS: no output

# Uniform radius — one value used everywhere is the smell.
grep -rhoE "rounded-[a-z]+" src/ | sort | uniq -c | sort -rn
# REVIEW: a single dominant value across badges, cards and modals

# Tailwind's default shadow scale.
grep -rnE "shadow-(sm|md|lg|xl|2xl)\b" src/
# PASS: no output — named intents only

# Emoji in JSX.
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/ --include=*.jsx
# PASS: no output outside deliberate content

# Placeholder content.
grep -rniE "lorem ipsum|john doe|example\.com|your name here" src/
# PASS: no output

# Generic microcopy.
grep -rn "Something went wrong\|An error occurred\|No data" src/
# PASS: no output
```

The screenshot test, which is faster than all of the above: take one, remove
the logo, and ask whether it could be any other product. If yes, the tells are
in the list.
