"""Production security settings for Django.

Usage — at the BOTTOM of `settings.py`, after DEBUG is defined:

    from .settings_security import *              # noqa: F401,F403
    REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)

Import order matters. This module reads DEBUG from the environment itself rather
than importing it, so it is safe to import at any point, but the
REST_FRAMEWORK.update() call must come after REST_FRAMEWORK is defined.

Background — the failure this file exists to prevent:

  S4  `DEBUG = True` was hardcoded in settings.py. Three security settings were
      written as `not DEBUG`, so SECURE_SSL_REDIRECT, SESSION_COOKIE_SECURE and
      CSRF_COOKIE_SECURE were all silently OFF in production. The bug was one
      literal; the blast radius was every cookie and every request.

  N2  No throttling existed anywhere while the project ran 6-digit OTP auth.
      10^6 codes, unlimited attempts, no lockout.

Verify with `python manage.py check --deploy` — it must emit zero warnings.
"""

import os

# ---------------------------------------------------------------------------
# DEBUG
# ---------------------------------------------------------------------------
# Default False. A missing or misspelled env var must never enable debug mode in
# production. Only the exact string 'True' turns it on, so DEBUG=1, DEBUG=true
# and DEBUG=yes all correctly evaluate to False rather than half-enabling it.
DEBUG = os.environ.get("DEBUG", "False") == "True"

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------
# No fallback in production. A default SECRET_KEY means every deploy that forgot
# the env var shares a key an attacker can read from your source, and can forge
# session cookies and password-reset tokens against it.
SECRET_KEY = os.environ.get("SECRET_KEY")
if not DEBUG and not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set. Refusing to start with an insecure default. "
        "Set it in .env — see .env.example."
    )
SECRET_KEY = SECRET_KEY or "dev-only-insecure-key-do-not-deploy"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

# ---------------------------------------------------------------------------
# Transport security
# ---------------------------------------------------------------------------
# Every one of these is gated on `not DEBUG` so local http development keeps
# working. That is the same pattern that failed in S4 — the difference is that
# DEBUG now defaults to False, so the failure mode is "local dev needs
# DEBUG=True in .env", not "production ships with security off".
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# Behind nginx, Apache/cPanel, or any TLS-terminating proxy, Django sees plain
# http and would redirect forever. This header tells it to trust the proxy's
# verdict. Set it ONLY when a proxy you control always overwrites the header —
# if a client can send X-Forwarded-Proto itself, SECURE_SSL_REDIRECT becomes
# bypassable.
if os.environ.get("BEHIND_TLS_PROXY", "False") == "True":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# HSTS: tells browsers to refuse http for this domain entirely.
# Roll this out in stages. Start at 3600 for a day, confirm nothing breaks, then
# raise. `preload` is effectively irreversible for months — do not set it until
# HTTPS is confirmed working on every subdomain.
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0" if DEBUG else "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "False") == "True"

# ---------------------------------------------------------------------------
# Browser-side hardening
# ---------------------------------------------------------------------------
# Stops browsers from second-guessing Content-Type. Without it, a user-uploaded
# file served as text/plain can be sniffed and executed as HTML or JS.
SECURE_CONTENT_TYPE_NOSNIFF = True

# Do not leak the full URL (which may carry a reset token) to third-party sites.
SECURE_REFERRER_POLICY = "same-origin"

# Clickjacking. DENY unless a legitimate embed exists, in which case use CSP's
# frame-ancestors instead of relaxing this.
X_FRAME_OPTIONS = "DENY"

SESSION_COOKIE_HTTPONLY = True
# CSRF cookie must stay readable by JS if the SPA reads it to echo the token
# back in the X-CSRFToken header. Set to True only if you inject the token
# server-side into the document instead.
CSRF_COOKIE_HTTPONLY = False

SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# CORS / CSRF origins
# ---------------------------------------------------------------------------
# Explicit allowlist. CORS_ALLOW_ALL_ORIGINS = True combined with
# CORS_ALLOW_CREDENTIALS = True is never acceptable: it lets any site on the
# internet make credentialed requests against your API on behalf of a logged-in
# visitor. django-cors-headers will refuse the combination, but people work
# around it with a regex — do not.
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# ---------------------------------------------------------------------------
# Upload limits
# ---------------------------------------------------------------------------
# Caps the in-memory portion of a request body. The default 2.5 MB is fine for
# JSON; raise deliberately for image upload endpoints and enforce a real
# per-field limit with the validators in validators.py.
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("DATA_UPLOAD_MAX_MEMORY_SIZE", 5 * 1024 * 1024))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("FILE_UPLOAD_MAX_MEMORY_SIZE", 5 * 1024 * 1024))
# Bounds a parameter-pollution DoS: a form with 100k fields costs CPU to parse.
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000
FILE_UPLOAD_PERMISSIONS = 0o644

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# DRF: default permission + throttling
# ---------------------------------------------------------------------------
# Merge into REST_FRAMEWORK after it is defined:
#     REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
#
# The default is deny. This is deliberate and it is the direct fix for S2: a
# ViewSet that forgets `permission_classes` now returns 403 instead of silently
# granting write access to every logged-in shopper. A noisy 403 in development
# is the cheapest possible bug report.
#
# Public endpoints opt IN with an explicit `permission_classes = [IsAdminOrReadOnly]`
# or `[AllowAny]`. Explicit AllowAny is fine — it is a decision on the record.
REST_FRAMEWORK_SECURITY = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAdminUser",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/hour",
        "user": "1000/hour",
        # Scoped throttles — attach with ScopedRateThrottle + throttle_scope.
        "otp_issue": "5/hour",
        "otp_verify": "10/hour",
        "login": "10/hour",
        "password_reset": "3/hour",
        "order_create": "30/hour",
        "contact": "5/hour",
    },
}

# Throttling stores counters in the cache. LocMemCache is per-process, so behind
# gunicorn with 4 workers an attacker gets 4x the configured rate and a restart
# clears every counter. Use Redis or Memcached in production.
if not DEBUG and os.environ.get("REDIS_URL"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.environ["REDIS_URL"],
        }
    }

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
# Never log request bodies wholesale — they carry passwords, OTP codes and
# tokens. Django's own logger already filters settings; your handlers must not
# reintroduce the leak.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {process:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "loggers": {
        "django.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
        # Fires on SuspiciousOperation, host-header attacks, bad signatures.
        "django.security.DisallowedHost": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "security.audit": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
}
