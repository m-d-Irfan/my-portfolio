# Layout and navigation

The console shell: sidebar, banner, viewport, and where the auth boundary sits.

Copy [`assets/AdminLayout.jsx`](../assets/AdminLayout.jsx) and
[`assets/AdminBanner.jsx`](../assets/AdminBanner.jsx).

## The shell

```
grid-cols-1 md:grid-cols-[260px_1fr]

┌──────────────┬────────────────────────────────┐
│ sidebar      │ AdminBanner                    │
│ sticky       ├────────────────────────────────┤
│ h-screen     │ <Outlet />                     │
│              │ overflow-y-auto h-screen       │
└──────────────┴────────────────────────────────┘
```

The sidebar is `sticky top-0 h-screen`; the main pane scrolls independently.
Both need their own scroll container, or a long table scrolls the nav out of
reach — which is the most common admin layout mistake.

260px fits the longest nav label ("Brands & Houses") at `text-xs` without
wrapping. Check yours before changing it; a wrapped nav item breaks the vertical
rhythm of the whole sidebar.

## The auth boundary

> **The layout does not check roles. The route does.**

```jsx
<Route
  path="/admin"
  element={
    <ProtectedRoute requireStaff>
      <Suspense fallback={<RouteSpinner />}>
        <AdminLayout />
      </Suspense>
    </ProtectedRoute>
  }
>
  <Route index element={<Dashboard />} />
  <Route path="products" element={<AdminProducts />} />
</Route>
```

Two ordering details, both load-bearing:

- **`Suspense` inside `ProtectedRoute`.** Outside, the admin chunk downloads
  while the guard is still deciding, so an unauthorised visitor fetches it
  before being redirected.
- **The guard wraps the layout, not the pages.** Guarding each page means
  `AdminLayout` mounts for anyone, and its `useAuth` call plus any shell-level
  fetch fire before the redirect.

### Why the in-component check was removed

The original `AdminLayout` did this:

```jsx
// WRONG — audit finding S7/S8
if (!currentUser || !isAdmin()) {
  return <div>Staff Eyes Only</div>;
}
```

`currentUser` came from a context hydrated from `localStorage`. One console line
defeated it:

```js
localStorage.setItem('user', JSON.stringify({ is_staff: true }));
```

Worse, the check ran *after* mount, so child panels had already fired their
admin data requests. The fix is a route-boundary guard backed by
`GET /auth/me/` — see
`react-vite-frontend-builder/references/03-auth-and-routing.md`.

And the guard is still only UX. The actual control is `permission_classes` on
every endpoint (`security-hardening/references/01-permissions.md`). If a tampered
client renders the shell but every request 403s and no data appears, that is
ugly, not a breach.

## Nav config

Keep nav in one exported array, not inline JSX. It is then testable, and adding
a section is a one-line change.

```jsx
// src/pages/Admin/nav.jsx
import {
  Award, ClipboardList, LayoutDashboard, MessageSquare, ShoppingBag, Tag, Users,
} from 'lucide-react';

export const ADMIN_NAV = [
  { path: '/admin',            label: 'Dashboard',       icon: <LayoutDashboard size={18} />, end: true },
  { path: '/admin/products',   label: 'Products',        icon: <ShoppingBag size={18} /> },
  { path: '/admin/brands',     label: 'Brands & Houses', icon: <Award size={18} /> },
  { path: '/admin/categories', label: 'Categories',      icon: <Tag size={18} /> },
  { path: '/admin/orders',     label: 'Orders',          icon: <ClipboardList size={18} /> },
  { path: '/admin/reviews',    label: 'Reviews',         icon: <MessageSquare size={18} /> },
  // Superuser-only. Presentation only — /admin/users must ALSO be enforced
  // server-side. Hiding a link is not access control; the endpoint is.
  { path: '/admin/users',      label: 'Users & Staff',   icon: <Users size={18} />, capability: 'can_manage_users' },
];
```

## Active state

Use `NavLink`, not `useLocation` with a manual `===` comparison.

`end: true` on the index route only. Without it, `/admin` stays highlighted on
every child route, so two items appear active at once. With it on a parent
route, the parent stops highlighting when a child is open — which is why only
the index entry gets it.

`NavLink` also handles the trailing-slash and partial-match edge cases that a
manual comparison gets wrong.

## Capability-gated items

```jsx
{ADMIN_NAV.filter((item) =>
  !item.capability || user?.permissions?.includes(item.capability)
).map(renderNavItem)}
```

`permissions` comes from `/auth/me/`. Filtering the list is a courtesy — it
avoids showing a link that 403s. It is not a control, and the corresponding
endpoint needs its own permission class regardless.

## The banner

Route-aware header: icon, title, subtitle, watermark, clock. Two details in
`assets/AdminBanner.jsx` worth knowing about:

**Longest-prefix route matching.** An exact-match lookup falls back to the
dashboard on `/admin/products/42/edit`, so a user deep in a flow sees the wrong
title. `metaFor()` sorts matching prefixes by length and takes the longest.

**The clock ticks every 30s, not every second.** A 1s interval re-renders 60×
more often than the minute display changes and keeps a mobile tab awake. It also
formats in `Asia/Dhaka` explicitly — staff laptops set to another timezone would
otherwise show an order cut-off in the wrong one, which causes real dispatch
mistakes.

## Mobile

Below `md`, the grid collapses to one column and the sidebar becomes a drawer.

```jsx
const [navOpen, setNavOpen] = useState(false);

// Close on route change — otherwise the drawer covers the page just navigated to.
const { pathname } = useLocation();
useEffect(() => setNavOpen(false), [pathname]);
```

A drawer needs: `Escape` to close, focus trapped while open, focus returned to
the trigger on close, and `aria-expanded` on the button. Without those it is
unusable by keyboard. If that is more than the project needs, a horizontal
scrolling tab bar is a legitimate simpler choice.

## Verification

```bash
# No role check inside the layout.
grep -rnE "isAdmin|is_staff|Staff Eyes" src/pages/Admin/AdminLayout.jsx
# PASS: no output

# NavLink, not manual comparison.
grep -rn "location.pathname ===" src/pages/Admin/
# PASS: no output
```

```
Browser:
1. Log in as non-staff, go to /admin.       PASS: redirected to /
2. DevTools Network > JS.                    PASS: no Admin-*.js chunk fetched
3. As staff, open a long product table and scroll.
                                             PASS: sidebar stays put
4. Navigate to /admin/products/1/edit.       PASS: banner says Catalogue, not Dashboard
5. Tab through the sidebar.                  PASS: visible focus on every item
```

## Common mistakes

- A role check inside the layout instead of at the route (**S7/S8**).
- `Suspense` outside the guard, so the chunk is fetched anyway.
- One scroll container, so the sidebar scrolls away.
- Manual `pathname ===` instead of `NavLink`.
- `end` on a parent route, so it never highlights.
- A mobile drawer that stays open after navigation.
- Treating a hidden nav item as access control.
