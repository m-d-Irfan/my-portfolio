# Server-Verified Roles

This file owns the single most important rule in this skill: **a role check is a server round-trip or it is not a role check.**

## The rule

`localStorage` is a cache for display. It is never an authority.

Anything the browser stores, the user can edit. That includes `localStorage`, `sessionStorage`, IndexedDB, non-httpOnly cookies, React state, Redux, and any object you hydrated from any of them. There is exactly one artifact in this application that the client cannot forge: the **JWT**, because it carries an HMAC signature produced with `SECRET_KEY`, which the browser does not have. Every authorization decision must trace back to that signature being verified **on the server**.

The corollary that people miss: *verifying the JWT on the client does not help either.* `jwt-decode` is in this project's `package.json` (`^4.0.0`) and, fortunately, is never imported. If it were, decoding a JWT in the browser to read `is_staff` would be barely better than reading `localStorage` — the client cannot check the signature without the secret, so a hand-crafted token with `{"alg":"none"}` and `is_staff: true` decodes just fine. Decoding is not verifying.

## S8: the post-mortem

### The finding

`AdminLayout.jsx` and `InventoryLayout.jsx` guarded `/admin/*` and `/inventory/*` by reading `is_staff` off a user object hydrated from `localStorage`, and redirecting when it was falsy.

`src/authentication/auth.jsx` hydrated that object on mount:

```jsx
const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user")));
```

and wrote it on every login:

```jsx
localStorage.setItem("user", JSON.stringify(res.data.user || { email }));
```

The layout then made an authorization decision from it.

### The exploit

Open devtools on `https://delhialuminium.com`. Paste:

```js
let u = JSON.parse(localStorage.getItem('user'));
u.is_staff = true;
u.is_superuser = true;
u.role = 'admin';
localStorage.setItem('user', JSON.stringify(u));
// refresh -> full admin panel
```

Not even a login is required. A visitor with no account at all can run:

```js
localStorage.setItem('user', '{"is_staff":true,"is_superuser":true,"role":"admin"}');
location.href = '/admin';
```

No tooling. No proxy. No CVE. Fourteen seconds and the browser console that ships with every browser on earth.

### Why the redirect was cosmetic

The guard evaluated a predicate over data supplied by the person the guard exists to stop. Restating it as a sentence makes the absurdity obvious:

> *Dear user, are you an administrator? If you say no, I will send you away.*

Three specific properties made it worthless:

1. **The trust anchor was attacker-controlled.** `user` came from `localStorage`, which is a writable store on the attacker's own machine.
2. **The decision was made in code the attacker controls.** Even with a non-forgeable input, the check runs in JavaScript the attacker can pause in a debugger, patch, or bypass entirely by editing the bundle in a local override. Client code cannot enforce anything against its own operator.
3. **`navigate('/')` is a soft redirect, not a barrier.** It changes the URL. It does not stop already-scheduled network requests, does not unmount instantly, and does not prevent the lazily-loaded admin chunks from being fetched. `routes.jsx` `lazy()`-loads every admin and inventory page, so the chunks — including any hardcoded endpoint paths, field names, and business logic inside them — are downloaded before the guard resolves, and are retrievable by an unauthenticated visitor.

### Why the JWT was the only trustworthy artifact, and why the layouts ignored it

The login response contains a signed access token. The server produced it with `RefreshToken.for_user(user)`; its signature covers the claims; any modification invalidates it. It is the one thing in the browser that the user provably did not author.

The layouts never touched it. They read `user.is_staff` — a plain JSON field sitting next to the token in the same `localStorage`, with none of its integrity properties. The application was holding a tamper-proof credential and making decisions from the tamper-evident sticker next to it.

And the token could not be checked locally anyway (see "decoding is not verifying" above). The only way to convert the JWT into a trustworthy answer is to send it to the server and let the server verify the signature. That is what `GET /auth/me/` is for.

### Blast radius

`/admin/*` exposes Dashboard, Products, Categories, Orders, Users, Reviews, and SalesReport. `/inventory/*` exposes the inventory dashboard, products with `buying_price`, parties, stock-in receives, and dispatches.

But the honest accounting of S8's blast radius is: **the UI is not the asset.** Whether the attacker sees real data depends entirely on whether the API enforces permissions. That is the point of the next section.

