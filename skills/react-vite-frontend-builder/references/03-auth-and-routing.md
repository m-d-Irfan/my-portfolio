# Auth and routing

Owns session state, role checks and route guards.

This file exists because of audit finding **S8**: an admin panel was reachable by
editing `localStorage` in DevTools. The previous version of this skill taught the
pattern that caused it. Read this file before writing any guard.

## The rule

> **`localStorage` is a cache, never a source of truth.**
> Roles come from `GET /auth/me/`. A guard that trusts client storage is
> decoration.

## Why the old pattern was exploitable

```jsx
// WRONG — this is S8
const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
...
if (!user?.is_staff) return <Navigate to="/" />;
return children;
```

`localStorage` is fully attacker-controlled. Anyone types this into the console:

```js
localStorage.setItem("user", JSON.stringify({ is_staff: true, role: "admin" }));
location.reload();
```

…and the admin panel renders. Every widget, every route, every menu.

Decoding `is_staff` out of the JWT payload is the same bug wearing a costume.
The payload is base64, not encrypted — it is readable and forgeable client-side,
and the signature is only checked by the server. A revoked admin also stays admin
for the remaining lifetime of the access token.

## What actually protects the data

Two independent layers, and only one of them is real:

| Layer | Mechanism | Purpose |
|---|---|---|
| **Server** | `permission_classes` on every endpoint | The actual control |
| **Client** | `/auth/me/`-derived guard | Not showing a UI that will 403 |

The client guard is a **UX affordance**. If a tampered `localStorage` renders the
admin shell but every request returns 403 and no data appears, that is unpleasant
but not a breach. If it renders the shell *and* the data loads, the server was
never checking — and no amount of frontend work fixes that.

So: harden the guard because a blank admin screen is bad UX, and never treat it
as the security boundary. See
`security-hardening/references/01-permissions.md`.

## The provider

Copy [`assets/AuthContext.jsx`](../assets/AuthContext.jsx) verbatim. Its shape:

```jsx
const [status, setStatus] = useState("loading");  // 'loading' | 'authed' | 'anon'
const [user, setUser] = useState(null);

// Boot: if a token exists, ask the server who it belongs to.
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!getAccessToken()) { setStatus("anon"); return; }
    try {
      const { data } = await api.get("/auth/me/");
      if (cancelled) return;
      setUser(data);
      setStatus("authed");
    } catch {
      if (cancelled) return;
      clearAuthState();
      setUser(null);
      setStatus("anon");
    }
  })();
  return () => { cancelled = true; };
}, [refreshKey]);
```

Three properties this has and the old one did not:

- **Three states, not two.** `loading` is distinct from `anon`. Collapsing them
  makes every guard redirect to `/login` on the first frame, before `/auth/me/`
  answers — the user is logged in and gets bounced anyway.
- **The server decides.** `user` only ever holds a `/auth/me/` response body.
- **A tampered cache cannot survive a boot.** If `localStorage` says admin and
  the server says customer, the server response overwrites it.

`localStorage` may still hold a copy for optimistic first paint — but the copy is
never read for a role decision, only for a name or avatar while `loading`.

## The guard

```jsx
export function ProtectedRoute({ children, requireStaff = false }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageSpinner />;

  if (status === "anon") {
    // `from` lets login return the user to where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // user came from /auth/me/, so is_staff is the server's answer.
  if (requireStaff && !user?.is_staff) {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

Usage:

```jsx
<Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
<Route path="/admin/*" element={
  <ProtectedRoute requireStaff><AdminShell /></ProtectedRoute>
} />
```

Redirect an unauthorised staff route to `/`, not `/login`. Sending an
authenticated non-admin to a login page implies the right credentials would grant
access, and it loops for a user who is already signed in.

## Login returns the user where they came from

```jsx
const navigate = useNavigate();
const location = useLocation();
const from = location.state?.from?.pathname || "/";

const onSubmit = async (values) => {
  await login(values);         // sets tokens, then fetches /auth/me/
  navigate(from, { replace }); // replace: no back-button loop into the form
};
```

## Token storage

The default here is `localStorage`, and it has a real cost: **any XSS
exfiltrates both tokens**, and a stolen refresh token is a persistent session.

| | localStorage | httpOnly cookie |
|---|---|---|
| XSS can read tokens | Yes | No |
| CSRF exposure | No | Yes — needs `SameSite` + CSRF token |
| Works cross-origin | Yes | Needs shared parent domain or proxy |
| Complexity | Low | Moderate; backend change required |

Prefer **httpOnly cookie for the refresh token, access token in memory only** for
anything handling payments or PII. `localStorage` is the pragmatic default for a
cross-origin SPA where the backend cannot be changed; do not pretend it is the
secure option. See `auth-flows` for the cookie implementation.

Whichever is chosen, the role decision still comes from `/auth/me/`.

## Cross-tab consistency

Logging out in one tab must log out the others.

```jsx
useEffect(() => {
  const onStorage = (e) => {
    if (e.key === "access_token" || e.key === "refresh_token") bump();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);
```

The `storage` event fires in *other* tabs, not the one that wrote — pair it with
the in-tab `tokens-updated` event the API client dispatches.

## Verification

The tampering test. Run it every time the guard changes.

```
1. Log in as a normal customer.
2. DevTools console:
     localStorage.setItem('user', JSON.stringify({is_staff:true, role:'admin'}))
     location.reload()
3. PASS: redirected away from /admin.
4. Then force-render the shell and confirm every admin API call returns 403
   and no data renders.
```

Step 4 is the one that matters. Step 3 protects UX; step 4 proves the server is
the control.

```bash
# No role decision reads client storage.
grep -rn "localStorage" src/ | grep -iE "is_staff|is_superuser|role|isAdmin"
# PASS: no output

# No JWT payload decoding for authorization.
grep -rn "jwt_decode\|jwtDecode\|atob(" src/
# PASS: no output, or only non-auth use

# The guard consults the server-derived user.
grep -rn "auth/me" src/
# PASS: at least one hit, in the auth provider
```

## Common mistakes

- Deriving a role from `localStorage` or a decoded JWT (**S8**).
- Two states instead of three, so authenticated users get bounced on first paint.
- No `from` state, so login always lands on `/`.
- Sending an authenticated non-admin to `/login`.
- Assuming the guard is the security boundary.
- No cross-tab sync, so one tab stays "logged in" after logout elsewhere.
