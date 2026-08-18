"""Security regression suite.

Copy to `tests/test_security_regressions.py`.

One test per finding in `problems and solutions.md`. Each test name carries its
audit id, so a CI failure names the finding directly.

These tests are the mechanism that stops a fixed bug from silently returning.
A finding written in a document enforces nothing; a finding written here fails
the build.

Run: pytest tests/test_security_regressions.py -v
"""

import json
import time
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import get_resolver
from rest_framework.test import APIClient

User = get_user_model()

WRITE_METHODS = ["post", "put", "patch", "delete"]

# Every endpoint that must never accept an anonymous or non-staff write.
STAFF_ONLY_WRITE = [
    "/api/products/",
    "/api/categories/",
    "/api/brands/",
    "/api/attributes/",
    "/api/colors/",
]


# ---------------------------------------------------------------------------
# S1 — anonymous writes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("path", STAFF_ONLY_WRITE)
@pytest.mark.parametrize("method", WRITE_METHODS)
def test_s1_anonymous_cannot_write(client, path, method):
    """S1: catalogue endpoints accepted writes with no credentials at all.

    401 (no credentials) is the correct answer here, never 200/201/204.
    """
    response = getattr(client, method)(
        path, data=json.dumps({"title": "x"}), content_type="application/json"
    )
    assert response.status_code in (401, 403, 405), (
        f"S1 REGRESSION: anonymous {method.upper()} {path} returned "
        f"{response.status_code}. Anonymous writes are reachable again."
    )


# ---------------------------------------------------------------------------
# S2 — authenticated non-staff writes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("path", STAFF_ONLY_WRITE)
@pytest.mark.parametrize("method", WRITE_METHODS)
def test_s2_customer_cannot_write(customer_client, path, method):
    """S2: any logged-in customer could create and edit catalogue objects.

    403 here, not 401 — the request is authenticated, it is just not permitted.
    Returning 401 makes the frontend attempt a token refresh on a permission
    denial, which loops.
    """
    response = getattr(customer_client, method)(path, {"title": "x"}, format="json")
    assert response.status_code in (403, 405), (
        f"S2 REGRESSION: customer {method.upper()} {path} returned "
        f"{response.status_code}. A non-staff account can write to the catalogue."
    )


# ---------------------------------------------------------------------------
# S3 / S4 — secrets and debug settings
# ---------------------------------------------------------------------------


def test_s3_no_hardcoded_secrets_in_settings():
    """S3: the MySQL password, Gmail app password and SECRET_KEY were literals
    in settings.py, committed to git.

    Treat any secret that has ever been committed as burned. Rotate first, then
    scrub — scrubbing history without rotating leaves the live credential valid.

    This test matches on SHAPE, never on the literal values. Writing the leaked
    strings into a tracked test file would widen the leak rather than close it.
    """
    import re
    from pathlib import Path

    text = Path("config/settings.py").read_text(encoding="utf-8")

    patterns = {
        "django-insecure- prefix": r"django-insecure-",
        "Google app password (4x4 lowercase groups)": r"['\"][a-z]{4}( [a-z]{4}){3}['\"]",
        "assigned credential literal": (
            r"(?i)\b(PASSWORD|SECRET_KEY|API_KEY|APP_SECRET|TOKEN)\b\s*[:=]\s*"
            r"['\"][^'\"]{8,}['\"]"
        ),
    }

    found = []
    for label, pattern in patterns.items():
        for match in re.finditer(pattern, text):
            line = text[: match.start()].count("\n") + 1
            # An env lookup on the same line is the correct form.
            source_line = text.splitlines()[line - 1]
            if "environ" in source_line or "env(" in source_line:
                continue
            found.append(f"{label} at settings.py:{line}")

    assert not found, (
        f"S3 REGRESSION: credential literals in settings.py: {found}. "
        f"Move to environment variables and rotate every exposed value — a "
        f"secret that reached git is compromised even after deletion."
    )


def test_s3_no_secret_pasted_as_env_var_name():
    """A variant nobody logged: the literal secret was pasted as the env var
    NAME rather than its value —

        STEADFAST_API_KEY = os.environ.get('<the api key itself>')

    which returns None and fails open, silently, forever. The courier
    integration was dead for weeks with no error anywhere.
    """
    import re
    from pathlib import Path

    text = Path("config/settings.py").read_text(encoding="utf-8")
    # An env var name should be UPPER_SNAKE. A long lowercase alphanumeric run
    # in that position is a secret, not a variable name.
    suspicious = re.findall(r"environ\.get\(\s*['\"]([a-z0-9]{16,})['\"]", text)
    assert not suspicious, (
        f"S3 REGRESSION: {len(suspicious)} secret(s) pasted as env var names. "
        f"These return None and the integration fails open."
    )


