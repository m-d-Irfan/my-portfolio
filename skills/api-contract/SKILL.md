---
name: api-contract
description: Keep the Django API and React frontend agreeing about request and response shapes. Use when adding or changing an endpoint, renaming or removing a response field, standardising error responses, versioning an API, or investigating why the frontend reads a field the backend never sends. Covers drf-spectacular schema generation, contract tests, and deprecation windows.
---

# API contract

The frontend and backend agreeing about what an endpoint returns — and staying
agreed.

## Why this skill exists

Audit §2.5. Four frontend files, a context provider and a DRF serializer all
agreed on `product.features`. **The model and migration were never created.**

Nothing failed. `product.features` was `undefined`, `undefined?.map()` is
`undefined`, React rendered nothing, spec filters silently returned zero results,
and the admin feature editor saved into a void. It went unnoticed for months.

Drift is silent by construction: JavaScript does not raise on a missing property,
and DRF ignores unknown keys on input. It has to be detected deliberately.

## Route by task

| Task | Read |
|---|---|
| Adding a field, investigating a field the API never sends, generating the schema | [01-drift-detection.md](references/01-drift-detection.md) |
| Standardising error responses, mapping `IntegrityError` to 409, 401 vs 403 vs 404 | [02-error-envelope.md](references/02-error-envelope.md) |
| Renaming or removing a field, adding a version, deprecation windows | [03-versioning.md](references/03-versioning.md) |

Copy [`assets/test_contract.py`](assets/test_contract.py) to `tests/` and run it
in CI. It is the test that would have caught `features` on the day it was
written.

## The four rules

1. **Model, migration, serializer and consumer ship in one commit.** A
   serializer field with no model field behind it is the defect, not a TODO.
2. **`schema.yml` is committed and regenerated on every endpoint change.** The
   PR diff then shows the contract change — the cheapest review signal available.
3. **One error envelope for every endpoint.** `{"error": {"code", "message",
   "fields"}}`. The frontend branches on `code`, never on `message`.
4. **Never enumerate fields with `__all__`.** It publishes every future column
   automatically, which is how `buying_price` reaches a customer-facing response.

## Decisions

**Is this change breaking?** Adding a response field, adding an optional request
field, adding an endpoint, relaxing validation — no. Removing, renaming,
retyping, tightening validation, changing a status code or the pagination shape —
yes. See the table in [03](references/03-versioning.md).

**New version, or additive?** Almost always additive. A version means two code
paths, two test suites, two things to keep secure. Reserve it for when the
resource model itself changed — orders splitting into orders and fulfilments.
Everything else: add the new field, populate both, log reads of the old one,
remove it when the logs go quiet.

**403 or 404 for someone else's record?** 404. A 403 confirms the record exists,
which lets an attacker enumerate order ids by walking integers.

**401 or 403?** 401 means no or expired credentials and triggers the frontend's
token refresh. 403 means authenticated but not permitted and must **not**.
Confusing them causes a refresh loop on every permission denial.

## Workflow

**Adding a field**

1. Model field + migration.
2. Serializer field.
3. Regenerate `schema.yml`.
4. Frontend consumer.
5. Update `EXPECTED_SHAPES` in `tests/test_contract.py`.

All in one commit. Any subset is drift.

**Removing a field**

1. Add the replacement, populate both, ship.
2. Update every internal consumer, ship.
3. Log reads of the old field. Wait for silence.
4. Remove, ship.

Step 3 is the one that gets skipped and the only one that tells you step 4 is
safe.

**Investigating a field that never arrives**

```bash
grep -rhoE "product\.[a-z_]+" src/ | sort -u > /tmp/fe.txt
curl -s localhost:8000/api/products/1/ | python -c \
  "import json,sys;[print(f'product.{k}') for k in sorted(json.load(sys.stdin))]" \
  | sort -u > /tmp/api.txt
comm -23 /tmp/fe.txt /tmp/api.txt
```

Output is what the frontend reads and the API never sends.

## What this skill does not own

| Concern | Owner |
|---|---|
| Serializer field selection, list vs detail split, N+1 | `django-backend-builder`, `data-layer` |
| Permission classes, who may call an endpoint | `security-hardening` |
| Which fields must be server-computed (**S5**) | `security-hardening` |
| Constraints and indexes behind the fields | `data-layer` |
| The frontend's `error.normalized` consumption | `react-vite-frontend-builder` |
| Form-level display of `error.fields` | `forms-and-validation` |
| Writing and running the wider test suite | `testing-harness` |

This skill owns the *shape* of a response and whether both sides agree on it.
`security-hardening` owns whether a field is safe to accept, and `data-layer`
owns whether it is safe to store.

## Verification

```bash
python manage.py spectacular --file schema.yml --validate   # PASS: exits 0
git diff --exit-code schema.yml                             # PASS: no diff
pytest tests/test_contract.py                               # PASS: all green
grep -rn "fields = '__all__'" --include=serializers.py .     # PASS: no output
```

Full list: [checklists/api-contract-acceptance.md](checklists/api-contract-acceptance.md).

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| **§2.5** | `features` consumed by four frontend files with no model or migration | [01](references/01-drift-detection.md) |
| **§2.5** | `structure.md` documented routes for components with no route entry | [01](references/01-drift-detection.md), checklist §12 |
| **P4** (part) | `fields = '__all__'` publishing every column | [01](references/01-drift-detection.md), checklist §4 |
| — | Inconsistent error shapes across endpoints | [02](references/02-error-envelope.md) |
| — | Exception strings reaching the client in a 500 | [02](references/02-error-envelope.md) |