## This is defence in depth, not the defence

**If the API is open, hiding the UI changes nothing.**

An attacker who can forge `localStorage.user` can equally well skip the frontend entirely:

```bash
curl https://api.delhialuminium.com/users/
curl https://api.delhialuminium.com/inventory/parties/
```

No React involved. The route guard was never in the request path. So the *only* control that matters for data exposure is the DRF permission class on each view. Fixing S8 without fixing the API permissions (findings S1/S2) means you have made the attack marginally less convenient and protected nothing.

Concretely, in this codebase:

```python
# daf_backend/settings.py
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    ...
}
```

`IsAuthenticatedOrReadOnly` means **every unauthenticated GET is allowed by default** on any view that does not override it. `UserViewSet` uses `IsAdminOrReadOnlyForIsActive`, which permits all safe methods to anyone — so `GET /users/` is anonymous-readable, and `get_queryset()` then runs with `AnonymousUser`, where `user.is_staff` is `False` and `user.id` is `None`.

Change the default to `IsAuthenticated` and grant read access explicitly per view. The route guard in this document is the *second* layer. Its job is:

- keep an honest user from stumbling into a broken UI they have no permission to use
- avoid rendering admin chrome that then 403s on every request
- remove the *appearance* of access, which is what makes an attacker stop looking

None of those are security properties. The security property lives in `permission_classes`. See `07-roles-and-scopes.md`.

## The fix, end to end

### Backend: `/auth/me/` as the single source of role truth

`CurrentUserView` already exists in `api/views.py` and is routed in `daf_backend/urls.py`:

```python
path('auth/me/', CurrentUserView.as_view(), name='current_user'),
```

This endpoint is the **only** sanctioned source of role truth in the application. Its contract:

- `IsAuthenticated` — an unauthenticated caller gets `401`, never a body
- it reads `request.user`, which DRF populated by **verifying the JWT signature**
- it never reads anything from the request body or query string
- the response is authoritative; anything cached client-side is stale until it says otherwise

```python
# assets/backend/views_me.py
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CurrentUserSerializer


class CurrentUserView(APIView):
    """
    GET /auth/me/

    The single source of role truth. `request.user` here is the real user,
    resolved by JWTAuthentication after verifying the token's signature
    against SECRET_KEY. Nothing in this response can be influenced by the
    caller.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)
```

**Two defects in the current serializer must be fixed before this endpoint is trustworthy.** `CustomUserSerializer` is declared as:

```python
fields = ['id', 'username', 'email', 'first_name', 'last_name', 'street_address',
          'city', 'phone_number', 'profile_picture', 'role', 'otp', 'date_joined',
          'is_active', 'is_staff', 'is_superuser']
read_only_fields = ['id', 'date_joined', 'otp', 'is_staff', 'is_active', 'is_superuser']
```

1. **`otp` is in `fields`.** It is read-only, but read-only means "not writable" — it is still *serialized out*. The user's current plaintext OTP is returned by `/auth/me/`, by the login response, and by `/users/`. Remove it from `fields` entirely. (It should not exist as a column at all — see `03-otp.md`.)
2. **`role` is writable.** It is absent from `read_only_fields`, so `PATCH /users/<own-id>/ {"role": "admin"}` is accepted by the serializer. Only object-level permissions stand between a customer and self-promotion. A role must never be writable through a self-service serializer — see `07-roles-and-scopes.md`.

Use a dedicated read-only serializer for this endpoint rather than reusing the writable one:

```python
# api/serializers.py
from rest_framework import serializers

from .models import CustomUser


class CurrentUserSerializer(serializers.ModelSerializer):
    """Read-only projection for /auth/me/. Never used for writes."""

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'profile_picture', 'role', 'is_staff', 'is_superuser',
            'is_active', 'date_joined',
        ]
        read_only_fields = fields          # every field, no exceptions
```

Note `otp` is gone, and `read_only_fields = fields` makes it structurally impossible for a future edit to accidentally open a write path.

### Frontend: `useVerifiedUser()`

