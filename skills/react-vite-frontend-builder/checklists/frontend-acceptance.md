# Frontend acceptance checklist

Run before a frontend change is considered done. Every line is a command or an
observable outcome with a stated pass condition.

```bash
cd frontend
```

---

## 1. It builds and runs

- [ ] `npm run dev` — starts, no console errors on first paint
- [ ] `npm run build` — succeeds
- [ ] `npm run preview` — the **built** bundle works

The third catches what the first two miss: dev-server-only resolution, missing
`VITE_` vars, and code that relies on unminified names.

```bash
npx vitest run
npx eslint src/
```

---

## 2. No secrets in the bundle

```bash
npm run build
grep -riE "secret|api_key|apikey|password|bkash|cloudinary_api" dist/assets/*.js
# PASS: no output
```

- [ ] Every `VITE_` var is safe to publish
- [ ] Anything privileged is proxied through Django, not called from the browser
- [ ] `.env.local` is gitignored; `.env.example` is committed with no values

---

## 3. Auth — the S8 regression

The single most important check in this file. Run it every time the guard,
the auth provider, or `/auth/me/` changes.

```
1. Log in as a normal (non-staff) customer.
2. DevTools console:
     localStorage.setItem('user', JSON.stringify({is_staff:true, role:'admin'}))
     location.reload()
3. Navigate to /admin.
```

- [ ] **PASS:** redirected away from `/admin`
- [ ] **PASS:** with the shell force-rendered, every admin API call returns 403 and no data appears

Step 4 is the one that matters. Step 3 protects UX; step 4 proves the server is
the control.

```bash
# No role decision reads client storage.
grep -rn "localStorage" src/ | grep -iE "is_staff|is_superuser|role|isAdmin"
# PASS: no output

# No JWT payload decoding for authorization.
grep -rn "jwt_decode\|jwtDecode\|atob(" src/
# PASS: no output, or only non-auth use

# The provider asks the server.
grep -rn "auth/me" src/
# PASS: at least one hit, in the auth provider
```

- [ ] A hard refresh on a protected route does **not** bounce a logged-in user to `/login`
- [ ] Login returns the user to the page they were trying to reach
- [ ] An authenticated non-staff user hitting `/admin` goes to `/`, not `/login`
- [ ] Logging out in one tab logs out the others
- [ ] Logout calls the server so the refresh token is blacklisted

---

## 4. API client

- [ ] Exactly one axios instance; nothing bypasses it

```bash
grep -rn "fetch(\|axios\." src/ --include=*.jsx --include=*.js | grep -v "services/api"
# PASS: no output
```

- [ ] Concurrent 401s trigger **one** refresh

```
DevTools > Network, filter "refresh". Let the access token expire, then load a
page with several data-fetching components.
PASS: exactly one /auth/token/refresh/ request
```

- [ ] A failed refresh does not hard-reload the page
- [ ] 429 is surfaced with a retry delay and is never auto-retried
- [ ] Search inputs cancel superseded requests (`AbortController`)
- [ ] `FormData` uploads do not set `Content-Type` manually
- [ ] Trailing slashes match the backend — a POST never silently 301s

```bash
# 302 on a write means the body was dropped.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8000/api/orders \
  -H 'Content-Type: application/json' -d '{}'
# PASS: 401/400/404 — NOT 301 or 302
```

---

## 5. Routing and bundle size

- [ ] Admin and inventory routes are `lazy()`
- [ ] `Suspense` is **inside** `ProtectedRoute`, so unauthorised users never fetch the chunk

```bash
npm run build
ls -la dist/assets/*.js | sort -k5 -nr | head -10
# PASS: separate Admin-*.js / Inventory-*.js chunks exist

grep -l "AdminProducts\|InventoryShell" dist/assets/index-*.js
# PASS: no output — admin code is not in the entry chunk
```

```
Fresh incognito window on the homepage, DevTools > Network > JS:
PASS: no chunk with Admin or Inventory in its name
```

| Metric | Target |
|---|---|
| Initial JS, gzipped | < 200 KB |
| Largest single chunk | < 150 KB |

- [ ] Scroll resets on route change
- [ ] A stale chunk after deploy does not white-screen the app
- [ ] A 404 route exists

---

## 6. Cart and state

- [ ] Checkout sends ids and quantities only — **no** prices or totals

```bash
grep -rnE "(price|total|amount|subtotal)" src/services/orders.js
# PASS: no occurrence inside a request payload
```

- [ ] No index-assignment mutation of state

```bash
grep -rnE "\w+\[\w+\]\.\w+\s*(\+|-|)=" src/ --include=*.jsx
# PASS: no output
```

```
In StrictMode dev:
1. Add one item to the cart.        PASS: quantity 1, not 2
2. Add the same variant again.      PASS: one line, quantity 2
3. Add a different variant.         PASS: two separate lines
4. Reload.                          PASS: cart survives
5. Set localStorage cart to {"items":[{"quantity":-5}]} and reload.
                                    PASS: empty cart, no crash
```

- [ ] Cart is keyed on the variant, not the product
- [ ] Context values are memoised
- [ ] Server data is not mirrored into context

---

## 7. Errors and loading

- [ ] Every async view has loading, empty, and error states
- [ ] Server 5xx messages are never shown verbatim
- [ ] Route-level error boundaries — one failure does not blank the app
- [ ] Form field errors come from `error.normalized.fields`

---

## 8. Accessibility baseline

- [ ] Every interactive element is keyboard reachable
- [ ] Visible focus ring
- [ ] Images have `alt`; decorative ones have `alt=""`
- [ ] Loading spinners have `role="status"` and an `sr-only` label
- [ ] Colour is never the only signal for an error

---

## Sign-off

| § | Area | Result |
|---|---|---|
| 1 | Builds, tests, lints | |
| 2 | No secrets in the bundle | |
| 3 | Auth guard + S8 regression | |
| 4 | API client | |
| 5 | Routing and bundle size | |
| 6 | Cart and state | |
| 7 | Errors and loading | |
| 8 | Accessibility | |

§3 was exploitable in production. Do not sign it off from code reading — run
the console tampering test.
