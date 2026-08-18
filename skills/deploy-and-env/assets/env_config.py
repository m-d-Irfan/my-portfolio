"""Environment variable reader with fail-fast validation.

Copy to `daf_backend/env_config.py` and import at the top of settings.py:

    from dotenv import load_dotenv
    load_dotenv()
    from .env_config import env, env_bool, env_int, env_list, require_all

Then read every setting through it:

    SECRET_KEY = env('SECRET_KEY')                    # required — raises if unset
    DEBUG      = env_bool('DEBUG', default=False)     # safe default
    ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', default='localhost,127.0.0.1')

Why this file exists (C1): settings.py contained

    STEADFAST_API_KEY = os.environ.get('<the literal key value>')

The secret was pasted in as the variable NAME. No such variable existed, so the
setting was None, the truthiness check in OrderViewSet.track skipped the API
call, and courier dispatch was silently dead in production — no error, no log,
no alert. `env('STEADFAST_API_KEY')` would have crashed the first deploy with a
message naming the key.

Rules this file enforces:
  - A required variable with no value raises at import time, not at use time.
  - Error messages name the KEY, never the value. A message containing the
    secret puts it in the traceback, in stderr.log, and on the DEBUG 500 page.
  - A key that looks like it holds a pasted secret is rejected outright.
"""

import os
import re

from django.core.exceptions import ImproperlyConfigured

_UNSET = object()

# A variable NAME should be SCREAMING_SNAKE_CASE. Anything else is almost
# certainly a pasted value — the C1 shape.
_VALID_KEY = re.compile(r"^[A-Z][A-Z0-9_]*$")

# Shapes that indicate a secret was pasted where a name belongs: long
# lowercase-alphanumeric strings, URLs, anything with a space or a slash.
_LOOKS_LIKE_A_VALUE = (
    re.compile(r"^[a-z0-9]{16,}$"),
    re.compile(r"^https?://"),
    re.compile(r"[\s/@:]"),
)


def _check_key(key):
    """Reject a key that is obviously a value. Raises before any lookup.

    This is the C1 guard. It runs at import time, so a mistake of that shape
    cannot reach production.
    """
    if _VALID_KEY.match(key):
        return
    for pattern in _LOOKS_LIKE_A_VALUE:
        if pattern.search(key):
            raise ImproperlyConfigured(
                f"env() was called with what looks like a VALUE rather than a "
                f"variable name (length {len(key)}, starts {key[:4]!r}). "
                f"Expected SCREAMING_SNAKE_CASE. This is finding C1: the "
                f"Steadfast key was pasted in as the variable name, so the "
                f"setting silently evaluated to None and courier dispatch "
                f"stopped working with no error anywhere."
            )
    raise ImproperlyConfigured(
        f"Environment variable name {key!r} is not SCREAMING_SNAKE_CASE."
    )


def env(key, default=_UNSET, cast=str):
    """Read an environment variable.

    With no `default`, a missing variable raises ImproperlyConfigured at import
    time — which is the point. Pass a default only when the fallback is genuinely
    safe in production; never as a way to avoid setting the value.

    A default is NEVER a place for a secret. `env('DB_PASSWORD', 'hunter2')` is
    a committed credential with extra steps.
    """
    _check_key(key)

    raw = os.environ.get(key, _UNSET)

    if raw is _UNSET or (isinstance(raw, str) and raw.strip() == ""):
        if default is _UNSET:
            raise ImproperlyConfigured(
                f"Required environment variable {key} is not set. "
                f"See .env.example."
            )
        return default

    raw = raw.strip()

    try:
        if cast is bool:
            # Explicit truthy set. `bool('False')` is True, which is how a
            # DEBUG=False in .env ends up running with DEBUG on.
            return raw.lower() in ("true", "1", "yes", "on")
        if cast is int:
            return int(raw)
        if cast is float:
            return float(raw)
        if cast is list:
            return [item.strip() for item in raw.split(",") if item.strip()]
    except (TypeError, ValueError) as exc:
        # Name the key and the expected type. Never echo the value — for
        # DB_PASSWORD or SECRET_KEY that message goes straight into the log.
        raise ImproperlyConfigured(
            f"Environment variable {key} could not be read as "
            f"{cast.__name__}: {exc.__class__.__name__}."
        ) from None

    return raw


def env_bool(key, default=_UNSET):
    """Boolean from the environment.

    DEBUG defaults to False here and everywhere. S4: settings.py had
    `DEBUG = True` hardcoded, which cascaded to SECURE_SSL_REDIRECT,
    SESSION_COOKIE_SECURE and CSRF_COOKIE_SECURE all being off in production,
    because each was defined as `not DEBUG`.
    """
    return env(key, default, cast=bool)


def env_int(key, default=_UNSET):
    return env(key, default, cast=int)


def env_float(key, default=_UNSET):
    return env(key, default, cast=float)


def env_list(key, default=_UNSET):
    """Comma-separated list. Used for ALLOWED_HOSTS, CORS origins, CSRF hosts."""
    return env(key, default, cast=list)


def require_all(*keys):
    """Assert a group of variables is present, reporting ALL that are missing.

    Call once near the end of settings.py for the keys an integration needs, so
    a fresh deploy reports every gap at once instead of one per restart:

        require_all('STEADFAST_API_KEY', 'STEADFAST_SECRET_KEY')
        require_all('BKASH_APP_KEY', 'BKASH_APP_SECRET',
                    'BKASH_USERNAME', 'BKASH_PASSWORD')
    """
    for key in keys:
        _check_key(key)

    missing = [
        key for key in keys
        if not (os.environ.get(key) or "").strip()
    ]
    if missing:
        raise ImproperlyConfigured(
            f"Missing required environment variables: {', '.join(sorted(missing))}. "
            f"See .env.example."
        )


def warn_if_unset(*keys):
    """For a genuinely optional integration: log at boot, do not crash.

    Use this ONLY where the feature degrades cleanly and its absence is
    visible — never for a credential whose absence makes a feature fail
    silently. C1 is exactly the second case: an unset courier key produced no
    error and no dispatch, and nobody noticed for months.
    """
    import logging

    log = logging.getLogger("django.config")
    for key in keys:
        _check_key(key)
        if not (os.environ.get(key) or "").strip():
            log.warning(
                "Optional environment variable %s is not set; the feature "
                "using it is disabled.", key
            )
