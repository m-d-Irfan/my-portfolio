# Env contract

Which variables exist, that they are present and well-formed at boot, and how
they are documented.

## The contract

Three files, and they must agree:

| File | Tracked | Role |
|---|---|---|
| `env_config.py` | Yes | The reader. Raises at boot on anything missing or malformed |
| `.env.example` | Yes | The list of every key, with blank or fake values |
| `.env` | **No** | The real values, on each machine |

If a key is read by the code and absent from `.env.example`, nobody will set it
on the next server and nobody will rotate it after a leak. That file is
simultaneously the onboarding doc and the rotation checklist.

```bash
# The keys the code reads, vs the keys documented.
diff <(grep -rhoE "env(_bool|_int|_list|_float)?\(['\"][A-Z_]+" --include=*.py . \
        | grep -oE "[A-Z_]{2,}" | sort -u) \
     <(grep -oE "^[A-Z_]+" .env.example | sort -u)
# PASS: no output
```

Run it in CI. It is three lines and it closes the whole class.

## Fail fast, and name the key

```python
# WRONG — silently None, fails open, no error anywhere
STEADFAST_API_KEY = os.environ.get('STEADFAST_API_KEY')

# WRONG — a default IS a committed secret
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'actual-password-here')

# WRONG — bool('False') is True, so DEBUG=False in .env runs with DEBUG on
DEBUG = bool(os.environ.get('DEBUG'))

# RIGHT
STEADFAST_API_KEY = env('STEADFAST_API_KEY')
DB_PASSWORD       = env('DB_PASSWORD')
DEBUG             = env_bool('DEBUG', default=False)
```

The third one is worth staring at. `bool()` of any non-empty string is `True`,
so `DEBUG=False` in `.env` produces `DEBUG = True` in Django. That is **S4**
arriving through a different door, and it takes the three `SECURE_*` settings
defined as `not DEBUG` with it.

**Error messages name the key, never the value.** A message containing the
value writes it to the log, into `stderr.log`, and — with `DEBUG=True` — onto
the 500 page of whoever triggered it. `env_config.py` never interpolates a
value into an exception.

## C1: the value pasted as the name

```python
STEADFAST_API_KEY = os.environ.get('<the literal 32-char key>')
FRONTEND_URL      = os.environ.get('https://www.delhialuminium.com/')
```

Two failures in one line, and both are silent:

1. The secret is a string literal in tracked source. Wrapping it in
   `os.environ.get()` hid nothing.
2. No variable by that name exists, so the setting is `None`. The truthiness
   check in `OrderViewSet.track` then skips the courier call. Dispatch and
   tracking were dead in production, with no error and no log line.

`env_config.py` rejects this at import time: a key that is not
SCREAMING_SNAKE_CASE, or that looks like a URL or a long lowercase-alphanumeric
string, raises immediately with C1 named in the message.

```bash
# Find the shape anywhere in the codebase.
grep -rnE "environ\.get\(['\"][^A-Z'\"]" --include=*.py .
# PASS: no output
```

Rotation of the leaked keys is `security-hardening/04-secrets.md`. This file
only stops it recurring.

## Naming

- **SCREAMING_SNAKE_CASE.**
- **Prefixed by integration**: `STEADFAST_API_KEY`, `BKASH_APP_SECRET`,
  `CLOUDINARY_API_SECRET`. A bare `API_KEY` is unrotatable — nobody can tell
  whose it is.
- **`_URL` ends with no trailing slash**, and every consumer joins with a
  leading slash. Pick one convention; mismatches produce `//api//orders/`.
- **`_SECONDS` / `_DAYS` on any duration**, so the unit is not guessed.
- **No `VITE_` prefix on anything secret** — see below.

## Casting

`.env` values are always strings. Cast explicitly:

```python
DEBUG           = env_bool('DEBUG', default=False)
ALLOWED_HOSTS   = env_list('ALLOWED_HOSTS', default='localhost,127.0.0.1')
DB_PORT         = env_int('DB_PORT', default=3306)
OTP_TTL_SECONDS = env_int('OTP_TTL_SECONDS', default=300)
```

`env_bool` accepts `true/1/yes/on` case-insensitively and treats everything else
as false. `env_list` splits on commas and strips whitespace, so
`ALLOWED_HOSTS=a.com, b.com` works.

