# Settings hardening

This file owns every security-relevant line in `settings.py`, what each one prevents, and the `check --deploy` gate that proves they are set.

## The finding

**S4**: `DEBUG = True` was hardcoded at line 11 of a git-tracked `settings.py`. Two hundred and twenty-eight lines later, at the bottom of the file, sat this:

```python
# Production security settings
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
```

All three were `False` in production. Every session cookie and every CSRF cookie was transmitted over plain HTTP, and no HTTP request was ever upgraded.

The `not DEBUG` idiom is the trap, and it is worth dwelling on because it looks *more* security-conscious than a hardcoded value. Three defects compound:

1. **It couples three unrelated controls to one unrelated flag.** Whether you want tracebacks in the browser has nothing to do with whether cookies should be `Secure`.
2. **It fails silently and invisibly.** There is no error, no log line, no visual difference. The site works perfectly. You discover it when someone reads the cookie off a café network.
3. **The comment lies.** A block labelled `# Production security settings` that evaluates to "everything off" is worse than no block at all, because it satisfies the reviewer looking for one.

The fix is not "remember to flip DEBUG". The fix is that `DEBUG` **defaults to False and must be explicitly opted into**, so the failure mode becomes "local dev needs `DEBUG=True` in `.env`" instead of "production ships with security off". A developer notices a broken local environment within seconds. Nobody notices an insecure cookie.

## Line by line

### DEBUG

WRONG — the current state:

```python
DEBUG = True
```

Also WRONG, and a real bug people write while fixing the first one:

```python
DEBUG = bool(os.environ.get('DEBUG', 'False'))
```

`bool('False')` is `True`. Every non-empty string is truthy, so this is `DEBUG = True` with extra steps. Same for `bool(os.environ.get('DEBUG'))` when the var is set to `0` or `false`.

RIGHT:

```python
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
```

Exact string match against `'True'`, defaulting to `'False'`. A missing variable, a typo, `DEBUG=1`, `DEBUG=yes` — all evaluate to `False`. Failing closed on a typo is the entire point.

What `DEBUG = True` costs you in production, concretely:

- The 500 page renders a full traceback with local variables — including the `Order` instance, the customer's phone number and address, and any bound secret.
- It renders the **entire settings dict**. With the S3 secrets still in `settings.py`, one uncaught exception publishes the MySQL password and the Gmail app password to whoever triggered it. `DEBUG = True` is not merely an information leak; it is a secrets leak. See `04-secrets.md`.
- `ALLOWED_HOSTS` validation is skipped when `DEBUG` is on, so Host-header attacks that would otherwise be rejected go through.
- Django retains every SQL query executed in `django.db.connection.queries`, which is an unbounded memory leak in a long-running process.

### SECRET_KEY

WRONG:

```python
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-fallback-key')
```

A default means every deploy that forgot the env var runs on a key an attacker can read from your public source.

RIGHT — fail fast:

```python
SECRET_KEY = os.environ.get('SECRET_KEY')
if not DEBUG and not SECRET_KEY:
    raise RuntimeError(
        'SECRET_KEY is not set. Refusing to start with an insecure default. '
        'Set it in .env — see .env.example.'
    )
SECRET_KEY = SECRET_KEY or 'dev-only-insecure-key-do-not-deploy'
```

A leaked `SECRET_KEY` is not "one compromised setting". It is the signing key for session cookies, password-reset tokens, `signing.dumps()` payloads, and messages framework data. An attacker with it forges a session cookie for `user_id=1` and is your superuser — no password required. It is also the JWT signing key by default under SimpleJWT, so they mint an access token for any user directly.

Rotating it logs everyone out. Django 4.1+ supports a graceful roll:

```python
SECRET_KEY = env('SECRET_KEY')
SECRET_KEY_FALLBACKS = [k for k in os.environ.get('SECRET_KEY_FALLBACKS', '').split(',') if k]
```

Deploy with the old key in fallbacks, wait out your longest token lifetime (7 days here, the `REFRESH_TOKEN_LIFETIME`), then remove it.

### ALLOWED_HOSTS

WRONG — the current value, which contains a real bug:

