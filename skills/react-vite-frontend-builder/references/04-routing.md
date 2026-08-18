# Routing and code splitting

Route structure, lazy loading, and the bundle boundaries that keep the
storefront fast.

## The finding this fixes

**P2**: `routes.jsx` statically imported all 24 page components. The 76 KB
`Admin/Products.jsx` and 56 KB `Admin/Orders.jsx` were downloaded, parsed and
executed by every anonymous visitor who landed on the homepage — people who
could never open those pages.

On a 3G connection in Dhaka that is several seconds of dead time before anything
paints.

## The rule

> **Storefront routes load eagerly. Admin and inventory routes load lazily.**

A shopper must never download the admin bundle. Split at the point where the
audience changes.

```jsx
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

// Storefront — eager. These are the first paint for most visitors.
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";

// Admin and inventory — lazy. Separate chunks, fetched on demand.
const AdminShell = lazy(() => import("@/pages/Admin/AdminShell"));
const AdminProducts = lazy(() => import("@/pages/Admin/Products"));
const AdminOrders = lazy(() => import("@/pages/Admin/Orders"));
const InventoryShell = lazy(() => import("@/pages/Inventory/InventoryShell"));

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireStaff>
            <Suspense fallback={<RouteSpinner />}>
              <AdminShell />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route path="products" element={<AdminProducts />} />
        <Route path="orders" element={<AdminOrders />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

`Suspense` wraps **inside** `ProtectedRoute`, not outside. Outside, the chunk
downloads while the guard is still deciding — so an unauthorised visitor fetches
the admin bundle before being redirected. Inside, the guard runs first and the
chunk is never requested.

## Lazy loading is not access control

A lazy chunk is a public URL. Anyone can request
`/assets/Admin-a3f9c2.js` directly and read it.

Never put a secret, an internal endpoint list, or business logic that must stay
private in a frontend chunk. Splitting is a performance technique; the server's
`permission_classes` is the control.

## Handle chunk load failures

After a deploy, old hashed filenames stop existing. A user with the app open
navigates, the fetch 404s, and React unmounts the tree — a white screen with a
console error.

```jsx
const lazyWithRetry = (importFn) =>
  lazy(() =>
    importFn().catch(() => {
      // A failed chunk after a deploy means stale HTML. Reload once to pick up
      // the new manifest; the flag stops an infinite loop if it is a real error.
      if (!sessionStorage.getItem("chunk-reloaded")) {
        sessionStorage.setItem("chunk-reloaded", "1");
        window.location.reload();
      }
      return { default: () => <ChunkLoadError /> };
    })
  );
```

Clear the flag on a successful load.

## Route-level error boundaries

An error boundary at the app root blanks the entire application. One per route
section keeps the shell — navigation, header — alive.

```jsx
<Route element={<ErrorBoundary fallback={<SectionError />}><Outlet /></ErrorBoundary>}>
  <Route path="/admin" element={<AdminShell />}>…</Route>
</Route>
```

Error boundaries catch render errors only. They do **not** catch errors in event
handlers, async code, or `useEffect` callbacks — those need explicit
`try`/`catch`. This surprises people; a failed API call in an effect will not
hit the boundary.

## Scroll restoration

React Router does not reset scroll on navigation. Navigating from the bottom of
a long product list into a detail page leaves the user mid-page.

```jsx
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}
```

Key on `pathname` only, not the whole `location` — keying on `search` scrolls to
top on every filter change, losing the user's place.

## Manual chunks

Vite splits by dynamic import automatically. Group large stable vendor libraries
so they cache independently of application code:

```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        react: ["react", "react-dom", "react-router-dom"],
        charts: ["recharts"],          // admin-only, keep out of the main bundle
      },
    },
  },
},
```

Check what is actually in the bundle before adding entries here — guessing
usually makes it worse.

## Verification

```bash
npm run build
ls -la dist/assets/*.js | sort -k5 -n -r | head -20
# PASS: separate Admin-*.js and Inventory-*.js chunks exist,
#       and neither is in the entry chunk

# The entry chunk must not reference admin modules.
grep -l "AdminProducts\|InventoryShell" dist/assets/index-*.js
# PASS: no output
```

Browser, the real test:

```
1. Open the homepage in a fresh incognito window.
2. DevTools > Network > JS. Note total transferred.
3. PASS: no chunk whose name contains Admin or Inventory.
4. Navigate to /admin as staff.
5. PASS: the admin chunk downloads now, on demand.
```

Targets — see `performance-budget` for the full set:

| Metric | Target |
|---|---|
| Initial JS (gzipped) | < 200 KB |
| Largest single chunk | < 150 KB |
| Admin chunk in storefront entry | Never |

## Common mistakes

- Static imports for admin pages (**P2**).
- `Suspense` outside the guard, so unauthorised users still fetch the chunk.
- Treating lazy loading as access control.
- No chunk-load-error handling, so a deploy white-screens open sessions.
- A single root error boundary that blanks the whole app.
- No scroll restoration.
- Keying `ScrollToTop` on the full location object.