@pytest.mark.django_db
def test_s4_production_security_settings():
    """S4: DEBUG=True in production, no SECURE_* headers, insecure cookies.

    Skipped outside production config — the point is that the production path
    is checked at all, since nobody runs `check --deploy` by hand.
    """
    from django.conf import settings

    if settings.DEBUG:
        pytest.skip("Development settings; the CI production job runs this.")

    assert settings.SECURE_SSL_REDIRECT is True
    assert settings.SESSION_COOKIE_SECURE is True
    assert settings.CSRF_COOKIE_SECURE is True
    assert settings.SECURE_HSTS_SECONDS >= 3600
    assert settings.X_FRAME_OPTIONS == "DENY"
    assert "*" not in settings.ALLOWED_HOSTS
    assert getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False) is False


def test_s4_debug_defaults_to_false():
    """`DEBUG = os.environ.get('DEBUG', 'True') == 'True'` defaults to ON.

    A missing env var must fail closed. Also note `bool("False") is True` —
    the string comparison is what makes this work at all.
    """
    from pathlib import Path

    text = Path("config/settings.py").read_text(encoding="utf-8")
    assert "'DEBUG', 'True'" not in text and '"DEBUG", "True"' not in text, (
        "S4 REGRESSION: DEBUG defaults to True when the env var is absent."
    )


# ---------------------------------------------------------------------------
# S5 — client-supplied prices
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_s5_server_recomputes_order_total(customer_client, product):
    """S5: the client sent unit_price and total_amount; the server stored them.

    A ৳45,000 door was orderable for ৳1.
    """
    product.price = Decimal("45000.00")
    product.stock_quantity = 10
    product.save()

    response = customer_client.post(
        "/api/orders/",
        {
            "items": [{"product": product.id, "quantity": 1, "unit_price": "1.00"}],
            "total_amount": "1.00",
            "shipping_address": "test",
        },
        format="json",
    )
    assert response.status_code == 201, response.content

    from order.models import Order

    order = Order.objects.get(pk=response.json()["id"])
    assert order.total_amount == Decimal("45000.00"), (
        f"S5 REGRESSION: order total is {order.total_amount}, expected 45000.00. "
        f"The server accepted a client-supplied price."
    )
    assert order.items.first().unit_price == Decimal("45000.00")


@pytest.mark.django_db
def test_s5_no_writable_price_fields():
    """The structural version of the same test — catches it before a request
    is ever made."""
    from order.serializers import OrderSerializer

    writable = {
        name for name, f in OrderSerializer().get_fields().items() if not f.read_only
    }
    banned = {"total_amount", "unit_price", "status", "created_at", "user"}
    leaked = writable & banned
    assert not leaked, f"S5 REGRESSION: OrderSerializer allows writes to {leaked}."


# ---------------------------------------------------------------------------
# S6 — permission class that permits everything
# ---------------------------------------------------------------------------


def test_s6_no_permission_class_returns_bare_true():
    """S6: a custom permission class whose has_permission was `return True`.

    It looked like a control in every viewset that referenced it and enforced
    nothing.
    """
    import inspect
    import importlib

    from django.apps import apps
    from rest_framework.permissions import BasePermission

    offenders = []
    for app in apps.get_app_configs():
        try:
            module = importlib.import_module(f"{app.name}.permissions")
        except ModuleNotFoundError:
            continue
        for name, obj in vars(module).items():
            if not (
                isinstance(obj, type)
                and issubclass(obj, BasePermission)
                and obj is not BasePermission
            ):
                continue
            for method in ("has_permission", "has_object_permission"):
                impl = obj.__dict__.get(method)
                if impl is None:
                    continue
                body = [
                    line.strip()
                    for line in inspect.getsource(impl).splitlines()[1:]
                    if line.strip() and not line.strip().startswith(("#", '"""'))
                ]
                if body == ["return True"]:
                    offenders.append(f"{name}.{method}")

    assert not offenders, (
        f"S6 REGRESSION: permission methods that permit everything: {offenders}."
    )


@pytest.mark.django_db
def test_s6_every_viewset_declares_permissions():
    """A viewset with no permission_classes silently inherits the global
    default, which is how an endpoint ends up more open than intended."""
    missing = []
    for pattern in get_resolver().url_patterns:
        cls = getattr(getattr(pattern, "callback", None), "cls", None)
        if cls is None:
            continue
        if "permission_classes" not in vars(cls) and not hasattr(cls, "get_permissions"):
            missing.append(cls.__name__)
    assert not missing, (
        f"S6 REGRESSION: viewsets with no explicit permission_classes: "
        f"{sorted(set(missing))}."
    )


# ---------------------------------------------------------------------------
# S7 / S8 — client-side-only authorisation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_s8_staff_flag_is_not_client_assertable(customer_client, customer):
    """S8: the frontend read is_staff from localStorage, so editing one value in
    DevTools produced a working admin UI.

    The fix is server-side verification. This test asserts the server half: a
    customer's own PATCH cannot make them staff.
    """
    response = customer_client.patch(
        f"/api/users/{customer.id}/", {"is_staff": True}, format="json"
    )
    customer.refresh_from_db()
    assert customer.is_staff is False, (
        "S8 REGRESSION: a customer escalated themselves to staff via PATCH."
    )
    assert response.status_code in (200, 400, 403)