```python
ALLOWED_HOSTS = [
    'delhialuminium.netlify.app',
    'daf-frontend-ruby.vercel.app/',      # trailing slash — never matches anything
    'api.delhialuminium.com',
    'delhialuminium.com'
]
```

`ALLOWED_HOSTS` entries are hostnames, not URLs. A `Host` header never contains a slash, so `'daf-frontend-ruby.vercel.app/'` can never match and that origin silently 400s. This is the kind of entry that gets "fixed" under deadline pressure by appending `'*'`, which is how the control dies.

RIGHT:

```python
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]
```

```bash
# .env
ALLOWED_HOSTS=api.delhialuminium.com,delhialuminium.com,www.delhialuminium.com
```

The attack it prevents: Django builds absolute URLs from the `Host` header. Send `Host: evil.example` to the password-reset endpoint and the reset link mailed to the victim points at `https://evil.example/reset/<token>/`. The victim clicks, and the attacker's server receives a valid single-use reset token. `ALLOWED_HOSTS` is what makes that request a 400 instead of an email. Never use `['*']`.

### SECURE_SSL_REDIRECT / SESSION_COOKIE_SECURE / CSRF_COOKIE_SECURE

These three are S4 itself.

```python
SECURE_SSL_REDIRECT = not DEBUG      # 301 any http request to https
SESSION_COOKIE_SECURE = not DEBUG    # browser refuses to send the cookie over http
CSRF_COOKIE_SECURE = not DEBUG       # same for the CSRF cookie
```

The expression is unchanged from the broken version. The difference is that `DEBUG` now defaults to `False`, so these default to `True`. That is the whole fix — and it is why `DEBUG`'s default is load-bearing rather than cosmetic.

Without `SESSION_COOKIE_SECURE`, a single plain-HTTP request — a bookmark, a typed URL, an `http://` image in an email — sends the session cookie in cleartext. Anyone on the same network captures it. `SECURE_SSL_REDIRECT` does not save you, because the redirect happens *after* the browser has already transmitted the cookie.

### SECURE_PROXY_SSL_HEADER

Required here. This project runs behind cPanel/Passenger with TLS terminated upstream, so Django sees plain HTTP on every request. With `SECURE_SSL_REDIRECT = True` and no proxy header configured, Django redirects to HTTPS, the proxy forwards the new request as HTTP again, and you get an infinite redirect loop — a hard outage.

```python
if os.environ.get('BEHIND_TLS_PROXY', 'False') == 'True':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

The caveat is not optional: **this is only safe when the proxy always sets or overwrites `X-Forwarded-Proto`.** If the proxy passes a client-supplied header through, any attacker sends `X-Forwarded-Proto: https` on a plain HTTP request and Django believes it is secure — `SECURE_SSL_REDIRECT` stops redirecting and `request.is_secure()` lies. Confirm the nginx config contains `proxy_set_header X-Forwarded-Proto $scheme;` (which overwrites) before enabling this. Gating it behind an env var means a misconfigured environment fails toward the redirect loop, which is loud, rather than toward silent plaintext.

### SECURE_HSTS_SECONDS, INCLUDE_SUBDOMAINS, PRELOAD

```python
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '0' if DEBUG else '31536000'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'False') == 'True'
```

HSTS tells the browser to refuse plain HTTP for this domain for `max-age` seconds, closing the gap `SECURE_SSL_REDIRECT` leaves open: the very first request, before any redirect, and any SSL-stripping attack on it.

**HSTS is a ratchet and it is not revocable.** Once a browser has cached `max-age=31536000`, that browser will not touch `http://delhialuminium.com` for a year, and you cannot call it back. If your certificate lapses or a subdomain has no TLS, those users see a hard error page with no click-through. Roll it out in stages, confirming at each step:

| Stage | Value | Wait | Confirm before proceeding |
| --- | --- | --- | --- |
| 1 | `60` | 1 day | Site loads over HTTPS, no mixed-content warnings |
| 2 | `3600` | 1 week | Certificate auto-renewal has run at least once |
| 3 | `31536000` | — | Every subdomain serves valid TLS |
| 4 | `+ preload` | — | Only after stage 3 is stable for a month |

