# Drift detection

The frontend and backend disagreeing about what an endpoint returns.

## What happened here

Audit §2.5. The frontend was **ahead** of the backend on product features:

- `Admin/Products.jsx:422` — a full feature editor, add and remove
- `Admin/Products.jsx:491` — serialised to `FormData` on save
- `ProductDetail.jsx:674` — rendered `product.features`
- `FilterContext.jsx:75-77` — built spec filters by walking
  `product.features[].name` / `.value`
- The serializer was written to match

**The model and migration were never created.** A migration
(`0002_remove_product_features_…`) had earlier dropped a `Product.features`
JSONField, and the replacement `ProductFeature(product, name, value)` model was
never added.

So four frontend files, a context provider and a serializer all agreed on a
shape that did not exist in the database. Nothing failed loudly — `features`
was simply absent from every response, filters silently returned nothing, and
the feature editor saved into a void.

A second drift in the same audit: `structure.md` documented routes for
`Parts.jsx`, `CarsAndTrucks.jsx` and `Radios.jsx`. Those components existed with
no routes in `routes.jsx`.

## Why it goes undetected

JavaScript does not raise on a missing property. `product.features` is
`undefined`; `undefined?.map()` is `undefined`; React renders nothing. The page
looks fine, slightly emptier than intended, and nobody notices for months.

DRF is equally quiet in the other direction — an extra key in a POST body is
ignored unless the serializer declares it.

Drift is silent by construction. It has to be detected deliberately.

## The rule

> **Model, migration, serializer, and frontend consumer ship in one commit.**

If you write `features` in a serializer, the `ProductFeature` model and its
migration are in the same commit. If a component reads `product.features`, the
endpoint that populates it is in the same commit.

A serializer field with no model field behind it is the defect. Not a TODO.

## Generate the schema

Make the contract a file both sides can check against.

```bash
pip install drf-spectacular
```

```python
INSTALLED_APPS += ["drf_spectacular"]
REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"

SPECTACULAR_SETTINGS = {
    "TITLE": "DAF API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
```

```bash
python manage.py spectacular --file schema.yml --validate
```

`--validate` fails on a serializer that cannot be resolved — including a field
referencing a model attribute that does not exist. Run it in CI.

Commit `schema.yml`. The diff on every PR then shows exactly what the contract
change is, which is the single cheapest drift control available.

## Detect a serializer field with no backing

`--validate` catches unresolvable fields. It does not catch a
`SerializerMethodField` that returns `getattr(obj, "features", [])` — that
resolves fine and returns nothing forever.

```python
# tests/test_contract.py
import pytest
from django.apps import apps
from rest_framework.serializers import ModelSerializer


def all_model_serializers():
    """Every concrete ModelSerializer subclass in the project."""
    import importlib, pkgutil
    for app in apps.get_app_configs():
        try:
            mod = importlib.import_module(f"{app.name}.serializers")
        except ModuleNotFoundError:
            continue
        for obj in vars(mod).values():
            if (isinstance(obj, type) and issubclass(obj, ModelSerializer)
                    and getattr(obj, "Meta", None)
                    and getattr(obj.Meta, "model", None)):
                yield obj


@pytest.mark.parametrize("serializer_cls", list(all_model_serializers()))
def test_declared_fields_exist_on_model(serializer_cls):
    """Every Meta.fields entry resolves to a model field, a declared
    serializer field, or a property. Catches the §2.5 shape exactly."""
    model = serializer_cls.Meta.model
    declared = set(serializer_cls().get_fields())
    model_fields = {f.name for f in model._meta.get_fields()}

    for name in declared:
        assert (
            name in model_fields
            or hasattr(model, name)
            or name in serializer_cls._declared_fields
        ), f"{serializer_cls.__name__}.{name} has nothing behind it on {model.__name__}"
```

This is the test that would have caught `features` on the day it was written.

## Detect frontend fields the API never sends

```bash
# Every property the frontend reads off a product.
grep -rhoE "product\.[a-z_]+" src/ | sort -u > /tmp/frontend-fields.txt

# Every field the API actually returns.
curl -s localhost:8000/api/products/1/ | python -c \
  "import json,sys; [print(f'product.{k}') for k in sorted(json.load(sys.stdin))]" \
  > /tmp/api-fields.txt

comm -23 /tmp/frontend-fields.txt /tmp/api-fields.txt
# PASS: empty. Any output is a field the frontend reads and the API never sends.
```

Crude — it misses destructuring and computed access — but it takes ten seconds
and it would have printed `product.features`.

## Detect documented routes that do not exist

```bash
# Routes named in the docs.
grep -oE '/[a-z-]+(/:[a-z]+)?' structure.md | sort -u > /tmp/documented.txt

# Routes actually registered.
grep -oE 'path="[^"]+"' src/routes.jsx | sed 's/path="//;s/"//' | sort -u > /tmp/actual.txt

comm -23 /tmp/documented.txt /tmp/actual.txt   # documented, not routed
comm -13 /tmp/documented.txt /tmp/actual.txt   # routed, not documented
```

Both directions matter. The first is a broken link in the docs; the second is an
undocumented surface nobody reviews.

## Contract tests over mocks

A frontend test mocking `{ features: [...] }` passes forever regardless of what
the API does. Mocks encode your *belief* about the contract, which is exactly
the thing that drifted.

Generate fixtures from the real schema instead:

```bash
npx openapi-typescript schema.yml -o src/types/api.d.ts
```

Even in a JavaScript project this is worth it — editors surface the shape, and
a field that disappears from the schema shows up immediately in autocomplete.

At minimum, have one test per critical endpoint that runs against a real server
in CI and asserts the response keys.

## Verification

```bash
python manage.py spectacular --file schema.yml --validate
# PASS: no errors

git diff --exit-code schema.yml
# PASS in CI: schema.yml is committed and current. A non-empty diff means
# someone changed an endpoint without regenerating it.

pytest tests/test_contract.py
# PASS: no serializer field lacks a backing model field
```

## Common mistakes

- A serializer field written for a model that does not exist yet
- Deleting a model field and leaving the serializer field
- Frontend code reading a property nobody checked is sent
- Mocked fixtures instead of schema-derived ones
- `schema.yml` not committed, so no PR shows a contract change
- Docs listing routes that were never wired
- Assuming a missing field will fail loudly. It never does.
