# Backend acceptance checklist

Run before a backend is considered done. Every line is a command with a stated
pass condition.

Security lines are cross-referenced to
[`security-hardening/checklists/pre-deploy-security.md`](../../security-hardening/checklists/pre-deploy-security.md),
which is the authority for those. This file adds the build-correctness checks
that are not security: migrations, serializer shape, query counts, URL wiring.

```bash
BASE=http://localhost:8000/api
CUST=$(curl -s -X POST $BASE/auth/login/ -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"..."}' | jq -r .access)
ADMIN=$(curl -s -X POST $BASE/auth/login/ -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}' | jq -r .access)
```

---

## 1. It boots

- [ ] `python manage.py check` — no issues
- [ ] `python manage.py check --deploy` — **zero** warnings with production env vars
- [ ] `python manage.py migrate` — clean on an empty database
- [ ] `python manage.py makemigrations --check --dry-run` — no un-migrated model changes

```bash
# Required env vars fail loudly, not silently.
DB_ENGINE=mysql DB_NAME= python manage.py check
# PASS: RuntimeError naming the missing variable. FAIL: starts anyway
```

- [ ] Every `env(...)` key appears in `.env.example`

```bash
grep -ohrE "env\(['\"]([A-Z_]+)" --include=*.py . | sed -E "s/.*['\"]//" | sort -u > /tmp/used
grep -oE '^[A-Z_]+' .env.example | sort -u > /tmp/documented
comm -23 /tmp/used /tmp/documented
# PASS: no output
```

---

## 2. Models

- [ ] No `FloatField` holding money

```bash
grep -rn "FloatField" --include=models.py . | grep -iE "price|amount|total|cost|discount"
# PASS: no output
```

- [ ] Every abstract base declares `class Meta: abstract = True`
- [ ] No abstract base uses a literal `related_name` (must be `%(class)s_...`)
- [ ] Every slug goes through `unique_slug`, not bare `slugify`
- [ ] `AUTH_USER_MODEL` was set before the first migration
- [ ] Every `ForeignKey` states `on_delete` deliberately — `CASCADE` is not the default choice for a business entity

```bash
# Duplicate-title slug collision must not raise.
python manage.py shell -c "
from core_domain.models import Product
a = Product.objects.create(title='Same Name', category_id=1)
b = Product.objects.create(title='Same Name', category_id=1)
print(a.slug, b.slug); assert a.slug != b.slug"
# PASS: two distinct slugs, e.g. same-name / same-name-2

# Updating an existing row must not raise, and must not change the slug.
python manage.py shell -c "
from core_domain.models import Product
p = Product.objects.first(); s = p.slug
p.title = 'Renamed Entirely'; p.save(); p.refresh_from_db()
assert p.slug == s, 'slug changed on rename — breaks live URLs'
print('slug stable:', p.slug)"
# PASS: no AttributeError, slug unchanged
```

That second test is the regression guard for the `.first().name` /
`.first().title` defect, which only fired on update and so was never noticed.

---

## 3. Access — see security-hardening for the authority

- [ ] Every ViewSet declares `permission_classes` in its own class body

```bash
python manage.py shell -c "
from core_domain.urls import router
bad = [v.__name__ for _, v, _ in router.registry if 'permission_classes' not in vars(v)]
print('missing:', bad)"
# PASS: []
```

- [ ] The three-way curl matrix passes for products, categories **and** brands

```bash
for R in products categories brands; do
  A=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/$R/ -H 'Content-Type: application/json' -d '{}')
  C=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/$R/ -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{}')
  echo "$R  anon:$A  customer:$C"
done
# PASS: anon 401, customer 403 on every row
```

- [ ] Owner-scoped list routes are filtered in `get_queryset()`

```bash
curl -s "$BASE/orders/" -H "Authorization: Bearer $CUST" | jq '[.results[].user] | unique'
# PASS: exactly one id — the customer's own
```

---

## 4. Serializers

- [ ] No serializer uses `fields = '__all__'`

```bash
grep -rn "fields = ['\"]__all__" --include=serializers.py .
# PASS: no output
```

- [ ] List and detail use different serializers

```bash
curl -s "$BASE/products/"   | jq '.results[0] | keys | length'
curl -s "$BASE/products/1/" | jq 'keys | length'
# PASS: list key count is materially smaller
```

- [ ] No nested collections on a list route

```bash
curl -s "$BASE/products/" | jq '.results[0] | has("attributes"), has("images")'
# PASS: false, false
```

- [ ] Privileged fields are read-only

```bash
curl -s -X PATCH $BASE/auth/me/ -H "Authorization: Bearer $CUST" \
  -H 'Content-Type: application/json' -d '{"is_staff":true,"role":"admin"}'
curl -s $BASE/auth/me/ -H "Authorization: Bearer $CUST" | jq '{is_staff,role}'
# PASS: unchanged
```

- [ ] `created_at` is read-only — backdating must fail
- [ ] Client-supplied prices and totals are ignored (see security-hardening §5)
- [ ] Every `PrimaryKeyRelatedField` has a scoped `queryset`

---

## 5. Queries

- [ ] Every queryset feeding a nested serializer declares `select_related` / `prefetch_related`

```python
def test_product_list_query_count(client, django_assert_max_num_queries):
    with django_assert_max_num_queries(6):
        client.get("/api/products/")
```

- [ ] List response for a full catalogue is under 100 KB

```bash
curl -s "$BASE/products/" -o /tmp/p.json -w '%{size_download} bytes\n'
# PASS: < 100000
```

- [ ] Pagination is on, and the frontend does not fetch everything to filter locally

```bash
curl -s "$BASE/products/" | jq 'has("count") and has("next")'
# PASS: true
```

---

## 6. URLs

- [ ] `/api/auth/me/` exists and returns 401 unauthenticated — not 404
- [ ] Every route is `name=`d
- [ ] Trailing-slash convention is consistent, and a mismatched POST does not silently 301
- [ ] The Django admin is not at `/admin/`
- [ ] Media is not served through Django when `DEBUG=False`

---

## 7. Time and locale

```bash
python manage.py shell -c "
from django.conf import settings
from django.utils import timezone
assert settings.TIME_ZONE == 'Asia/Dhaka', settings.TIME_ZONE
assert settings.USE_TZ is True
print(timezone.localtime())"
# PASS: Dhaka local time
```

- [ ] Any "today" query uses local time, or reads an explicit `business_date`

---

## 8. Tests exist for the things that broke

- [ ] A test per audit finding: S1, S2, S5, S6, S8, C1, C2, P4
- [ ] `pytest` green
- [ ] `pip-audit` — no known CVEs
- [ ] `ruff check .` clean

---

## Sign-off

| § | Area | Result |
|---|---|---|
| 1 | Boots, migrates, env validated | |
| 2 | Models, slugs, abstract bases | |
| 3 | Access declared and enforced | |
| 4 | Serializer shape and write protection | |
| 5 | Query counts and payload size | |
| 6 | URL wiring | |
| 7 | Timezone | |
| 8 | Regression tests | |

§3 and §4 were both exploitable in production. Do not sign them off from code
reading alone — run the curl commands.