`INCLUDE_SUBDOMAINS` covers `api.delhialuminium.com` and `www.` — and anything else under the apex, including a legacy `cpanel.` or `webmail.` host that may not have TLS. Check them all first.

`preload` submits the domain to a list baked into browser binaries. Removal takes months and ships with a browser release. Do not set it until everything else is proven.

### SECURE_CONTENT_TYPE_NOSNIFF

```python
SECURE_CONTENT_TYPE_NOSNIFF = True
```

Sends `X-Content-Type-Options: nosniff`, which stops browsers from ignoring your `Content-Type` and guessing from the bytes. Directly relevant here because this project serves user-uploaded files from `/media/`: without it, an uploaded file served as `text/plain` can be sniffed as HTML and executed in your origin, which is stored XSS. And because the JWT lives in `localStorage` (`JWT_AUTH_HTTPONLY: False`), same-origin XSS is full account takeover. See `05-uploads.md`.

### SECURE_REFERRER_POLICY

```python
SECURE_REFERRER_POLICY = 'same-origin'
```

Without it, clicking any external link from a page whose URL carries a token leaks that URL in the `Referer` header. Password-reset and email-verification links are exactly that shape. `same-origin` sends the referrer within your own site and nothing outward.

### X_FRAME_OPTIONS

```python
X_FRAME_OPTIONS = 'DENY'
```

Django's default is `SAMEORIGIN`; `DENY` is correct here because nothing in this project needs to be framed. Prevents clickjacking — an attacker iframes your admin panel invisibly over a decoy page and harvests clicks on real buttons. If a legitimate embed appears later, use CSP `frame-ancestors` rather than relaxing this, since CSP allows a specific origin instead of all same-origin pages.

### CSRF_TRUSTED_ORIGINS

```python
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)
```

Since Django 4.0 these **must include the scheme**. `'delhialuminium.com'` raises at startup; `'https://delhialuminium.com'` is correct. The current values already carry schemes, which is right. Keeping it derived from `CORS_ALLOWED_ORIGINS` means the two lists cannot drift apart — a class of bug where CORS permits an origin that CSRF then rejects, producing failures that only appear for one deployment target.

### CORS_ALLOWED_ORIGINS

The current config is correct in shape:

```python
CORS_ALLOWED_ORIGINS = [...]
CORS_ALLOW_CREDENTIALS = True
```

NEVER acceptable:

```python
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
```

This combination deserves a precise explanation, because the usual one-liner ("it's insecure") gets overridden by someone debugging a CORS error at midnight.

The browser rule is that `Access-Control-Allow-Origin: *` is **forbidden** with `Access-Control-Allow-Credentials: true`. So django-cors-headers cannot send `*`. Instead it **reflects the requesting `Origin` header back**. The result is not a wildcard — it is worse. Every origin on the internet receives a tailored `Access-Control-Allow-Origin` naming itself, plus `Allow-Credentials: true`. Any page the victim visits can then issue credentialed requests to `api.delhialuminium.com` and *read the responses*: order history, addresses, phone numbers, and any admin endpoint the victim can reach.

Note the scope carefully. This project sends the JWT in an `Authorization` header from JS, not as a cookie, so a cross-origin request from `evil.example` does not automatically carry the token — that limits the damage. But `CORS_ALLOW_CREDENTIALS = True` plus session auth on `/admin/` means a logged-in staff member visiting a malicious page hands over Django admin. And regex workarounds are the same bug wearing a hat:

```python
CORS_ALLOWED_ORIGIN_REGEXES = [r'^https://.*\.delhialuminium\.com$']   # fine, anchored
CORS_ALLOWED_ORIGIN_REGEXES = [r'delhialuminium\.com']                 # WRONG: matches
                                                                       # https://delhialuminium.com.evil.example
```

Anchor with `^` and `$`, always. An unanchored pattern matching a substring is the single most common CORS bypass.

### Upload limits

```python
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024    # 5 MB request body held in memory
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024    # above this, spill to a temp file
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000
FILE_UPLOAD_PERMISSIONS = 0o644
```

None of these exist in the current `settings.py`, so Django's defaults apply (2.5 MB / 2.5 MB / 1000). The defaults are not terrible, but they are unstated, and `ProductViewSet` uses `MultiPartParser` for image upload — you want these set deliberately alongside the per-field validators.