@pytest.mark.django_db
def test_s7_me_endpoint_is_the_role_authority(customer_client, customer):
    """The /auth/me/ endpoint must report the DATABASE value, ignoring anything
    the client claims — it is the only sanctioned role check."""
    response = customer_client.get("/api/auth/me/")
    assert response.status_code == 200
    assert response.json()["is_staff"] is False


@pytest.mark.django_db
def test_s7_admin_endpoints_reject_a_customer_token(customer_client):
    """Whatever the admin UI shows, the data must be unreachable."""
    for path in ("/api/orders/", "/api/users/"):
        response = customer_client.get(path)
        assert response.status_code in (403, 404) or (
            response.status_code == 200
            and _is_scoped_to_owner(response.json())
        ), f"S7 REGRESSION: customer token read {path} unscoped."


def _is_scoped_to_owner(payload):
    results = payload.get("results", payload) if isinstance(payload, dict) else payload
    return isinstance(results, list) and len(results) == 0


# ---------------------------------------------------------------------------
# N2 — OTP brute force
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_n2_otp_verify_is_throttled(client, settings):
    """A 6-digit OTP is 10^6 possibilities. Unthrottled, that is minutes.

    Both the issue and the verify endpoint need their own budget, keyed on IP
    AND on the target email — an IP-only key lets a botnet spread the attack.
    """
    settings.CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    }
    from django.core.cache import cache

    cache.clear()

    codes = [f"{n:06d}" for n in range(30)]
    statuses = [
        client.post(
            "/api/auth/verify-otp/",
            {"email": "victim@example.com", "otp": code},
            content_type="application/json",
        ).status_code
        for code in codes
    ]
    assert 429 in statuses, (
        "N2 REGRESSION: 30 consecutive OTP verifications with no 429. "
        "A 6-digit code is brute-forceable."
    )


@pytest.mark.django_db
def test_n2_otp_expires(customer):
    """An OTP with no expiry is a permanent password sitting on the user row."""
    from django.utils import timezone

    assert hasattr(customer, "otp_expires_at"), (
        "N2 REGRESSION: no otp_expires_at field. The code never expires."
    )
    if customer.otp_expires_at:
        window = customer.otp_expires_at - timezone.now()
        assert window.total_seconds() <= 15 * 60


@pytest.mark.django_db
def test_n2_otp_is_not_stored_in_plaintext(customer):
    """Stored hashed, so a database read does not hand over live codes."""
    from django.contrib.auth.hashers import identify_hasher

    if not customer.otp:
        pytest.skip("No OTP set on this fixture.")
    try:
        identify_hasher(customer.otp)
    except Exception:
        pytest.fail("N2 REGRESSION: OTP stored in plaintext.")


# ---------------------------------------------------------------------------
# N5 — upload validation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_n5_upload_rejects_a_renamed_executable(staff_client):
    """Extension and Content-Type both come from the client. Magic bytes do not.

    A PHP payload named shell.jpg with Content-Type: image/jpeg passes both of
    the checks people usually write.
    """
    from django.core.files.uploadedfile import SimpleUploadedFile

    payload = SimpleUploadedFile(
        "shell.jpg", b"<?php system($_GET['c']); ?>", content_type="image/jpeg"
    )
    response = staff_client.post(
        "/api/products/1/images/", {"image": payload}, format="multipart"
    )
    assert response.status_code == 400, (
        "N5 REGRESSION: a non-image passed upload validation."
    )


@pytest.mark.django_db
def test_n5_upload_rejects_oversized_file(staff_client):
    from django.core.files.uploadedfile import SimpleUploadedFile

    big = SimpleUploadedFile(
        "big.jpg", b"\xff\xd8\xff" + b"\x00" * (8 * 1024 * 1024), content_type="image/jpeg"
    )
    response = staff_client.post(
        "/api/products/1/images/", {"image": big}, format="multipart"
    )
    assert response.status_code == 400, "N5 REGRESSION: no upload size limit."


@pytest.mark.django_db
def test_n5_upload_discards_client_filename(staff_client, tmp_path):
    """`../../../etc/passwd` arrives as an ordinary string."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    payload = SimpleUploadedFile(
        "../../../evil.jpg", b"\xff\xd8\xff\x00", content_type="image/jpeg"
    )
    response = staff_client.post(
        "/api/products/1/images/", {"image": payload}, format="multipart"
    )
    if response.status_code == 201:
        stored = response.json()["image"]
        assert ".." not in stored, "N5 REGRESSION: path traversal in a stored filename."


# ---------------------------------------------------------------------------
# Enumeration — 404, never 403, for someone else's record
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_other_users_order_returns_404_not_403(customer_client, other_customer_order):
    """A 403 confirms the row exists, which turns sequential ids into a
    customer list. The audit found OrderViewSet.track as AllowAny with a raw
    Order.objects.get(pk=pk).
    """
    response = customer_client.get(f"/api/orders/{other_customer_order.id}/")
    assert response.status_code == 404, (
        f"Returned {response.status_code}. A 403 leaks the existence of the order."
    )
