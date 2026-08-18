# Settings assembly

How `settings.py` is put together, and the order that matters.

Copy [`assets/settings.py`](../assets/settings.py) rather than writing this from
scratch. This file explains the decisions inside it.

## The shape

```python
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = env_bool("DEBUG", False)        # 1. environment first
SECRET_KEY = env("SECRET_KEY", required=not DEBUG)
INSTALLED_APPS = [...]                  # 2. application
DATABASES = {...}                       # 3. infrastructure
REST_FRAMEWORK = {...}                  # 4. framework config
...
from .settings_security import *        # 5. security block — LAST
REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
```

Security is last so it always wins, and so there is exactly one file to audit
when the question is "what is our production posture".

## `env()` fails loudly

```python
def env(key, default=None, required=False):
    value = os.environ.get(key, default)
    if required and not value:
        raise RuntimeError(f"Required environment variable {key} is not set. See .env.example.")
    return value
```

`os.environ.get()` returning `None` is the most expensive silent failure in a
Django project. The real incident (audit ref: C1):

```python
# The key's VALUE was passed as the variable NAME.
STEADFAST_API_KEY = os.environ.get('<the literal api key>')
```

That always returns `None`. Courier dispatch and tracking were dead for weeks
and nothing raised, logged, or alerted — the integration just quietly did
nothing. `required=True` turns that into a failure at import time, which means
the deploy fails instead of the feature.

Rule: **reference variables by name; add every one to `.env.example` in the same
commit.**

## `DEBUG` defaults to `False`

```python
DEBUG = env_bool("DEBUG", False)
```

The audit finding (S4) was `DEBUG = True` hardcoded, with three settings written
as `not DEBUG`:

```python
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
```

All three were off in production. One literal, and every cookie shipped over
plaintext with no redirect to HTTPS.

The `not DEBUG` pattern is fine — it is the default that was wrong. With
`False` as the default, the failure mode inverts: a developer who forgets
`DEBUG=True` in `.env` gets a confusing local environment and fixes it in
thirty seconds. A deployment that forgets `DEBUG=False` gets a secure one.

Only the exact string `True` enables it, so `DEBUG=1`, `DEBUG=true` and
`DEBUG=yes` do not half-enable debug mode. (The `env_bool` helper in the asset
accepts those spellings deliberately — pick one convention and document it in
`.env.example`.)

## Middleware order

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",        # must precede CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]
```

Two orderings are load-bearing:

- **`CorsMiddleware` before `CommonMiddleware`.** `CommonMiddleware` issues
  redirects (`APPEND_SLASH`). A redirect emitted before the CORS headers are
  attached is blocked by the browser, and it presents as an intermittent CORS
  error that only affects some URLs.
- **`SessionMiddleware` before `AuthenticationMiddleware`.** The latter reads
  `request.session`.

## Database

`STRICT_TRANS_TABLES` on MySQL is not optional:

```python
"OPTIONS": {"sql_mode": "STRICT_TRANS_TABLES", "charset": "utf8mb4"},
```

Without it, MySQL truncates a 300-character title into a 255-character column,
coerces an invalid date to `0000-00-00`, and reports success. Data loss with a
200 response.

`utf8mb4`, not `utf8`. MySQL's `utf8` is three bytes and cannot store emoji or
some Bangla conjuncts; inserting one raises or truncates depending on strict
mode.

`CONN_MAX_AGE=60` reuses connections. The default of `0` opens a new TCP
connection per request, which on a remote database is often the single largest
component of response time.

## Timezone

```python
TIME_ZONE = env("TIME_ZONE", "Asia/Dhaka")
USE_TZ = True
```

`TIME_ZONE = "UTC"` with `USE_TZ = True` means a Bangladeshi day splits at 06:00
local. Every daily total, day-book and "orders today" query is wrong by six
hours of traffic. (Audit ref: C2.)

`USE_TZ = True` keeps storage in UTC; only interpretation changes. For anything
that must be pinned to a business day regardless of server config, store an
explicit `business_date` column rather than deriving it — see the `data-layer`
skill.

## The browsable API is a development affordance

```python
"DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
```

In production it renders every endpoint as an interactive HTML form. That is an
information leak (it enumerates fields, validation rules and related querysets)
and a CSRF surface.

## Verification

```bash
python manage.py check --deploy          # must be clean

python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','project_core.settings')
django.setup()
from django.conf import settings as s
assert s.DEBUG is False, 'DEBUG is True'
assert s.TIME_ZONE == 'Asia/Dhaka', s.TIME_ZONE
assert s.SESSION_COOKIE_SECURE, 'session cookie not secure'
assert s.CSRF_COOKIE_SECURE, 'csrf cookie not secure'
assert 'IsAdminUser' in str(s.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'])
print('settings OK')
"
```

```bash
# Every env key the code reads must exist in .env.example.
grep -ohrE 'env\(["'"'"']([A-Z_]+)' --include=*.py . | sed -E 's/.*["'"'"']//' | sort -u \
  > /tmp/used.txt
grep -oE '^[A-Z_]+' .env.example | sort -u > /tmp/documented.txt
comm -23 /tmp/used.txt /tmp/documented.txt
# expect: no output
```

That last check is the automated form of the C1 fix — it catches a variable
being read that nobody documented, which is where typo'd keys hide.
