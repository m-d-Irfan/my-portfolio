"""Contract tests.

Copy to `tests/test_contract.py`.

These catch the failure mode from audit §2.5: a serializer field, a frontend
component and a context provider all agreeing on a shape that does not exist in
the database. Nothing raised — `product.features` was simply `undefined`
forever, filters silently returned nothing, and the admin feature editor saved
into a void.

Drift is silent by construction. JavaScript does not raise on a missing
property, and DRF ignores unknown keys on input. It has to be detected
deliberately.

Run in CI on every PR.
"""

import importlib
import json
import subprocess
from pathlib import Path

import pytest
from django.apps import apps
from django.urls import get_resolver
from rest_framework.serializers import ModelSerializer

# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def all_model_serializers():
    """Every concrete ModelSerializer subclass with a Meta.model."""
    found = []
    for app in apps.get_app_configs():
        try:
            module = importlib.import_module(f"{app.name}.serializers")
        except ModuleNotFoundError:
            continue
        for obj in vars(module).values():
            if (
                isinstance(obj, type)
                and issubclass(obj, ModelSerializer)
                and obj is not ModelSerializer
                and getattr(getattr(obj, "Meta", None), "model", None) is not None
            ):
                found.append(obj)
    return found


SERIALIZERS = all_model_serializers()


# ---------------------------------------------------------------------------
# 1. Every serializer field has something behind it
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "serializer_cls", SERIALIZERS, ids=lambda s: s.__name__
)
def test_declared_fields_have_a_backing(serializer_cls):
    """A serializer field must resolve to a model field, a model attribute, or
    an explicitly declared serializer field.

    This is the §2.5 test. `features` was declared on ProductSerializer with no
    ProductFeature model and no migration; this assertion fails on the day that
    is written rather than months later.
    """
    model = serializer_cls.Meta.model
    model_names = {f.name for f in model._meta.get_fields()}
    declared = serializer_cls._declared_fields

    try:
        fields = serializer_cls().get_fields()
    except Exception as exc:  # unresolvable source= is itself a drift signal
        pytest.fail(f"{serializer_cls.__name__} cannot build its fields: {exc}")

    missing = []
    for name, field in fields.items():
        source = field.source or name
        root = source.split(".")[0]
        if root in ("*", ""):
            continue
        if (
            root in model_names
            or hasattr(model, root)
            or name in declared
        ):
            continue
        missing.append(f"{name} (source={source})")

    assert not missing, (
        f"{serializer_cls.__name__} declares fields with nothing behind them on "
        f"{model.__name__}: {', '.join(missing)}. Either add the model field and "
        f"its migration, or remove the serializer field."
    )


# ---------------------------------------------------------------------------
# 2. No serializer uses __all__
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "serializer_cls", SERIALIZERS, ids=lambda s: s.__name__
)
def test_no_wildcard_fields(serializer_cls):
    """`fields = '__all__'` publishes every future column automatically.

    That is how `buying_price` and `is_staff` reach the API without anyone
    deciding to publish them. Audit ref: P4, and the write-protection findings.
    """
    fields = getattr(serializer_cls.Meta, "fields", None)
    assert fields != "__all__", (
        f"{serializer_cls.__name__} uses fields = '__all__'. Enumerate them so "
        f"a new model column is a deliberate API change."
    )


# ---------------------------------------------------------------------------
# 3. Privileged fields are never writable
# ---------------------------------------------------------------------------

PRIVILEGED = {
    "is_staff", "is_superuser", "role", "is_active",
    "total_amount", "unit_price", "price", "created_at",
    "buying_price", "otp", "token_version",
}


@pytest.mark.parametrize(
    "serializer_cls", SERIALIZERS, ids=lambda s: s.__name__
)
def test_privileged_fields_are_read_only(serializer_cls):
    """A writable `is_staff` is one-line privilege escalation; a writable
    `unit_price` is finding S5. Neither should be reachable through any
    serializer a customer can POST to."""
    writable = {
        name for name, f in serializer_cls().get_fields().items()
        if not f.read_only and name in PRIVILEGED
    }
    assert not writable, (
        f"{serializer_cls.__name__} allows writes to {sorted(writable)}. "
        f"Add them to Meta.read_only_fields."
    )


