# API client

The axios instance every request goes through. Owns base URL, auth header
injection, token refresh, error normalisation and cancellation.

Copy [`assets/api.js`](../assets/api.js) verbatim.

## One instance

Every request goes through the single exported instance. Not `fetch()` in one
component and `axios.get()` in another.

The reason is not tidiness. Interceptors are the only place that refresh
handling, error normalisation and auth headers exist — a raw `fetch()` bypasses
all three, so it will fail differently, retry differently, and produce an error
shape no form knows how to render.

```js
import api from "@/services/api";

const { data } = await api.get("/products/");
```

## Base URL

```js
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
```

Vite inlines `import.meta.env.*` at **build** time, not runtime. Two consequences:

- Changing the API URL requires a rebuild, not a restart.
- **Every `VITE_` variable is in the shipped bundle.** Never put a secret in
  one — no Cloudinary API secret, no bKash key, no admin token. If the frontend
  needs a privileged operation, proxy it through the backend.

## Trailing slashes

Django's `APPEND_SLASH` answers a slash-less POST with a **302**, and the browser
follows it with a GET. The body vanishes and the write silently does nothing.

```js
api.post("/orders/", payload);   // correct
api.post("/orders", payload);    // 302 -> GET -> body lost
```

This presents as "works in Postman, not in the app" — Postman sends the redirect
as a POST; browsers do not. Match the backend convention exactly.

## Refresh: one flight, one queue

A page that mounts six components fires six requests. If the access token has
expired, all six 401 at once.

Without a queue, each launches its own refresh. With `ROTATE_REFRESH_TOKENS`
on — which the backend has — the first rotation invalidates the refresh token
the other five are holding. Five refreshes fail, the session is cleared, and the
user is bounced to `/login` while genuinely logged in.

```js
let isRefreshing = false;
let waiters = [];

const refreshAccessToken = async () => {
  if (isRefreshing) {
    // Park. Resolve when the in-flight refresh lands.
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }
  isRefreshing = true;
  try {
    const token = await doRefresh();
    waiters.forEach(({ resolve }) => resolve(token));
    waiters = [];
    return token;
  } catch (err) {
    waiters.forEach(({ reject }) => reject(err));
    waiters = [];
    clearAuthState();
    throw err;
  } finally {
    isRefreshing = false;
  }
};
```

Three details that matter:

- **`_retried` guard.** Without it a persistently-401 endpoint loops forever.
- **Never refresh the refresh call.** If `/auth/token/refresh/` itself 401s, the
  session is over — retrying recurses.
- **Bare `axios`, not `api`, inside the refresh.** Using the instance sends the
  refresh request back through this same interceptor.

## Never hard-redirect on auth failure

```js
// WRONG
window.location.href = "/login";
```

A full page reload destroys unsaved form state, cancels in-flight requests, and
loses the route the user was on. It is also untestable — jsdom has no navigation.

```js
// RIGHT — clearAuthState dispatches 'tokens-updated'; the auth provider flips
// to unauthenticated and ProtectedRoute navigates with the router, preserving
// `from` so the user returns where they were.
clearAuthState();
return Promise.reject(err);
```

## Normalise errors once

DRF returns at least three shapes: `{detail: "..."}` for permissions and
throttles, `{field: ["msg"]}` for validation, and `{non_field_errors: [...]}`
for cross-field rules. Add network failures and 5xx and every call site is
parsing four cases.

Do it once, in the interceptor:

```js
error.normalized = {
  kind,        // 'network' | 'validation' | 'forbidden' | 'not_found' | 'throttled' | 'server'
  status,
  message,     // safe to show a user
  fields,      // { email: "This field is required." } — feeds form state directly
  retryAfter,  // seconds, from the Retry-After header on a 429
};
```

`fields` maps straight onto form errors, which is what
`forms-and-validation` consumes.

## Handle 429 explicitly

The backend throttles OTP, login, password reset and order creation. A 429 is
not a failure to retry — automatic retry is what the throttle exists to stop.

Surface `retryAfter` and disable the control until it elapses. An app that
retries on 429 turns a rate limit into a self-inflicted outage.

## Cancellation

A search-as-you-type box fires a request per keystroke. Responses arrive out of
order, so an older, slower response can overwrite a newer one — the user sees
results for a prefix of what they typed.

```js
useEffect(() => {
  const controller = new AbortController();
  api.get("/products/", { params: { search: query }, signal: controller.signal })
     .then(({ data }) => setResults(data.results))
     .catch((err) => { if (err.name !== "CanceledError") setError(err); });
  return () => controller.abort();
}, [query]);
```

Always ignore `CanceledError` — an aborted request is not an error, and treating
it as one flashes a toast on every keystroke.

## Uploads

`FormData` needs no `Content-Type`; the browser sets the multipart boundary.
Setting it manually produces a boundary-less header the server cannot parse.

```js
const form = new FormData();
form.append("image", file);
await api.post("/products/1/image/", form);   // do not set Content-Type
```

## Verification

```js
// One refresh for N concurrent 401s.
// DevTools > Network, filter "refresh", let the token expire, load a page
// with several data components.
// PASS: exactly one /auth/token/refresh/ request

// No secrets in the bundle.
// npm run build && grep -ri "secret\|api_key" dist/assets/*.js
// PASS: no output
```

```bash
# Every request goes through the instance.
grep -rn "fetch(\|axios\." src/ --include=*.jsx --include=*.js | grep -v "services/api"
# PASS: no output
```

## Common mistakes

- A second axios instance, or a bare `fetch`, that skips the interceptors.
- No single-flight queue, so concurrent 401s cause a spurious logout.
- Refreshing on the refresh endpoint.
- `window.location.href` on auth failure.
- Parsing DRF error shapes at each call site.
- Auto-retrying a 429.
- No cancellation on search, so stale responses win.
- Setting `Content-Type` manually on `FormData`.
- A secret in a `VITE_` variable.