```js
// assets/frontend/useVerifiedUser.js
import { useCallback, useEffect, useState } from 'react';
import api from '../js/api';

/**
 * Returns { user, status } where status is:
 *   'verifying'      - the /auth/me/ round trip is in flight; render nothing
 *                      privileged
 *   'verified'       - `user` came from the server over a verified JWT
 *   'unauthenticated'- no valid token, or the server refused
 *
 * This hook never reads a role from localStorage. There is no cache to poison
 * and no optimistic path. The only way to reach 'verified' is a 200 from
 * GET /auth/me/.
 */
export function useVerifiedUser() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('verifying');

  const verify = useCallback(async () => {
    setStatus('verifying');
    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
      setStatus('verified');
      return res.data;
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await verify();
      if (!alive) return;
      void result;
    })();
    return () => {
      alive = false;
    };
  }, [verify]);

  return { user, status, revalidate: verify };
}
```

### Frontend: `ProtectedRoute`

```jsx
// assets/frontend/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useVerifiedUser } from './useVerifiedUser';

function hasRole(user, roles) {
  if (!user) return false;
  if (!roles || roles.length === 0) return true;   // authentication only
  if (user.is_superuser) return true;
  return roles.includes(user.role);
}

/**
 * <ProtectedRoute roles={['admin']}>  -- staff-only areas
 * <ProtectedRoute roles={['inventory_manager', 'admin']}>
 * <ProtectedRoute>                    -- any authenticated user
 *
 * Children are mounted only when status === 'verified' AND the role matches.
 * There is no frame in which privileged UI exists on screen unverified.
 */
export default function ProtectedRoute({ roles, children, fallback = null }) {
  const { user, status } = useVerifiedUser();
  const location = useLocation();

  if (status === 'verifying') {
    return fallback ?? <div className="p-8 text-sm text-neutral-500">Checking access...</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!hasRole(user, roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

### Wiring it into `routes.jsx`

```jsx
// src/routes.jsx
<Route
  path="/admin"
  element={
    <ProtectedRoute roles={['admin']}>
      <AdminLayout />
    </ProtectedRoute>
  }
>
  <Route index element={<Dashboard />} />
  <Route path="products" element={<Products />} />
  <Route path="categories" element={<Categories />} />
  <Route path="orders" element={<Orders />} />
  <Route path="users" element={<Users />} />
  <Route path="reviews" element={<Reviews />} />
  <Route path="sales" element={<SalesReport />} />
</Route>

<Route
  path="/inventory"
  element={
    <ProtectedRoute roles={['inventory_manager', 'admin']}>
      <InventoryLayout />
    </ProtectedRoute>
  }
>
  <Route index element={<InventoryDashboard />} />
  <Route path="products" element={<InventoryProducts />} />
  <Route path="parties" element={<Parties />} />
  <Route path="stock-in" element={<StockIn />} />
  <Route path="dispatches" element={<Dispatches />} />
</Route>
```

The guard now wraps the layout instead of living inside it. `AdminLayout.jsx` and `InventoryLayout.jsx` become pure presentation — sidebar, header, `<Outlet />` — with **no authorization logic at all**. That separation is the point: a layout that renders chrome cannot accidentally become the thing that decides who may see it.

Two structural notes for this repo:

- `App.jsx` mounts `<AuthProvider>` outside `<Router>`, so `<Navigate>` cannot be used at provider level. `ProtectedRoute` is inside the router, so `useLocation` and `<Navigate>` work there. Keep it that way.
- `routes.jsx` uses the declarative `<BrowserRouter>` API rather than `createBrowserRouter`, so route `loader` functions are unavailable. `ProtectedRoute` is the correct pattern for this setup; do not reach for loaders without migrating the router first.

## WRONG and RIGHT

### WRONG — reading a role from context hydrated from localStorage

```jsx
// src/Pages/Admin/AdminLayout.jsx   -- DO NOT DO THIS
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../authentication/auth';

const AdminLayout = () => {
  // `user` originates from:
  //   useState(() => JSON.parse(localStorage.getItem("user")))
  // i.e. an attacker-authored object.
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !(user.is_staff || user.is_superuser)) {
      navigate('/');
    }
  }, [navigate]);

  // Renders admin chrome immediately, before anything is verified.
  return (
    <div className="flex">
      <AdminSidebar />
      <Outlet />
    </div>
  );
};
```

Every failure in one component: the input is forgeable, the decision is client-side, the redirect is soft, and the privileged UI renders optimistically.

### Also WRONG — the partial fix currently in the repo

The layouts have since gained a server call. It is a real improvement and it is still not sufficient:

```jsx
// src/Pages/Admin/AdminLayout.jsx   -- current state, still broken
const [verifying, setVerifying] = useState(true);

