---
name: auth-flows
description: Build every identity operation correctly for a Django REST Framework + React app — server-verified role checks, JWT token strategy and lifetimes, refresh-loop reliability, OTP issue and verify, password reset, email verification, session revocation, role matrices, and Google OAuth. Kills the localStorage-tampering class of admin-panel bypass. Trigger on "add login", "authentication", "OTP", "one time code", "password reset", "forgot password", "email verification", "verify email", "logout everywhere", "revoke session", "roles", "role check", "is_staff", "admin guard", "protected route", "who is logged in", "current user", "social login", "Google login", "2FA", "token refresh", "JWT", "logged out automatically", "keeps logging me out", "session expires too fast", "token expired", "refresh token not working", "how long should the token last", "stay logged in".
---

# Auth Flows

Every identity operation in this stack, done once, correctly. Login, OTP,
password reset, email verification, sessions, revocation, roles, and social
OAuth.

This skill owns **who someone is**. `security-hardening` owns **what they are
allowed to do**. Both are required; neither substitutes for the other.

## When to use

- Adding or changing any login, signup, or credential flow
- Adding a protected route or a role-gated page
- Anything involving `is_staff`, a role field, or "only admins can see this"
- OTP, password reset, email verification, or token handling
- The question "how do I know who this request is from"

Do **not** use it for endpoint authorisation, permission classes, throttle
policy, or upload validation — that is `security-hardening`.

## The one rule

**A role check is a server round-trip or it is not a role check.**

`localStorage` is a cache for display. It is never an authority. Everything else
in this skill follows from that.

### The exploit this exists to kill (S8)

The app trusted `localStorage.user.is_staff` for admin routing. Anyone could open
the browser console and run:

```js
let u = JSON.parse(localStorage.getItem('user'));
u.is_staff = true; u.is_superuser = true;
localStorage.setItem('user', JSON.stringify(u));
// refresh → full admin panel
```

`AdminLayout.jsx` and `InventoryLayout.jsx` both redirected on `!user.is_staff`
read from localStorage — cosmetic only. The JWT was the single tamper-proof
artifact in the browser, and neither layout validated it.

The fix is `GET /auth/me/` plus `useVerifiedUser()` plus `ProtectedRoute`. All
three ship in [`assets/`](./assets/).

> This is defence in depth, **not** the security boundary. If the API endpoints
> are open (S1/S2), hiding the admin UI accomplishes nothing — the attacker
> skips the UI and calls the endpoint directly. Fix both.

## Decision rules

| Situation | Do this | Reference |
|---|---|---|
| **Users get logged out unexpectedly** | Find the cause in the symptom table. **Do not raise the access lifetime** | [09](./references/09-session-longevity.md) |
| Session should last longer | Raise `REFRESH_TOKEN_LIFETIME` only; rotation makes it sliding | [09](./references/09-session-longevity.md) |
| Gating a route on login | `<ProtectedRoute />` | [02](./references/02-server-verified-roles.md) |
| Gating a route on a role | `<ProtectedRoute roles={['admin']} />` | [02](./references/02-server-verified-roles.md) · [07](./references/07-roles-and-scopes.md) |
| Gating a route on a capability | `<ProtectedRoute capability="can_access_inventory" />` | [07](./references/07-roles-and-scopes.md) |
| Showing/hiding a button | `<RequireCapability>` — presentation only | [02](./references/02-server-verified-roles.md) |
| Choosing where tokens live | Cookie mode by default | [01](./references/01-token-strategy.md) |
| Sending a one-time code | `issue_otp()` + scoped throttle | [03](./references/03-otp.md) |
| Checking a one-time code | `verify_otp()` — never `==` | [03](./references/03-otp.md) |
| Forgot-password | Enumeration-safe, single-use, 3/hour | [04](./references/04-password-reset.md) |
| Confirming an email address | [05](./references/05-email-verification.md) | |
| Logging out everywhere | Blacklist + `token_version` bump | [06](./references/06-session-revocation.md) |
| A user's role changed | Bump `token_version` — do not wait for expiry | [06](./references/06-session-revocation.md) |
| Adding Google sign-in | [08](./references/08-social-oauth.md) | |

## Workflow

1. **Install the backend endpoint.** Copy
   [`assets/backend/views_me.py`](./assets/backend/views_me.py) to
   `api/views_me.py` and route it:
   ```python
   path('auth/me/', CurrentUserView.as_view(), name='current_user'),
   ```
2. **Install the frontend pair.** Copy
   [`useVerifiedUser.jsx`](./assets/frontend/useVerifiedUser.jsx) and
   [`ProtectedRoute.jsx`](./assets/frontend/ProtectedRoute.jsx) to
   `src/authentication/`.
3. **Mount the provider above the router** in `App.jsx`:
   ```jsx
   <VerifiedUserProvider>
     <Router><AppRoutes /></Router>
   </VerifiedUserProvider>
   ```
   One fetch, shared. Do not call it per-route.
4. **Replace every client-side role check.** Search the codebase for
   `is_staff`, `is_superuser`, and `localStorage.getItem("user")`. Every read
   that gates access becomes `hasRole()` or `can()`.
5. **Wrap protected routes** with `<ProtectedRoute>`, choosing roles or
   capability per the table above.
6. **Confirm the API enforces the same rule** with permission classes from
   `security-hardening`. The UI gate alone is not sufficient.
7. **Add OTP / reset / verification** flows from the references as needed.
8. **Run the verification below.**

## Verification

