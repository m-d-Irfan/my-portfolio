# Versioning and evolution

Changing an endpoint without breaking whoever is already calling it.

## Additive changes are free

Adding a field to a response breaks nothing. JSON consumers ignore keys they do
not know.

| Change | Breaking? |
|---|---|
| Add a response field | No |
| Add an **optional** request field | No |
| Add a new endpoint | No |
| Relax validation (widen a range, add a choice) | No |
| Remove a response field | **Yes** |
| Rename anything | **Yes** |
| Add a **required** request field | **Yes** |
| Change a field's type | **Yes** |
| Tighten validation | **Yes** |
| Change a status code | **Yes** |
| Change pagination shape | **Yes** |

Most changes are additive. Reach for a version only when the change genuinely
cannot be.

## Type changes are the sneaky ones

```jsonc
{"price": 4500}       // number
{"price": "4500.00"}  // string
```

Both look fine. `price.toFixed(2)` throws on the second. DRF's `DecimalField`
serialises to a string by default — flipping `COERCE_DECIMAL_TO_STRING` changes
every money field in the API at once, which is a breaking change disguised as a
settings tweak.

Pick one at the start of the project and never change it. String is the safer
choice for money: it survives JavaScript's float precision intact.

## Versioning

URL-prefix versioning. Simplest to reason about, visible in logs, trivial to
route.

```python
urlpatterns = [
    path("api/v1/", include("api.urls_v1")),
    path("api/v2/", include("api.urls_v2")),
]
```

Version from the first release even with only one version. Retrofitting a prefix
once a mobile app exists means supporting both forever.

Header-based versioning (`Accept: application/vnd.daf.v2+json`) is more
"correct" and materially harder to debug — you cannot paste a URL into a browser
and see what a client sees. Not worth it here.

### What gets a new version

A new version is expensive: two code paths, two sets of tests, two things to
keep secure. Almost nothing deserves one.

Use a new version when the **resource model itself** changed — orders splitting
into orders and fulfilments, a flat address becoming structured.

For everything else, use one of the cheaper tools below.

## Cheaper than a version

**Additive with a deprecation window.** Add the new field alongside the old,
populate both, and remove the old one after clients have moved.

```python
class OrderSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(source="total_amount", max_digits=12, decimal_places=2)
    # DEPRECATED 2026-08-08, remove after 2026-11-01. Superseded by `total`.
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
```

The comment carries a date and a removal date. A `# DEPRECATED` with no date is
never removed.

**Accept both on input:**

```python
def to_internal_value(self, data):
    if "total_amount" in data and "total" not in data:
        data = {**data, "total": data["total_amount"]}
    return super().to_internal_value(data)
```

**Feature flags** for behaviour changes that are not shape changes.

## Retiring a field

```
1. Add the replacement. Populate both. Ship.
2. Update every internal consumer. Ship.
3. Log every read of the old field. Wait for the logs to go quiet.
4. Remove it. Ship.
```

Step 3 is the one that gets skipped, and it is the only one that tells you
whether step 4 is safe.

```python
def get_total_amount(self, obj):
    logger.info("deprecated_field_read field=total_amount ua=%s",
                self.context["request"].META.get("HTTP_USER_AGENT", "")[:80])
    return obj.total_amount
```

For a web-only SPA the window can be one deploy — you control every client. The
moment a mobile app exists, it is months: users do not update.

## Pagination is part of the contract

```jsonc
{"count": 213, "next": "...?page=3", "previous": "...?page=1", "results": [...]}
```

Changing page size, switching to cursor pagination, or renaming `results` breaks
every consumer. If you need cursor pagination for a large table, add it as a new
endpoint or a new version — do not swap it in place.

## Documenting the contract

`schema.yml` from drf-spectacular, committed. The PR diff then shows exactly
what changed about the contract, which is the cheapest review signal available.

```bash
python manage.py spectacular --file schema.yml --validate
```

Mark deprecations so they appear in the schema:

```python
@extend_schema_field(OpenApiTypes.DECIMAL)
@extend_schema(deprecated=True)
```

## Verification

```bash
# A contract change is visible in review.
git diff schema.yml
# PASS: the diff matches what you intended to change

# Nothing broke for existing clients.
pytest tests/test_contract.py
```

```python
def test_v1_response_shape_unchanged(self):
    """Pinned response keys. Fails when a field is removed or renamed,
    which is exactly when you want to be stopped."""
    r = self.client.get("/api/v1/products/1/")
    self.assertEqual(
        set(r.json()),
        {"id", "title", "slug", "price", "category", "brand", "images", "is_active"},
    )
```

Pin the key set, not just presence. Asserting `"id" in response` passes even
after five fields disappear.

```bash
# Deprecated fields carry a removal date.
grep -rn "DEPRECATED" --include=*.py . | grep -v "remove after"
# PASS: no output
```

## Common mistakes

- Renaming a field without a deprecation window
- Flipping `COERCE_DECIMAL_TO_STRING` and treating it as a settings change
- Adding a required request field to an existing endpoint
- Tightening validation without checking what existing clients send
- A version bump for something that could have been additive
- `# DEPRECATED` with no removal date
- Removing a field without first logging reads of it
- Changing pagination shape in place
- Contract tests that assert presence instead of the exact key set
