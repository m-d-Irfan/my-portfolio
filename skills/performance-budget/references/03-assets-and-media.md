# Assets and media

Images are usually the largest bytes on the page and the easiest to fix. A
budget of **300 KB per image** is generous; most should be well under it.

## P3, and why it happened

`src/assets/homebg.png` was **6.6 MB** — an unoptimised PNG used as a
full-width decorative background, on the homepage, on mobile data.

It happened because nothing checked. A designer exports a PNG, a developer
imports it, the dev server serves it from localhost in 12 ms, and nobody sees
the problem until a real user on 4G waits eleven seconds for the homepage.

The fix is a CI check, not more care:

```bash
find src/assets public -type f \
  \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \) \
  -size +300k
# PASS: no output
```

## Format

| Content | Format | Notes |
|---|---|---|
| Photography, product shots | AVIF, WebP fallback | AVIF is 30–50% smaller than WebP at equal quality |
| Screenshots, UI captures | WebP | PNG only if truly lossless is needed |
| Logos, icons, line art | SVG | Inline if it needs to inherit `currentColor` |
| Anything with transparency | WebP or AVIF | Both support alpha; PNG is 5–10× larger |
| Animation | MP4/WebM video | An animated GIF is 10× the size of the equivalent video |

PNG for a photograph is the single most common asset mistake. PNG is lossless
and stores every sensor artefact faithfully at enormous cost.

```bash
# One file
npx sharp-cli -i homebg.png -o homebg.webp --format webp --quality 80

# The directory
npx @squoosh/cli --webp '{"quality":80}' src/assets/*.png
```

Quality 80 WebP is visually indistinguishable from source for photography at
web sizes. Compare at 100% zoom before going lower.

## Responsive images

Serve the size the device will display, not the size that exists.

```jsx
<img
  src="/img/hero-800.webp"
  srcSet="/img/hero-400.webp 400w,
          /img/hero-800.webp 800w,
          /img/hero-1600.webp 1600w"
  sizes="(max-width: 768px) 100vw, 800px"
  width={800} height={450}
  alt="Teak double door, installed"
  loading="lazy" decoding="async"
/>
```

Every attribute here is doing work:

- **`srcSet` + `sizes`** — a phone downloads the 400w file, not the 1600w one.
  Without `sizes`, the browser guesses `100vw` and often picks the largest.
- **`width` + `height`** — reserves the space, which is what keeps CLS at 0.
  The intrinsic ratio is enough; CSS can still size it. This is the cheapest
  Core Web Vitals fix available and it is one attribute pair.
- **`loading="lazy"`** on everything below the fold. **Never on the LCP image**
  — lazy-loading the hero delays the exact metric being measured.
- **`decoding="async"`** so decode does not block the main thread.
- **`fetchpriority="high"`** on the LCP image, so it wins the connection race
  against scripts and fonts.

## The LCP element

Find it before optimising anything: Lighthouse names it under "Largest
Contentful Paint element". Usually the hero image or the first heading.

Once identified:

1. `<link rel="preload" as="image">` in `<head>`, with `imagesrcset` matching
   the `<img>`.
2. `fetchpriority="high"`, and no `loading="lazy"`.
3. Not inside a lazy-loaded route chunk.
4. Not dependent on a JS fetch — if the hero comes from an API call, the LCP
   cannot start until JS has parsed, executed and round-tripped.
5. No animation on entry. A hero that fades in over 600 ms has an LCP 600 ms
   later, by definition.

Point 5 catches people out: the reveal animation *is* the regression.
`transitions-dev` snippets are fine below the fold; keep them off the LCP
element.

## Fonts

`ui-design-system/02` owns which faces. The performance rules:

- **Self-host.** A Google Fonts CSS request is a second connection, a second
  DNS lookup and a render-blocking stylesheet before the font is even requested.
- **WOFF2 only.** Every browser in use supports it; shipping WOFF and TTF
  fallbacks doubles the bytes for no one.
- **`font-display: swap`** — otherwise text is invisible for up to 3 s.
- **Preload exactly one face**, the one used above the fold. Preloading six is
  the same as preloading none, because they compete.
- **Subset.** A full Latin+Cyrillic+Greek weight is 300 KB+; Latin alone is
  typically 30–60 KB. `pyftsubset` or `glyphhanger`.
- **`size-adjust`** on the fallback so the swap does not shift layout.

Four weights of one family, subsetted, is ~150 KB. Two families at six weights
each, unsubsetted, is 1.5 MB — and it competes with the LCP image for
bandwidth.

## Icons

An icon *set* imported as a namespace ships the whole set:

```jsx
import * as Icons from 'lucide-react';        // WRONG — 100 KB+
import { Trash2, Plus } from 'lucide-react';  // RIGHT — two icons, tree-shaken
```

Check the built output, not the import statement — a barrel file in the package
can defeat tree-shaking even with named imports.

For more than ~20 icons, an SVG sprite sheet with `<use href="#icon-trash">`
beats individual components: one cacheable request instead of inlining the same
paths into every chunk that uses them.

## Video

- Never autoplay with sound. Never autoplay at all on mobile data.
- `poster` attribute, always — otherwise the first frame is a blank box.
- `preload="none"` for anything below the fold. `preload="metadata"` at most.
- WebM + MP4 sources; H.264 for the MP4.
- A decorative background video costs more than the entire JS budget. A poster
  image with a play affordance is almost always the right answer.

## Cloudinary

This project uses Cloudinary for media. Use its transformation URLs rather than
uploading pre-sized variants:

```
/image/upload/f_auto,q_auto,w_800/v1/products/teak-door.jpg
```

`f_auto` serves AVIF or WebP based on the request's `Accept` header, `q_auto`
picks quality per image. This is the whole responsive pipeline as a URL.

Two rules: **never render a raw Cloudinary URL without transformations** — that
serves the 6 MB original — and put the transformation in one helper so a
quality change is one edit.

```js
export const cdn = (id, w) =>
  `${BASE}/image/upload/f_auto,q_auto,w_${w}/${id}`;
```

## Verification

```bash
# 1. Nothing oversized in the repo.
find src/assets public -type f -size +300k
# PASS: no output

# 2. Nothing oversized in the build output.
find dist -type f -size +300k
# PASS: no output

# 3. Every img has dimensions.
grep -rn "<img" src/ | grep -v "width=" | grep -v "aspect-"
# PASS: no output

# 4. No PNG photography.
find src/assets -name '*.png' -size +100k
# PASS: no output, or each hit is genuinely lossless line art

# 5. The LCP image is not lazy.
grep -rn 'loading="lazy"' src/pages/Home*
# REVIEW: no hit on the hero

# 6. No namespace icon import.
grep -rn "import \* as .* from 'lucide-react'" src/
# PASS: no output

# 7. Raw Cloudinary URLs.
grep -rn "res.cloudinary.com" src/ | grep -v "f_auto"
# PASS: no output
```

Then Lighthouse mobile on the preview build and read "Opportunities" — it names
the specific files and the estimated saving per file, which is the fastest
prioritisation available.
