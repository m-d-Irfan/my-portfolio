# Frontend budget

JavaScript is the most expensive resource on the page. A 200 KB image decodes
on a background thread; 200 KB of JavaScript must be downloaded, parsed,
compiled and executed on the main thread before anything is interactive.

| Budget | Limit (gzipped) |
|---|---|
| Initial JS | 200 KB |
| Any lazy chunk | 150 KB |
| Total CSS | 50 KB |

## Route-level code splitting

**P2, as shipped:** `routes.jsx` statically imported all 24 page components.
`Admin/Products.jsx` (76 KB) and `Admin/Orders.jsx` (56 KB) were downloaded,
parsed and executed by every anonymous visitor who landed on the homepage —
people who could never open those pages, because the route is staff-gated.

```jsx
// WRONG
import AdminProducts from './pages/Admin/Products';

// RIGHT
const AdminProducts = lazy(() => import('./pages/Admin/Products'));
```

```jsx
<Route element={<ProtectedRoute requireStaff />}>
  <Route path="/admin" element={
    <Suspense fallback={<RouteSkeleton />}>
      <AdminLayout />
    </Suspense>
  }>
    <Route path="products" element={<AdminProducts />} />
  </Route>
</Route>
```

Rules:

- **`<Suspense>` goes inside `<ProtectedRoute>`, not outside.** Outside, the
  fallback renders before the auth check resolves, so an unauthorised user sees
  the admin skeleton flash before the redirect. `auth-flows/02` owns the gate.
- **Storefront routes stay static.** Splitting the homepage costs a round trip
  on the most important navigation in the app.
- **The fallback is a skeleton of the route, not a spinner** —
  `ui-design-system/05`.
- **Prefetch on intent.** `onMouseEnter` on the admin nav link triggers the
  import, so the chunk is warm by the time the click lands.

Split at the route first. Component-level splitting is for one genuinely heavy
widget on one screen — a rich text editor, a chart library, a map.

## Dependency weight

Check the gzipped cost before adding anything. `npx bundlephobia <pkg>`, or
`npx vite-bundle-visualizer` after a build to see what is already there.

Common wins in this stack:

| Instead of | Use | Saves |
|---|---|---|
| `moment` (72 KB) | `Intl.DateTimeFormat`, or `date-fns` with named imports | ~70 KB |
| `lodash` (72 KB) | `lodash-es` named imports, or native | ~65 KB |
| Full `chart.js` + `recharts` | One charting library, not two | 50–150 KB |
| Both `sonner` and `react-hot-toast` | One. This suite standardises on `react-hot-toast` | ~15 KB |
| An icon *package* imported as a namespace | Named imports, tree-shaken | 100 KB+ |

The icon one is the quietest and the largest:

```jsx
import * as Icons from 'lucide-react';   // WRONG — the whole set ships
import { Trash2, Plus } from 'lucide-react';   // RIGHT — two icons
```

Anything above ~30 KB gzipped needs a written reason in the PR. Two libraries
doing the same job is always a bug.

## Frontend data handling

**P1** was a frontend defect with a backend symptom: `ProductContext` fetched
the entire catalogue on mount, and every page filtered that array in JavaScript.

Three costs at once — a multi-megabyte response on mobile data, the whole
catalogue held in memory on a phone, and a main-thread filter pass on every
keystroke.

```jsx
// WRONG
const filtered = allProducts.filter(p => p.category === catId);

// RIGHT
const { data } = useQuery(['products', catId, page],
  () => api.get('/products/', { params: { category: catId, page } }));
```

The server filters, sorts and paginates. Always. See
[01-backend-budget.md](01-backend-budget.md).

Other frontend rules:

- **Debounce search input** at ~300 ms, and cancel the in-flight request when a
  new one starts (`AbortController`). Without cancellation, responses can land
  out of order and the user sees results for a query they have finished editing.
- **Virtualise lists above ~100 rows** — `@tanstack/react-virtual`. Below that
  it is complexity for nothing.
- **`React.lazy` a modal's contents**, not the trigger.
- **Do not memoise by default.** `useMemo` over 20 items costs more than it
  saves and adds a dependency array to get wrong. Memoise what a profile shows
  is expensive.

## Re-render cost

The React DevTools Profiler, not intuition. Record an interaction, look for
components rendering that had no reason to.

The two causes that account for most of it:

**A new object or function identity every render**, passed to a memoised child:

```jsx
<ProductCard onSelect={() => select(p.id)} style={{ margin: 8 }} />
// Both props are new every render. React.memo on ProductCard does nothing.
```

**A context whose value is a fresh object**, so every consumer re-renders on
every provider render:

```jsx
// WRONG
<CartContext.Provider value={{ items, addItem, removeItem }}>

// RIGHT
const value = useMemo(() => ({ items, addItem, removeItem }), [items, addItem, removeItem]);
```

This is the one place `useMemo` is close to mandatory — a context provider high
in the tree re-rendering the whole app is the most expensive shape in React.

Split contexts by update frequency. A cart that changes on every quantity tap
should not sit in the same provider as a theme that changes once a session.

Mutating state in place breaks `React.memo` entirely, because the reference is
unchanged and the comparison passes:

```jsx
// WRONG — mutates the object inside a shallow-copied array
const updated = [...items];
updated[i].quantity += quantity;

// RIGHT
const updated = items.map((it, idx) =>
  idx === i ? { ...it, quantity: it.quantity + quantity } : it);
```

That exact bug shipped in this project's cart context. Under StrictMode's
double-invoke it also applied the quantity twice.

## Build configuration

```js
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Only split a vendor chunk that is genuinely shared and stable.
          // Over-splitting turns one download into six round trips.
        },
      },
    },
    chunkSizeWarningLimit: 200,   // matches the budget, so the build warns
    sourcemap: true,              // hidden from the client, uploaded to error tracking
  },
});
```

Vendor-chunk splitting helps caching: app code changes weekly, React does not.
It stops helping past two or three chunks.

Serve everything gzip- or brotli-compressed. Uncompressed static assets is the
single most common production misconfiguration and typically costs 60–70% of
the transfer for text.

## Verification

```bash
# 1. Build and check the budgets.
npm run build && bash scripts/check_budget.sh
# PASS: exit 0

# 2. What is actually in the bundle.
npx vite-bundle-visualizer

# 3. Admin routes are lazy.
grep -n "Admin\|Inventory" src/routes.jsx | grep -v "lazy"
# PASS: no output

# 4. No namespace icon imports.
grep -rn "import \* as .* from 'lucide-react'\|from 'react-icons'" src/
# PASS: no output

# 5. One toast library.
grep -n "sonner\|react-hot-toast\|react-toastify" package.json
# PASS: exactly one

# 6. No client-side filtering of a full list.
grep -rnE "\.filter\(.*(search|query|category)" src/pages/ src/context/
# PASS: no output — the server filters

# 7. Chunks in the build output.
ls -lh dist/assets/*.js
# PASS: admin and inventory appear as separate files
```

Then Lighthouse mobile against the **preview** build (`npm run preview`), never
the dev server — dev is unminified, unsplit and served uncompressed, so its
numbers are meaningless.