useEffect(() => {
  let isMounted = true;
  const verifyAccess = async () => {
    const serverUser = await fetchCurrentUser();
    if (!isMounted) return;
    if (!serverUser || !(serverUser.is_staff || serverUser.is_superuser)) {
      navigate('/');
    } else {
      setVerifying(false);
    }
  };

  if (!user || !(user.is_staff || user.is_superuser)) {
    navigate('/');            // still gates on the localStorage object first
  } else {
    verifyAccess();
  }

  return () => { isMounted = false; };
}, [fetchCurrentUser, navigate]);   // <- `user` is NOT a dependency

if (verifying || !user || !(user.is_staff || user.is_superuser)) return null;
```

Four residual defects:

| Defect | Consequence |
|---|---|
| `user` is absent from the dependency array | The check runs **once on mount and never again**. `fetchCurrentUser` is `useCallback(..., [])` and `navigate` is router-stable, so when `/auth/me/` overwrites `user` with the real non-staff record, or when the cross-tab `storage` listener syncs a logout, nothing re-evaluates. |
| `verifying` is never reset to `true` | Once `false`, it stays `false` for the mounted lifetime. Every nested route change under `/admin/*` re-renders `<Outlet />` with no re-check. |
| The forged `user` still gates the first branch | The attacker's object is what decides whether `verifyAccess()` is even called. On the server-verified path it is redundant; on the render gate at the bottom it is the *only* input, since `verifying` is already `false`. |
| The guard protects the chrome, not the data | It gates whether the layout renders. Child routes fetch independently — `Users.jsx`, `Dashboard.jsx`, `Orders.jsx`, `Reviews.jsx`, `Categories.jsx`, and `SalesReport.jsx` each read the token from `localStorage` and issue their own bare `axios` calls, unaffected by this component's state. |

Add to that: `AdminLayout` admits `is_staff || is_superuser` while `Navbar.jsx` shows the "Admin Panel" link on `is_superuser || is_staff || role === 'admin'`. A `role === 'admin'` user without `is_staff` is shown a link that bounces them straight back out. Two components, two different definitions of "admin," which is the symptom `07-roles-and-scopes.md` exists to fix.

### RIGHT — gate the render on server-verified status

```jsx
// src/routes.jsx
<Route
  path="/admin"
  element={
    <ProtectedRoute roles={['admin']}>
      <AdminLayout />
    </ProtectedRoute>
  }
>
  {/* ... */}
</Route>
```

```jsx
// src/Pages/Admin/AdminLayout.jsx   -- now purely presentational
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

const AdminLayout = () => (
  <div className="flex min-h-screen">
    <AdminSidebar />
    <main className="flex-1 p-6">
      <Outlet />
    </main>
  </div>
);

export default AdminLayout;
```

The properties that make this correct:

- the only input is a `200` from `/auth/me/` over a server-verified JWT
- no privileged component is ever mounted before that response arrives
- `<Navigate replace>` replaces the history entry, so back-button does not re-enter the protected tree
- the layout contains zero authorization logic, so it cannot be the thing that gets it wrong

## Loading state, not optimistic render

The instinct is to render the admin UI immediately and hide it if verification fails. Resist it, for three reasons.

**It leaks.** Between mount and the `/auth/me/` response, the sidebar with every admin nav item is on screen and screenshottable. The nav is a map of your admin surface.

**It fetches.** A mounted `Dashboard` fires its `useEffect` data calls immediately. Even when those calls 403, you have told the attacker which endpoints exist, what they are called, and what shape they expect. The acceptance test in `checklists/auth-acceptance.md` requires **zero admin data requests** in the network tab during a failed access attempt — that is the observable form of this rule.

**It flickers for legitimate users.** Admin UI appearing then vanishing then reappearing is worse UX than a 200 ms skeleton.

Render a skeleton matching the eventual layout during `'verifying'`. On the `Asia/Dhaka` network profile, expect roughly 150-400 ms for the round trip.

## Force-logout on mismatch

When the cached user and the server user disagree on identity or privilege, the cache is not merely stale — something is wrong. Treat it as hostile.

```jsx
// src/authentication/auth.jsx
import { useCallback } from 'react';
import api from '../js/api';
import { clearAccessToken } from '../js/tokenStore';