## Grouped requirements

An integration needs all of its keys or none. Assert the group so a fresh
deploy reports every gap at once:

```python
require_all('DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST')
require_all('EMAIL_HOST_USER', 'EMAIL_HOST_PASSWORD', 'DEFAULT_FROM_EMAIL')
require_all('STEADFAST_API_KEY', 'STEADFAST_SECRET_KEY')
require_all('BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD')
```

Half-configured is worse than unconfigured: a bKash app key with no secret
produces a runtime failure inside a payment, at the least recoverable moment.

For a genuinely optional integration whose absence is *visible*, `warn_if_unset`
logs at boot instead of crashing. Not for anything that fails open silently —
that is the C1 shape again.

## Generating .env.example

```bash
grep -rhoE "env(_bool|_int|_list|_float)?\(['\"][A-Z_]+['\"]" --include=*.py . \
  | grep -oE "[A-Z_]{2,}" | sort -u \
  | while read -r key; do echo "$key="; done > .env.example.generated
```

Then edit: group by concern, add a comment per group, and put a fake-but-shaped
value where the shape matters (`BKASH_BASE_URL` pointed at **sandbox**, so a
copy-paste does not hit live payments on someone's first day).

The full annotated example lives in
[`assets/.env.example`](../assets/.env.example) — every key this project uses,
with the notes that matter for each.

## The frontend .env is public

Vite inlines every `VITE_`-prefixed variable into the bundle at build time. It
is not configuration; it is published source.

```bash
npm run build
grep -rn "VITE_" dist/assets/*.js | head
```

Only the API base URL and similar public values belong there. bKash app secret,
Cloudinary API secret, and anything else that can be replayed are server-side
only. Do not treat the `VITE_` prefix as a security boundary — it is one typo
from being one. Keep secrets out of the frontend `.env` entirely.

## Local vs production differences

Keep the *shape* identical and vary only values. Where a real structural
difference is needed, one file with a visible branch:

```python
if DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    CACHES = {'default': {'BACKEND': '...locmem.LocMemCache'}}
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    CACHES = {'default': {'BACKEND': '...redis.RedisCache',
                          'LOCATION': env('REDIS_URL')}}
```

Both branches visible together. Separate `settings_prod.py` / `settings_dev.py`
files drift — a security setting added to one and not the other is invisible
until it matters.

`LocMemCache` in production breaks throttling: it is per-process, so four
gunicorn workers give an attacker four times the rate limit and a restart resets
every counter (`security-hardening/02-throttling.md`, N2).

Differences worth stating explicitly in a comment because they cause real
"works locally" bugs: SQLite vs MySQL (case sensitivity, max index length,
transaction semantics), the console email backend, `DEBUG` serving static files
for you, and `Asia/Dhaka` vs whatever the server defaults to
(`data-layer/05`, C2).

## Verification

```bash
# 1. Documented keys match read keys.
diff <(grep -rhoE "env(_bool|_int|_list|_float)?\(['\"][A-Z_]+" --include=*.py . \
        | grep -oE "[A-Z_]{2,}" | sort -u) \
     <(grep -oE "^[A-Z_]+" .env.example | sort -u)
# PASS: no output

# 2. Boot fails loudly when a required var is missing.
env -u SECRET_KEY python manage.py check
# PASS: ImproperlyConfigured naming SECRET_KEY

# 3. No value-as-name.
grep -rnE "environ\.get\(['\"][^A-Z'\"]" --include=*.py .
# PASS: no output

# 4. No raw os.environ outside env_config.py.
grep -rn "os.environ" --include=*.py . | grep -v env_config.py
# PASS: no output

# 5. No secret-shaped default.
grep -rnE "env\(['\"][A-Z_]+['\"],\s*['\"][^'\"]{8,}" --include=*.py .
# REVIEW: each hit must be a genuinely public default

# 6. .env is not tracked.
git ls-files | grep -E "^\.env$|/\.env$"
# PASS: no output

# 7. DEBUG is False.
python manage.py shell -c "from django.conf import settings; print(settings.DEBUG)"
# PASS: False
```

Check 4 is the one that keeps the rest true: once every read goes through
`env()`, checks 1–3 cover the whole codebase automatically.
