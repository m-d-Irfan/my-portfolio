---
name: performance-budget
description: Numeric performance budgets for a Django + React app and the techniques to stay inside them — response payload size, query counts and N+1, JS bundle size and route code-splitting, image formats and dimensions, Core Web Vitals. Use when a page is slow, a list endpoint is heavy, the bundle has grown, an image is oversized, or before a release. Trigger on "slow page", "slow query", "N+1", "too many queries", "bundle size", "code splitting", "lazy load", "optimise images", "LCP", "CLS", "Lighthouse", "perf audit", "why is this slow", "large payload", "pagination".
---

# Performance budget

Numbers, not adjectives. "Feels fast" is not a target; 200 KB of JavaScript is.

Every budget here traces to a measured defect in this project (P1–P4). A budget
with no number attached is a preference, and preferences lose to deadlines.

## When to use

- A page, list or endpoint is slow
- Before a release, as a gate
- Adding a library, an image, or a nested serializer
- Reviewing a PR that adds a route or a list view

Do **not** use it for database schema design (`data-layer`), response *shape*
(`api-contract`), or image *art direction* (`ui-design-system`). This skill owns
the numbers and the measurement.

## The budgets

Exceeding one is a blocker, not a note. Where a number is exceeded on purpose,
record it in the PR with the reason.

| Budget | Limit | Measured by |
|---|---|---|
| Initial JS, gzipped | **200 KB** | `dist/` after build |
| Any single lazy chunk, gzipped | **150 KB** | build output |
| Total CSS, gzipped | **50 KB** | build output |
| Any single image | **300 KB** | `find src/assets -size +300k` |
| Largest Contentful Paint | **2.5 s** on 4G | Lighthouse mobile |
| Cumulative Layout Shift | **0.1** | Lighthouse |
| Interaction to Next Paint | **200 ms** | Lighthouse / field data |
| Time to First Byte | **600 ms** | Lighthouse |
| API list response | **100 KB** | `curl -s … \| wc -c` |
| DB queries per request | **10** | `assertNumQueries`, debug toolbar |
| Order placement round trip | **1 s** | manual timing |

Mobile 4G is the reference device, not a desktop on office wifi. This project's
users are on phones on mobile data.

## Route by task

| Task | Read |
|---|---|
| Slow endpoint, N+1, heavy payload, pagination, caching | [01-backend-budget.md](references/01-backend-budget.md) |
| Bundle size, code splitting, lazy routes, dependency weight | [02-frontend-budget.md](references/02-frontend-budget.md) |
| Images, fonts, video, and the LCP element | [03-assets-and-media.md](references/03-assets-and-media.md) |
| How to measure any of it, and what to trust | [04-measurement.md](references/04-measurement.md) |

Copy [`assets/check_budget.sh`](assets/check_budget.sh) to `scripts/` and run it
in CI. Copy [`assets/test_query_budget.py`](assets/test_query_budget.py) to
`tests/` — it pins query counts so an N+1 cannot return silently.

## The four rules

1. **Measure before optimising.** The bottleneck is rarely where it feels like
   it is. P1 felt like a slow API; it was the frontend fetching the entire
   catalogue on mount and filtering in JavaScript.
2. **Every list endpoint is paginated and server-filtered.** No exceptions.
   "There are only 200 products" is a statement about today. *(P1)*
3. **Every nested serializer has a matching `prefetch_related`, pinned by a
   query-count test.** A nested serializer without one is an N+1 already. *(P4)*
4. **Admin and inventory routes are always `React.lazy`.** A customer browsing
   the storefront should never download the 76 KB product admin page. *(P2)*

## Decisions

**Optimise or paginate?** Paginate. A query tuned to return 5,000 rows quickly
is still 5,000 rows over mobile data into a phone's memory.

**Cache or fix the query?** Fix the query. A cache in front of an N+1 hides it
until the first cache miss under load, which is exactly when it matters most.
Cache after the query is correct, and only for genuinely hot, genuinely stable
data.

**Code-split at which boundary?** The route, first and always — it maps to what
the user is actually doing. Component-level splitting is for a genuinely heavy
widget (a rich text editor, a chart library) used on one screen.

**Is this dependency worth it?** Check the gzipped cost at bundlephobia, then
ask what it replaces. `moment` at 72 KB for date formatting that
`Intl.DateTimeFormat` does natively is the archetype. Anything over ~30 KB
gzipped needs a written reason.

**`useMemo` here?** Almost certainly not. Memoising a `.map` over 20 items
costs more than it saves and adds a dependency array to get wrong. Memoise when
a profile shows a real cost — the 5,000-item filter, not the list render.

## Workflow

**A page is slow**

1. Network tab: is one response large, or are there many? → backend or frontend.
2. Django debug toolbar or `assertNumQueries`: query count. Over 10 → N+1.
3. Lighthouse mobile: which metric fails, and which element is the LCP.
4. Fix the largest single contributor. Re-measure. Stop when inside budget.

**Before a release**

```bash
npm run build && bash scripts/check_budget.sh
pytest tests/test_query_budget.py
npx lighthouse http://localhost:4173 --preset=desktop --view
```

**Adding a list endpoint**

Pagination, `select_related`/`prefetch_related`, a list-specific serializer, and
a pinned query-count test — in the same commit as the endpoint.

## What this skill does not own

| Concern | Owner |
|---|---|
| Indexes, constraints, `select_related` semantics | `data-layer` |
| Which fields a serializer exposes | `api-contract` |
| Image art direction, layout, tokens | `ui-design-system` |
| Motion performance (`transform` vs `width`) | `transitions-polish` |
| Whether a fast endpoint is also a safe one | `security-hardening` |
| Running the query-count tests in CI | `testing-harness`, `deploy-and-env` |

An endpoint that got fast by dropping a permission check is not a win. Check
with `security-hardening` before removing anything from a hot path.

## Verification

```bash
# 1. Bundle budgets.
npm run build && bash scripts/check_budget.sh
# PASS: exit 0

# 2. Query budgets pinned.
pytest tests/test_query_budget.py -v
# PASS: green

# 3. No oversized asset (P3); admin routes split (P2); payload capped (P1).
find src/assets public -type f -size +300k              # PASS: no output
grep -n "Admin\|Inventory" src/routes.jsx | grep -v lazy # PASS: no output
curl -s "http://localhost:8000/api/products/?page=1" | wc -c   # PASS: < 102400
```

Full list: [checklists/performance-acceptance.md](checklists/performance-acceptance.md).

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| **P1** | `ProductContext` fetched the full catalogue on mount; every page filtered it client-side | [01](references/01-backend-budget.md), [02](references/02-frontend-budget.md) |
| **P2** | All 24 routes statically imported — 76 KB `Admin/Products.jsx` shipped to anonymous visitors | [02](references/02-frontend-budget.md) |
| **P3** | `homebg.png` at 6.6 MB, unoptimised | [03](references/03-assets-and-media.md) |
| **P4** | `fields = '__all__'` with four nested serializers, no prefetch — N+1 across the catalogue | [01](references/01-backend-budget.md) |
| **C3** | Invoice email sent synchronously inside the order response | [01](references/01-backend-budget.md), owned by `jobs-and-integrations` |