`DATA_UPLOAD_MAX_NUMBER_FIELDS` bounds a parameter-pollution DoS: a form POST with 500,000 fields costs real CPU to parse into a `QueryDict` before any of your code runs.

Important limitation: these are **application-level** checks that run after Django has already received the body. They protect memory and CPU, not bandwidth or disk. Pair them with `client_max_body_size 6M;` in nginx, which rejects at the edge. Details in `05-uploads.md`.

## The JWT tradeoff, stated honestly

```python
REST_AUTH = {
    'LOGIN_SERIALIZER': 'api.serializers.CustomLoginSerializer',
    'USE_JWT': True,
    'JWT_AUTH_HTTPONLY': False,
}
```

`JWT_AUTH_HTTPONLY: False` means the token is readable by JavaScript and the React app keeps it in `localStorage`. The consequence: any XSS on your origin is a complete account takeover, because the attacker's script reads the token directly. An `HttpOnly` cookie would not be readable by script — though it would then need CSRF protection, which the header-based scheme avoids.

The mitigating design is already in place and is worth keeping:

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

A 15-minute access token bounds the value of a stolen one, and rotation with blacklisting means a stolen refresh token is detectable — when both the attacker and the real user present the same rotated token, one of them gets a blacklist hit. That signal is only useful if you log it; see the audit-log requirement (**N9**) in `07-threat-model.md`.

Given `localStorage` storage, `SECURE_CONTENT_TYPE_NOSNIFF`, the upload rules in `05-uploads.md` and serving media off a separate origin stop being hygiene and become the controls that protect the token.

## Where the hardening block goes

`assets/settings_security.py` holds all of the above. Import it at the **bottom** of `settings.py`:

```python
# ... everything else in settings.py ...

from .settings_security import *          # noqa: F401,F403

REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
```

Two rules about placement, both of which have concrete failure modes:

**Bottom, not top.** A star-import at the top is overridden by any later assignment in the file. That is exactly how S4 survived review — a hardening block existed, and a line elsewhere neutralised it. At the bottom, the security settings win by construction, and a conflicting earlier line is dead code rather than a live override.

**Star-import only picks up UPPERCASE module-level names.** `from module import *` without an `__all__` skips anything starting with an underscore, and Django only reads uppercase settings anyway. A helper named `env` in `settings_security.py` will not arrive in `settings.py` — import it explicitly if you need it.

The `REST_FRAMEWORK.update(...)` call must come after `REST_FRAMEWORK` is defined, since the fragment merges throttle configuration into the existing dict rather than replacing it.

## check --deploy

```bash
python manage.py check --deploy --settings=daf_backend.settings
```

Run it with production environment variables loaded, not your dev `.env`. Checking a `DEBUG=True` environment tells you nothing about production — it tells you your laptop is a laptop.

**The gate is zero warnings.** Not "zero warnings we care about". Every silenced warning needs a written reason in `SILENCED_SYSTEM_CHECKS`, which makes the exception visible in code review rather than living in someone's memory.