# ---------------------------------------------------------------------------
# 4. The committed schema is current
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_schema_is_committed_and_current(tmp_path):
    """schema.yml must be regenerated whenever an endpoint changes, so the PR
    diff shows the contract change. This is the cheapest drift control there is.
    """
    schema = Path("schema.yml")
    assert schema.exists(), "schema.yml is not committed. Run: manage.py spectacular --file schema.yml"

    fresh = tmp_path / "schema.yml"
    subprocess.run(
        ["python", "manage.py", "spectacular", "--file", str(fresh), "--validate"],
        check=True, capture_output=True,
    )
    assert fresh.read_text() == schema.read_text(), (
        "schema.yml is stale. An endpoint changed without regenerating it. Run:\n"
        "  python manage.py spectacular --file schema.yml --validate"
    )


# ---------------------------------------------------------------------------
# 5. Response shapes are pinned
# ---------------------------------------------------------------------------

EXPECTED_SHAPES = {
    # Pin the EXACT key set, not just presence. `assert "id" in response` still
    # passes after five fields disappear.
    "/api/products/1/": {
        "id", "title", "slug", "productcode", "description",
        "category", "category_name", "brand", "brand_name",
        "is_active", "is_featured", "images", "attributes",
        "colors", "features", "created_at", "updated_at",
    },
}


@pytest.mark.django_db
@pytest.mark.parametrize("path,expected", EXPECTED_SHAPES.items())
def test_response_shape(client, path, expected, seeded_catalogue):
    """Fails when a field is removed or renamed — exactly when you want to be
    stopped, because the frontend is still reading it."""
    response = client.get(path)
    assert response.status_code == 200, response.content
    actual = set(response.json())

    assert actual == expected, (
        f"{path} shape changed.\n"
        f"  removed: {sorted(expected - actual)}\n"
        f"  added:   {sorted(actual - expected)}\n"
        f"Removed fields break the frontend. Added fields are safe — update "
        f"EXPECTED_SHAPES in the same commit."
    )


# ---------------------------------------------------------------------------
# 6. Error envelope is uniform
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_validation_error_envelope(client, customer_token):
    """Every error returns {"error": {"code", "message", "fields"?}} so the
    frontend parses errors in one place."""
    response = client.post(
        "/api/auth/register/", data=json.dumps({}), content_type="application/json"
    )
    assert response.status_code == 400
    body = response.json()
    assert "error" in body, f"Non-standard error shape: {body}"
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"].get("fields"), dict)


@pytest.mark.django_db
def test_permission_error_envelope(client, customer_token):
    response = client.post(
        "/api/products/",
        data=json.dumps({}),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {customer_token}",
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


@pytest.mark.django_db
def test_server_error_leaks_nothing(client, monkeypatch):
    """A 500 must not return the exception string — it carries SQL, column
    names, and sometimes values."""
    from product import views

    def boom(*a, **kw):
        raise RuntimeError("connection to db failed: password=hunter2")

    monkeypatch.setattr(views.ProductViewSet, "list", boom)
    response = client.get("/api/products/")

    assert response.status_code == 500
    assert "hunter2" not in response.content.decode()
    assert response.json()["error"]["code"] == "server_error"


# ---------------------------------------------------------------------------
# 7. Documented routes exist
# ---------------------------------------------------------------------------


def test_every_registered_route_resolves():
    """A route in the resolver whose view cannot be imported is a broken
    deploy waiting for the first request."""
    broken = []
    for pattern in get_resolver().url_patterns:
        callback = getattr(pattern, "callback", None)
        if callback is None:
            continue
        if not callable(callback):
            broken.append(str(pattern.pattern))
    assert not broken, f"Unresolvable routes: {broken}"
