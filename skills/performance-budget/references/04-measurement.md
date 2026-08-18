# Measurement

How to get a number you can act on, and which numbers to distrust.

## Measure first

The bottleneck is rarely where it feels like it is. P1 presented as "the API is
slow" and was the frontend downloading the whole catalogue and filtering it in
JavaScript. Optimising the API would have produced a faster download of data
that should never have been sent.

Order of investigation, and it is worth following even when the answer seems
obvious:

1. **Network tab.** One large response, or many small ones? That single fork
   splits backend problems from frontend ones.
2. **Query count.** Debug toolbar or `assertNumQueries`. Over 10 → N+1.
3. **Lighthouse mobile.** Which metric fails, and which element is the LCP.
4. **Performance profile.** Only if the first three are clean and it is still
   slow — then it is main-thread work.

## What not to trust

**The dev server.** Unminified, unsplit, uncompressed, with React in
development mode and hot-reload instrumentation attached. Lighthouse against
`npm run dev` is meaningless. Always measure `npm run preview` or a real
deployment.

**Your own machine and connection.** Fast CPU, fast disk, wired connection,
warm cache, browser extensions. Throttle explicitly: **Slow 4G** and **4× CPU**
in devtools, which approximates a mid-range Android phone.

**A single run.** Lighthouse varies ±10% between runs. Take three and use the
median, or use `--runs=3`.

**A warm cache.** The first visit is the one that matters most and is the one
you never see during development. Test in an incognito window, or check
"Disable cache".

**Lab data alone.** Lighthouse is a synthetic run on synthetic conditions. It
finds problems well; it does not tell you what your users experience. For that
you need field data — the `web-vitals` library reporting to an endpoint, or
Chrome UX Report if the site has enough traffic.

## Backend

```bash
# Timing, per request.
curl -s -o /dev/null -w 'dns:%{time_namelookup} connect:%{time_connect} ttfb:%{time_starttransfer} total:%{time_total}\n' \
  "http://localhost:8000/api/products/"
```

A high `ttfb` with a low `total` is server-side work. The reverse is payload
size or bandwidth.

```python
# Query count in a test — the load-bearing measurement.
from django.test.utils import CaptureQueriesContext
from django.db import connection

with CaptureQueriesContext(connection) as ctx:
    client.get('/api/products/')
print(len(ctx.captured_queries))
for q in ctx.captured_queries:
    print(q['time'], q['sql'][:120])
```

`django-debug-toolbar` in dev gives the same thing in a panel, with duplicate
queries flagged. It is the fastest N+1 detector available; install it.

For a slow single query, `EXPLAIN`:

```python
print(Product.objects.filter(category_id=3).explain())
```

`data-layer/03` owns reading the output. The short version: a full table scan
where you expected an index means the index is missing, or the query is written
in a way that cannot use it (a function applied to the column, a leading
wildcard `LIKE`, a type mismatch).

Under load, `locust` or `ab` — but only after the single-request numbers are
clean. Load-testing an N+1 measures how fast you can be wrong.

## Frontend

```bash
npm run build && npm run preview

npx lighthouse http://localhost:4173 \
  --preset=desktop --view --runs=3

npx lighthouse http://localhost:4173 \
  --form-factor=mobile --throttling-method=simulate --view
```

Mobile is the number that counts for this project.

```bash
# What is in the bundle, by size.
npx vite-bundle-visualizer

# Raw and gzipped size per chunk.
ls -lh dist/assets/*.js
gzip -c dist/assets/index-*.js | wc -c
```

**React DevTools Profiler** for re-render cost: record an interaction, look for
components that rendered with no reason to. The flame chart's width is time; a
wide bar on a component that should not have rendered is the finding.

**The Performance panel** for main-thread work: long tasks over 50 ms are what
INP measures. Look for a single long yellow block during an interaction.

## Field data

Lab numbers find problems; field numbers tell you whether users have them.

```js
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

const report = ({ name, value, id }) => {
  navigator.sendBeacon('/api/vitals/', JSON.stringify({ name, value, id }));
};
onCLS(report); onINP(report); onLCP(report); onTTFB(report);
```

`sendBeacon`, not `fetch` — it survives page unload, which is when CLS and INP
are finalised.

Report the **75th percentile**, not the mean. A mean LCP of 2.1 s can hide a
quarter of users at 6 s, and those are the ones who leave. `jobs-and-integrations`
owns the endpoint and the structured logging it writes into.

## CI

Budgets that are not enforced are aspirations. Copy
[`assets/check_budget.sh`](../assets/check_budget.sh) into `scripts/` and run it
on every PR, alongside the query-count tests:

```yaml
- run: npm ci && npm run build
- run: bash scripts/check_budget.sh
- run: pytest tests/test_query_budget.py
```

The script exits non-zero on a breach, which is the entire point — a warning
in a log nobody reads has never prevented a regression. `deploy-and-env` owns
the pipeline itself.

## Recording the result

When a budget is exceeded deliberately, write it down in the PR: the number, the
reason, and what would have to change to come back under. An unexplained
exception becomes the new normal within two releases, and then the budget is
gone.

```
Initial JS 214 KB (budget 200 KB).
Reason: the PDF preview needs pdf.js on the invoice route, which is not
lazy-loadable because it is the route's primary content.
Path back: split the viewer from the download button, lazy-load the viewer.
Tracked in #142.
```