```bash
# 1. /auth/me/ rejects an absent or bad token.
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/auth/me/
# expect: 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer not.a.real.token"
# expect: 401

# 2. /auth/me/ reports the truth, not the client's claim.
curl -s http://localhost:8000/api/auth/me/ -H "Authorization: Bearer $CUSTOMER_TOKEN"
# expect: "is_staff": false — regardless of anything in the browser

# 3. OTP attempt cap.
for i in $(seq 1 7); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:8000/api/auth/otp/verify/ \
    -H 'Content-Type: application/json' -d '{"email":"u@example.com","code":"000000"}'
done; echo
# expect: the run ends in 429, and the correct code no longer works afterwards

# 4. OTP expiry and replay.
#    - wait past OTP_TTL_MINUTES, submit the correct code  -> rejected
#    - submit a correct code twice                          -> second is rejected

# 5. Revocation.
#    - change a password, then use an old refresh token     -> 401
#    - demote a staff user, then call /auth/me/ with their existing token
#      -> is_staff false within the access-token window (immediately with token_version)
```

**The S8 manual test — run this in a browser, every time auth changes:**

1. Log in as an ordinary customer.
2. In the console:
   `let u=JSON.parse(localStorage.getItem('user')); u.is_staff=true; localStorage.setItem('user',JSON.stringify(u))`
3. Navigate to `/admin`.
4. **Expect:** a loading state, then a redirect away. **Zero** admin data
   requests in the Network tab. If any admin endpoint is called, or any admin
   chrome paints before the redirect, the gate is broken.

## Related skills

| Skill | Relationship |
|---|---|
| `security-hardening` | Owns endpoint authorisation. This skill establishes identity; that one enforces what it may do. `HasRole()` lives there. |
| `react-vite-frontend-builder` | Consumes `useVerifiedUser` and `ProtectedRoute`. Its `AuthContext` must not gate on a cached role. |
| `admin-panel-builder` | Its layout guard must be `<ProtectedRoute roles={['admin','staff']}>`, not a client-side `if`. |
| `jobs-and-integrations` | Owns the email delivery that OTP and reset flows depend on. |
| `testing-harness` | Turns [`checklists/auth-acceptance.md`](./checklists/auth-acceptance.md) into automated tests. |

## Reference files

- [01-token-strategy.md](./references/01-token-strategy.md) — where tokens live, and the honest tradeoff *(N1, N7)*
- [02-server-verified-roles.md](./references/02-server-verified-roles.md) — the S8 fix, end to end *(S7, S8)*
- [03-otp.md](./references/03-otp.md) — hashed, expiring, attempt-capped, throttled *(N2, N3)*
- [04-password-reset.md](./references/04-password-reset.md) — single-use, enumeration-safe
- [05-email-verification.md](./references/05-email-verification.md) — signup and email-change flows
- [06-session-revocation.md](./references/06-session-revocation.md) — getting access back *(N4, N8)*
- [07-roles-and-scopes.md](./references/07-roles-and-scopes.md) — the project's role matrix
- [08-social-oauth.md](./references/08-social-oauth.md) — Google via allauth, without account takeover
- [09-session-longevity.md](./references/09-session-longevity.md) — the eight causes of unexpected logout, and why 30-day access tokens are the wrong fix
- [checklists/auth-acceptance.md](./checklists/auth-acceptance.md) — the acceptance gate

## Assets

- [backend/views_me.py](./assets/backend/views_me.py) — `CurrentUserView`, `CurrentUserSerializer`
- [backend/otp.py](./assets/backend/otp.py) — `OTPCode`, `issue_otp`, `verify_otp`, `can_resend`, `purge_expired_otps`
- [frontend/useVerifiedUser.jsx](./assets/frontend/useVerifiedUser.jsx) — `VerifiedUserProvider`, `useVerifiedUser`
- [frontend/ProtectedRoute.jsx](./assets/frontend/ProtectedRoute.jsx) — `ProtectedRoute`, `RequireCapability`
- [frontend/api.js](./assets/frontend/api.js) — axios instance, single-flight refresh queue, normalized errors

## Common mistakes

- **Rendering protected UI optimistically from the cached user and correcting
  later.** The admin panel mounts and fires its data requests before the
  correction arrives. That *is* S8. Render a loading state and wait.
- **Calling `/auth/me/` inside each `ProtectedRoute`.** One provider above the
  router, one fetch. Per-route fetching makes every navigation wait on the
  network.
- **Clearing the session on a network error.** A timeout is not a logout.
  Distinguish 401/403 (session over) from no-response (retry).
- **`window.location.href = "/login"` on refresh failure.** A hard reload
  destroys unsaved work. Navigate with the router and preserve `from`.
- **Comparing OTP codes with `==`.** String equality short-circuits, so response
  time leaks the correct prefix. Use `hmac.compare_digest`. *(N3)*
- **Storing the OTP in plaintext on the user row.** A database read yields live
  codes, and `fields = '__all__'` will eventually serialise it into a response. *(N3)*
- **Not invalidating prior codes on reissue.** Request 50 codes and any of them
  works — the keyspace just got 50× wider.
- **Returning the OTP in the API response, even under DEBUG.** The attacker
  requesting the code is the one reading the answer.
- **Different responses for "email not found" vs "email sent".** That is an
  account enumeration oracle. Same response, same timing, always.
- **Assuming `BLACKLIST_AFTER_ROTATION` revokes access tokens.** It does not.
  An access token stays valid until it expires; a demoted admin keeps admin
  claims for the full window unless you bump `token_version`. *(N4)*
- **Letting a registration payload set `role`, `is_staff` or `is_superuser`.**
  Mark them read-only on the serializer. Self-service privilege escalation is a
  one-line bug.
- **Auto-linking a social login to an existing account by unverified email.**
  That is account takeover: anyone who can make an IdP assert an email address
  inherits the account. *(see [08](./references/08-social-oauth.md))*