const PRIVILEGE_FIELDS = ['id', 'role', 'is_staff', 'is_superuser', 'is_active'];

export function useRoleSync(cachedUser, setUser) {
  return useCallback(async () => {
    let serverUser;
    try {
      const res = await api.get('/auth/me/');
      serverUser = res.data;
    } catch {
      clearAccessToken();
      setUser(null);
      return null;
    }

    const mismatch =
      cachedUser &&
      PRIVILEGE_FIELDS.some((f) => cachedUser[f] !== serverUser[f]);

    if (mismatch) {
      // Either the account changed server-side (demotion, deactivation) or
      // the cache was tampered with. Both mean: drop everything and re-derive
      // from the server. Never merge, never prefer the cached value.
      console.warn('[auth] cached user disagrees with server; forcing re-auth');
      clearAccessToken();
      setUser(null);
      await api.post('/auth/logout/').catch(() => {});
      window.location.replace('/');
      return null;
    }

    setUser(serverUser);
    return serverUser;
  }, [cachedUser, setUser]);
}
```

The rule when cache and server disagree: **the server always wins, and the disagreement itself is a signal.** Never reconcile field by field, never keep the "higher" privilege, never prefer the cached value because it arrived first.

If you keep a `localStorage` copy of the user for display (name and avatar in the navbar, avoiding a flash of empty state), that is legitimate — but it must be a strictly-non-privileged projection:

```js
// Cache ONLY what is safe to render from an untrusted source.
localStorage.setItem('user_display', JSON.stringify({
  first_name: serverUser.first_name,
  email: serverUser.email,
  profile_picture: serverUser.profile_picture,
}));
```

`role`, `is_staff`, `is_superuser`, and `id` are absent by construction. Forging a display name gets the attacker a different name in the corner of their own screen.

## Re-sync on every token refresh

A refresh is the natural revalidation point. The user just proved possession of a valid refresh token; use that moment to re-derive their privileges.

```js
// src/js/api.js
import { setAccessToken } from './tokenStore';

const roleSyncListeners = new Set();
export function onRoleSyncNeeded(fn) {
  roleSyncListeners.add(fn);
  return () => roleSyncListeners.delete(fn);
}

// inside refreshAccessToken(), after a successful refresh:
setAccessToken(res.data.access);
roleSyncListeners.forEach((fn) => fn());   // -> triggers GET /auth/me/
```

```jsx
// src/authentication/auth.jsx
useEffect(() => onRoleSyncNeeded(() => { void fetchCurrentUser(); }), [fetchCurrentUser]);
```

With a 10-minute access lifetime, this bounds cached-privilege staleness to one access-token window even without any of the revocation machinery in `06-session-revocation.md`. It is not a substitute for that machinery — the *token's own claims* remain stale regardless of what the frontend does — but it does mean the UI stops offering an admin link to someone who was demoted eight minutes ago.

Also re-sync on:

- `visibilitychange` when the tab becomes visible after being hidden for more than the access-token lifetime
- entering any protected route (`ProtectedRoute` does this by construction — `useVerifiedUser` fires on mount)
- immediately after any action that could change the caller's own privileges

## Checklist for any new protected area

1. The route is wrapped in `<ProtectedRoute roles={[...]}>` in `routes.jsx`, not guarded inside a layout component.
2. The DRF view has an explicit `permission_classes` that enforces the same rule. The frontend guard is the second layer; this one is the actual control.
3. No component under the route reads `role`, `is_staff`, or `is_superuser` from `localStorage`, from `AuthContext` hydrated by `localStorage`, or from a decoded JWT.
4. `status === 'verifying'` renders a skeleton, not the real UI.
5. `grep -rn "localStorage" src/ | grep -Ei "is_staff|is_superuser|role"` returns nothing.
6. The manual S8 test in `checklists/auth-acceptance.md` passes: forge the flag, refresh, observe a loading state, a redirect, and **zero** admin data requests in the network tab.
