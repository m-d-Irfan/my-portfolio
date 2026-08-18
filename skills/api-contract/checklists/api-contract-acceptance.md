# API contract acceptance

Every line is a command with a pass condition. Run before merging any change to
a serializer, viewset, route, or response shape.

## 1. Schema generates and validates

```bash
python manage.py spectacular --file schema.yml --validate
# PASS: exits 0, no warnings about unresolvable serializers
```

`--validate` fails on a serializer whose `source=` points at nothing — the
cheapest drift check available.

## 2. Schema is committed and current

```bash
python manage.py spectacular --file schema.yml
git diff --exit-code schema.yml
# PASS: no diff. A non-empty diff in CI means an endpoint changed without
#       regenerating the schema, so no PR showed the contract change.
```

## 3. No serializer field without a backing

```bash
pytest tests/test_contract.py::test_declared_fields_have_a_backing
# PASS: all parametrised cases pass
```

This is the §2.5 test. `features` was declared on `ProductSerializer` with no
`ProductFeature` model and no migration; four frontend files consumed it; nothing
raised for months.

## 4. No wildcard field lists

```bash
grep -rn "fields = '__all__'\|fields = \"__all__\"" --include=serializers.py .
# PASS: no output
```

`__all__` publishes every future column automatically. That is how a
`buying_price` or an `is_staff` reaches the API without anyone deciding to
publish it.

## 5. Privileged fields are read-only

```bash
pytest tests/test_contract.py::test_privileged_fields_are_read_only
# PASS: no serializer allows writes to is_staff, role, total_amount,
#       unit_price, price, created_at, otp
```

```bash
grep -rn "read_only_fields" --include=serializers.py . | grep -i order
# PASS: total_amount, created_at, status, user all listed
```

## 6. Response shapes are pinned

```bash
pytest tests/test_contract.py::test_response_shape
# PASS: exact key set matches EXPECTED_SHAPES
```

Removed or renamed keys fail. Added keys also fail — update `EXPECTED_SHAPES` in
the same commit, which is the point: the change becomes visible in review.

## 7. Error envelope is uniform

```bash
# Validation error carries fields.
curl -s -X POST localhost:8000/api/auth/register/ \
  -H 'Content-Type: application/json' -d '{}' | python -m json.tool
# PASS: {"error": {"code": "validation_error", "message": "...", "fields": {...}}}
```

```bash
# Permission denial carries no fields.
curl -s -X POST localhost:8000/api/products/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H 'Content-Type: application/json' -d '{}' | python -m json.tool
# PASS: {"error": {"code": "permission_denied", ...}}, HTTP 403
```

```bash
# Throttled response tells the client when to retry.
for i in $(seq 1 12); do curl -s -o /dev/null -X POST \
  localhost:8000/api/auth/send-otp/ -d 'email=a@b.com'; done
curl -s -X POST localhost:8000/api/auth/send-otp/ -d 'email=a@b.com' | python -m json.tool
# PASS: code "throttled" with retry_after, and a Retry-After response header
```

## 8. 500s leak nothing

```bash
pytest tests/test_contract.py::test_server_error_leaks_nothing
# PASS: response body contains no exception text, code is "server_error"
```

```bash
grep -rn "str(exc)\|str(e)}" --include=views.py . | grep -i "Response"
# PASS: no output — an exception string in a response carries SQL and values
```

## 9. 404 rather than 403 for other people's records

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/orders/1/ \
  -H "Authorization: Bearer $OTHER_CUSTOMER_TOKEN"
# PASS: 404. A 403 confirms the record exists and lets an attacker enumerate
#       order ids by walking integers.
```

## 10. 401 and 403 are not confused

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/products/
# PASS: 401 (no credentials)

curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/products/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
# PASS: 403 (authenticated, not permitted)
```

A 403 that the frontend treats as 401 causes a token-refresh loop on every
permission denial.

## 11. Frontend reads only what the API sends

```bash
grep -rhoE "product\.[a-z_]+" src/ | sort -u > /tmp/fe.txt
curl -s localhost:8000/api/products/1/ | python -c \
  "import json,sys;[print(f'product.{k}') for k in sorted(json.load(sys.stdin))]" \
  | sort -u > /tmp/api.txt
comm -23 /tmp/fe.txt /tmp/api.txt
# PASS: empty. Any output is a property the frontend reads and the API never
#       sends — undefined forever, silently.
```

Crude (misses destructuring) and it takes ten seconds. It would have printed
`product.features`.

## 12. Documented routes exist, and existing routes are documented

```bash
grep -oE 'path="[^"]+"' src/routes.jsx | sed 's/path="//;s/"//' | sort -u > /tmp/actual.txt
grep -oE '/[a-z-]+(/:[a-z]+)?' structure.md | sort -u > /tmp/documented.txt

comm -23 /tmp/documented.txt /tmp/actual.txt   # PASS: empty — no phantom docs
comm -13 /tmp/documented.txt /tmp/actual.txt   # PASS: empty — no undocumented surface
```

The audit found `Parts.jsx`, `CarsAndTrucks.jsx` and `Radios.jsx` documented
with no routes registered.

## 13. Deprecations carry a removal date

```bash
grep -rn "DEPRECATED" --include=*.py . | grep -v "remove after"
# PASS: no output. A DEPRECATED with no date is never removed.
```

## 14. Pagination shape is intact

```bash
curl -s localhost:8000/api/products/ | python -c \
  "import json,sys;d=json.load(sys.stdin);print(sorted(d))"
# PASS: ['count', 'next', 'previous', 'results']
```

Changing this shape breaks every consumer at once.

---

## Mapping to tests

| Section | Test form |
|---|---|
| 1, 2 | CI step: `spectacular --validate` + `git diff --exit-code` |
| 3, 5, 6, 7, 8 | `tests/test_contract.py` (copy from `assets/`) |
| 4, 13 | grep in CI |
| 9, 10 | Permission matrix — owned by `security-hardening` |
| 11, 12 | Pre-merge shell check, or a CI script |
| 14 | Response shape test |