| ID | Message | What it means | Fix |
| --- | --- | --- | --- |
| W004 | `SECURE_HSTS_SECONDS` not set | Browsers will still attempt plain HTTP; SSL-stripping remains possible on the first request | Stage up to `31536000` per the table above |
| W005 | `SECURE_HSTS_INCLUDE_SUBDOMAINS` not set | `api.` and `www.` are unprotected | `SECURE_HSTS_INCLUDE_SUBDOMAINS = True` after verifying TLS on every subdomain |
| W006 | `SECURE_CONTENT_TYPE_NOSNIFF` not True | Uploaded files can be sniffed and executed as HTML | `SECURE_CONTENT_TYPE_NOSNIFF = True` |
| W008 | `SECURE_SSL_REDIRECT` not True | Plain HTTP requests are served, not upgraded | `SECURE_SSL_REDIRECT = True` + `SECURE_PROXY_SSL_HEADER` behind the proxy |
| W009 | `SECRET_KEY` has less than 50 chars, less than 5 unique chars, or a known prefix | Key is guessable or is the `django-insecure-` default | Generate 50+ random chars, put it in `.env`, rotate if it was ever committed (**S3**) |
| W012 | `SESSION_COOKIE_SECURE` not True | Session cookie sent over plain HTTP | `SESSION_COOKIE_SECURE = True` (**S4**) |
| W016 | `CSRF_COOKIE_SECURE` not True | CSRF cookie sent over plain HTTP | `CSRF_COOKIE_SECURE = True` (**S4**) |
| W018 | `DEBUG` is True in deployment | Tracebacks, settings dict and SQL log exposed to any visitor who triggers a 500 | `DEBUG` from env, defaulting False (**S4**) |
| W019 | `X_FRAME_OPTIONS` not `'DENY'` | Clickjacking against the admin panel | `X_FRAME_OPTIONS = 'DENY'` |
| W020 | `ALLOWED_HOSTS` is empty | Django refuses all requests with `DEBUG=False`; with `DEBUG=True` it accepts any Host | Set from env, no `'*'` |
| W021 | `SECURE_HSTS_PRELOAD` not True | Domain is not in the browser preload list | Only after HSTS stage 3 has been stable for a month |
| W022 | `SECURE_REFERRER_POLICY` not set | Full URLs, including tokens, leak to third-party sites | `SECURE_REFERRER_POLICY = 'same-origin'` |

W004, W005 and W021 are the three that tempt people to silence them. W021 in particular is legitimate to defer — preload is a one-way door — but defer it explicitly:

```python
SILENCED_SYSTEM_CHECKS = [
    # HSTS preload is irreversible for months. Deferred until the staged
    # rollout in references/03-settings-hardening.md reaches stage 4.
    # Owner: infra. Review: 2026-10-01.
    'security.W021',
]
```

A silence with an owner and a review date is a decision. A silence without one is a bug with a comment.

## CI gate

```bash
#!/usr/bin/env bash
# scripts/check-deploy.sh — fails the build on any deployment warning.
set -euo pipefail

export DEBUG=False
export SECRET_KEY="${SECRET_KEY:?SECRET_KEY must be set in CI}"
export ALLOWED_HOSTS="api.delhialuminium.com,delhialuminium.com"
export BEHIND_TLS_PROXY=True

python manage.py check --deploy --fail-level WARNING
```

`--fail-level WARNING` is what turns the check from advisory into a gate; without it the command exits 0 and prints warnings nobody reads. As a GitHub Actions step:

```yaml
- name: Django deployment checks
  env:
    SECRET_KEY: ${{ secrets.DJANGO_SECRET_KEY }}
  run: ./scripts/check-deploy.sh
```

Note that `check --deploy` verifies settings, not behaviour. It cannot tell you that `CategoryViewSet` has no `permission_classes` (**S2**) or that `total_amount` comes from the request body (**S5**). Passing it is necessary, not sufficient — the rest of the gate is `../checklists/pre-deploy-security.md`.

## The complete block

