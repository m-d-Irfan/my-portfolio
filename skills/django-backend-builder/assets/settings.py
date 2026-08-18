"""Django settings.

Copy to `<project>/settings.py`. Every value that differs between machines comes
from the environment; nothing secret is ever a literal in this file.

Companion files: `.env.example` (the contract) and `settings_security.py` from
the security-hardening skill (the hardening block, imported at the bottom).
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None, required=False):
    """Read an environment variable.

    `required=True` fails at import time rather than at the first request. A
    missing courier API key should stop the deploy, not silently dispatch
    nothing for three weeks — which is exactly what happened when
    `os.environ.get('<the literal api key>')` passed the key's VALUE as the
    variable NAME and returned None forever. (Audit ref: C1.)
    """
    value = os.environ.get(key, default)
    if required and not value:
        raise RuntimeError(f"Required environment variable {key} is not set. See .env.example.")
    return value


def env_bool(key, default=False):
    return str(os.environ.get(key, str(default))).strip().lower() in {"1", "true", "yes", "on"}


def env_list(key, default=""):
    return [item.strip() for item in os.environ.get(key, default).split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
# DEBUG defaults to False. A missing env var in production must not enable
# debug mode. (Audit ref: S4 — DEBUG was hardcoded True, and three security
# settings were written as `not DEBUG`, so all three were off in production.)
DEBUG = env_bool("DEBUG", False)

SECRET_KEY = env("SECRET_KEY", required=not DEBUG) or "dev-only-insecure-key"
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

ROOT_URLCONF = "project_core.urls"
WSGI_APPLICATION = "project_core.wsgi.application"
AUTH_USER_MODEL = "api.CustomUser"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    # Local
    "api",
    "core_domain",
    "transactions",
]

MIDDLEWARE = [
    # CorsMiddleware must precede CommonMiddleware, or a redirect issued by
    # CommonMiddleware goes out without CORS headers and the browser blocks it.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DB_ENGINE = env("DB_ENGINE", "sqlite")

if DB_ENGINE == "mysql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": env("DB_NAME", required=True),
            "USER": env("DB_USER", required=True),
            "PASSWORD": env("DB_PASSWORD", required=True),
            "HOST": env("DB_HOST", "localhost"),
            "PORT": env("DB_PORT", "3306"),
            "OPTIONS": {
                # STRICT_TRANS_TABLES turns silent truncation into an error. Without
                # it MySQL will quietly cut a 300-char title down to fit a 255-char
                # column and report success.
                "sql_mode": "STRICT_TRANS_TABLES",
                "charset": "utf8mb4",
            },
            # Reuse connections for 60s. Default 0 opens a new TCP connection per
            # request, which dominates response time on a remote database.
            "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        }
    }
elif DB_ENGINE == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", required=True),
            "USER": env("DB_USER", required=True),
            "PASSWORD": env("DB_PASSWORD", required=True),
            "HOST": env("DB_HOST", "localhost"),
            "PORT": env("DB_PORT", "5432"),
            "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
# Permissions and throttling are NOT set here — they come from
# settings_security.py at the bottom of this file, so there is exactly one
# place that decides the security posture.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ]
    # The browsable API is a development affordance. In production it renders
    # every endpoint as an HTML form, which is both an information leak and a
    # CSRF surface.
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
}

SIMPLE_JWT = {
    # Short. An access token cannot be revoked, so its lifetime is the window a
    # demoted admin keeps admin claims. See auth-flows/06-session-revocation.md.
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(env("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# Auth backends
# ---------------------------------------------------------------------------
AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = env("ACCOUNT_EMAIL_VERIFICATION", "mandatory")
# Never auto-link a social login to an existing account by unverified email —
# that is account takeover. See auth-flows/08-social-oauth.md.
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_VERIFICATION = "mandatory"

# ---------------------------------------------------------------------------
# i18n / time
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
# Local time, not UTC. With TIME_ZONE = 'UTC' a Bangladeshi "day" splits at
# 06:00 local, so every daily report and day-book is wrong. Storage stays UTC
# because USE_TZ is True; only interpretation changes. (Audit ref: C2.)
TIME_ZONE = env("TIME_ZONE", "Asia/Dhaka")
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
if DEBUG and not env("EMAIL_HOST_USER"):
    # Print to the console instead of failing or, worse, mailing real customers
    # from a developer machine.
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = env("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(env("EMAIL_PORT", "465"))
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", True)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "noreply@example.com")

# ---------------------------------------------------------------------------
# Third-party integrations
# ---------------------------------------------------------------------------
# Key by NAME. Passing the key's value as the variable name is a silent no-op
# that returns None forever. (Audit ref: C1.)
STEADFAST_API_KEY = env("STEADFAST_API_KEY")
STEADFAST_SECRET_KEY = env("STEADFAST_SECRET_KEY")
STEADFAST_BASE_URL = env("STEADFAST_BASE_URL", "https://portal.packzy.com/api/v1")

BKASH_APP_KEY = env("BKASH_APP_KEY")
BKASH_APP_SECRET = env("BKASH_APP_SECRET")
BKASH_USERNAME = env("BKASH_USERNAME")
BKASH_PASSWORD = env("BKASH_PASSWORD")
BKASH_SANDBOX = env_bool("BKASH_SANDBOX", True)

# ---------------------------------------------------------------------------
# Security block — MUST be last.
# ---------------------------------------------------------------------------
# Sets SECURE_*, cookie flags, CORS, password validators, the deny-by-default
# permission class and the throttle rates. Keeping it last means it wins over
# anything above and there is one file to audit.
from .settings_security import *  # noqa: E402,F401,F403
from .settings_security import REST_FRAMEWORK_SECURITY  # noqa: E402

REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
