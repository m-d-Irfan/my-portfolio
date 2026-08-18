# Performance acceptance

Run before a release. Every line has a number and a command; a line that cannot
be checked mechanically does not belong here.

## 1. The budgets

- [ ] Initial JS ≤ 200 KB gzipped
- [ ] Every lazy chunk ≤ 150 KB gzipped
- [ ] Total CSS ≤ 50 KB gzipped
- [ ] No image over 300 KB, in `src/assets`, `public`, or `dist`
- [ ] LCP ≤ 2.5 s, Lighthouse mobile, preview build
- [ ] CLS ≤ 0.1
- [ ] INP ≤ 200 ms
- [ ] TTFB ≤ 600 ms
- [ ] Every list response ≤ 100 KB
- [ ] No request over 10 database queries
- [ ] Order placement round trip ≤ 1 s

```bash
npm run build && bash scripts/check_budget.sh    # covers the first four
pytest tests/test_query_budget.py                # covers queries and payload
npx lighthouse http://localhost:4173 --form-factor=mobile --runs=3
```

## 2. Backend

- [ ] Every list endpoint is paginated
- [ ] `page_size_query_param`, if exposed, has `max_page_size`
- [ ] Filtering, searching and ordering happen in the database, never in the
      client
- [ ] Every nested serializer has a matching `select_related` /
      `prefetch_related`
- [ ] Every list endpoint has a list-specific serializer
- [ ] No `fields = '__all__'` anywhere
- [ ] Query counts are pinned exactly, and constant as row count grows
- [ ] Aggregation is done in SQL, not by iterating in Python
- [ ] No third-party network call inside a request path — email, SMS, courier
      and PDF go to the outbox
- [ ] Nothing is cached with a key that omits the user, if the content is
      user-specific
- [ ] Cache backend is not `LocMemCache` in production

## 3. Frontend

- [ ] Admin and inventory routes are `React.lazy` with `<Suspense>` inside
      `<ProtectedRoute>`
- [ ] Storefront routes stay static
- [ ] No client-side filtering or pagination of a full fetch
- [ ] Search input is debounced and in-flight requests are cancelled
- [ ] Lists over ~100 rows are virtualised
- [ ] One library per job — one toast, one charting, one date library
- [ ] No dependency over ~30 KB gzipped without a written reason
- [ ] No namespace icon import
- [ ] Context provider values are memoised
- [ ] State updates are immutable — no mutation inside a shallow copy
- [ ] `chunkSizeWarningLimit` matches the budget
- [ ] Static assets are served gzip- or brotli-compressed in production

## 4. Assets

- [ ] Photography is WebP or AVIF, not PNG
- [ ] Every `<img>` has `width` and `height`, or a reserved aspect ratio
- [ ] Below-the-fold images are `loading="lazy"`
- [ ] The LCP image is **not** lazy, has `fetchpriority="high"`, and is
      preloaded
- [ ] The LCP element has no entry animation
- [ ] `srcSet` + `sizes` on any image displayed at more than one size
- [ ] Fonts are self-hosted WOFF2, subsetted, with `font-display: swap`
- [ ] Exactly one font face is preloaded
- [ ] No Cloudinary URL without `f_auto,q_auto` transformations
- [ ] No autoplaying video; `poster` present; `preload="none"` below the fold

## 5. Measurement hygiene

- [ ] Measured against the preview build, not the dev server
- [ ] Throttled to Slow 4G and 4× CPU
- [ ] Cold cache (incognito or cache disabled)
- [ ] Median of three runs, not one
- [ ] Field vitals reported at p75, not mean
- [ ] `check_budget.sh` and `test_query_budget.py` run in CI on every PR

## 6. Exceptions

- [ ] Every exceeded budget has a PR note with: the number, the reason, and the
      path back under budget
- [ ] No exception is older than two releases without a ticket

An exception with no path back becomes the new normal, and then the budget is
gone. That is the failure mode this section exists to prevent.