```python
"""Production settings. Import at the BOTTOM of settings.py:

    from .settings_security import *          # noqa: F401,F403
    REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
"""

import os

from django.core.exceptions import ImproperlyConfigured

_UNSET = object()


def env(key, default=_UNSET, cast=str):
    """Read an environment variable, raising rather than guessing.

    A missing required setting must stop the process at boot, not surface as a
    None three weeks later inside a payment call. This is the direct lesson of
    `STEADFAST_API_KEY = os.environ.get('<the literal api key>')` — the secret
    itself was pasted in as the variable *name*, so the setting
    silently evaluated to None and the courier integration failed open with no
    error anywhere. A fail-fast reader turns that into a startup crash.
    """
    value = os.environ.get(key, _UNSET)
    if value is _UNSET:
        if default is _UNSET:
            raise ImproperlyConfigured(f'Required environment variable {key} is not set.')
        return default
    if cast is bool:
        return value == 'True'
    if cast is int:
        return int(value)
    if cast is list:
        return [item.strip() for item in value.split(',') if item.strip()]
    return value


DEBUG = env('DEBUG', 'False', cast=bool)

SECRET_KEY = os.environ.get('SECRET_KEY')
if not DEBUG and not SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY is not set. Refusing to start.')
SECRET_KEY = SECRET_KEY or 'dev-only-insecure-key-do-not-deploy'

ALLOWED_HOSTS = env('ALLOWED_HOSTS', 'localhost,127.0.0.1', cast=list)

# Transport
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

if env('BEHIND_TLS_PROXY', 'False', cast=bool):
    # Safe only because nginx sets `proxy_set_header X-Forwarded-Proto $scheme;`
    # which OVERWRITES any client-supplied value.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_HSTS_SECONDS = env('SECURE_HSTS_SECONDS', '0' if DEBUG else '31536000', cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = env('SECURE_HSTS_PRELOAD', 'False', cast=bool)

# Browser hardening
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False          # the SPA reads it to echo X-CSRFToken
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# Origins
CORS_ALLOWED_ORIGINS = env('CORS_ORIGINS', 'http://localhost:5173', cast=list)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# Uploads
DATA_UPLOAD_MAX_MEMORY_SIZE = env('DATA_UPLOAD_MAX_MEMORY_SIZE', 5 * 1024 * 1024, cast=int)
FILE_UPLOAD_MAX_MEMORY_SIZE = env('FILE_UPLOAD_MAX_MEMORY_SIZE', 5 * 1024 * 1024, cast=int)
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000
FILE_UPLOAD_PERMISSIONS = 0o644

# Database — never a literal. See references/04-secrets.md (S3).
DATABASES = {
    'default': {
        'ENGINE': env('DB_ENGINE', 'django.db.backends.mysql'),
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', 'localhost'),
        'PORT': env('DB_PORT', '3306'),
        'CONN_MAX_AGE': env('DB_CONN_MAX_AGE', 60, cast=int),
    }
}

# Email — never a literal.
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = env('EMAIL_PORT', 465, cast=int)
EMAIL_USE_SSL = env('EMAIL_USE_SSL', 'True', cast=bool)
EMAIL_USE_TLS = False
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# Integrations
STEADFAST_API_KEY = env('STEADFAST_API_KEY', '')
STEADFAST_SECRET_KEY = env('STEADFAST_SECRET_KEY', '')
FRONTEND_URL = env('FRONTEND_URL', 'https://www.delhialuminium.com')
BACKEND_URL = env('BACKEND_URL', 'https://api.delhialuminium.com')

# Locale — Bangladesh. Invoice timestamps and order cut-offs depend on this.
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dhaka'
USE_I18N = True
USE_TZ = True
```

Note `EMAIL_USE_SSL` and `EMAIL_USE_TLS` are mutually exclusive — setting both raises at send time. Port 465 is implicit TLS (`USE_SSL`), port 587 is STARTTLS (`USE_TLS`). The current config is correct for 465; do not "fix" it by enabling both.

`TIME_ZONE = 'Asia/Dhaka'` with `USE_TZ = True` means the database stores UTC and Django converts on the way out. Invoice PDFs and order `created_at` display in Dhaka time, which is what a Bangladeshi customer expects to see next to a ৳ total. Changing `TIME_ZONE` does not migrate stored data — it only changes rendering.

## Checklist

- [ ] `DEBUG` is read from the environment and defaults to `False`.
- [ ] `SECRET_KEY` raises at boot when unset in production.
- [ ] `ALLOWED_HOSTS` has no `'*'`, no empty strings, and no entries containing `/` or a scheme.
- [ ] All three of `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` are `True` in production.
- [ ] `SECURE_PROXY_SSL_HEADER` is set **and** nginx overwrites `X-Forwarded-Proto`.
- [ ] `SECURE_HSTS_SECONDS` is at its planned stage; `preload` is off until stage 4.
- [ ] `CORS_ALLOW_ALL_ORIGINS` appears nowhere; any origin regex is anchored with `^` and `$`.
- [ ] `CSRF_TRUSTED_ORIGINS` entries all include a scheme.
- [ ] Upload size limits are set in Django **and** in nginx.
- [ ] `from .settings_security import *` is the last import in `settings.py`, followed by `REST_FRAMEWORK.update(...)`.
- [ ] `python manage.py check --deploy --fail-level WARNING` exits 0 against production env vars.
- [ ] No credential literal appears anywhere in `settings.py` (**S3**, `04-secrets.md`).
