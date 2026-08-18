# Data layer acceptance

Every line is a command with a pass condition. Run before merging any schema
change. Sections map to `testing-harness` test forms — this file is the source
of truth for what those tests assert.

## 1. Schema is in sync

```bash
python manage.py makemigrations --check --dry-run
# PASS: "No changes detected"
```

```bash
python manage.py migrate --plan
# PASS: only the migrations you expect, in the order you expect
```

```bash
python manage.py sqlmigrate <app> <number>
# PASS: the SQL matches your intent; no unexpected table rewrite
```

## 2. Migrations run from zero

```bash
# Against an empty database, not your incrementally-migrated local one.
python manage.py migrate
# PASS: completes with no error
```

Catches: data migrations importing models directly instead of `apps.get_model`,
and dependency chains that only work from your current local state.

## 3. Abstract bases have no tables

```python
from django.db import connection
tables = connection.introspection.table_names()
assert "common_basedomainitem" not in tables
assert "common_timestampedmodel" not in tables
# PASS: both absent — a table here means `abstract = True` is missing and every
#       subclass is silently multi-table inheritance
```

## 4. Money is never a float

```bash
grep -rn "FloatField" --include=models.py .
# PASS: no hits on any price, amount, total, or discount field
```

## 5. on_delete reviewed

```bash
grep -rn "on_delete=models.CASCADE" --include=models.py .
# PASS: every hit is a child row meaningless without its parent
#       (ProductImage, OrderItem). Any business FK must be PROTECT or SET_NULL.
```

## 6. Constraints exist and bite

```sql
SHOW CREATE TABLE orders_orderitem;
-- PASS: CHECK on quantity > 0, CHECK on unit_price >= 0,
--       UNIQUE on (order_id, product_id) — each with an explicit name
```

```python
from django.db import IntegrityError
try:
    OrderItem.objects.create(order=o, product=p, quantity=0, unit_price=10)
    raise AssertionError("constraint not enforced")
except IntegrityError:
    pass
# PASS: raises. `objects.create` skips full_clean(), so this proves the
#       DATABASE enforces it, not the serializer.
```

## 7. Indexes serve the real queries

```sql
EXPLAIN SELECT * FROM orders_order
WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20;
-- PASS: type = ref or range, key is not NULL, no "Using filesort"
-- FAIL: type = ALL with a high row count
```

Run against realistic volume. Everything looks fast against 50 rows.

## 8. No N+1

```python
with self.assertNumQueries(4):
    self.client.get("/api/products/")
# PASS: exact number, pinned. A range hides the regression.
```

```python
# The real test: constant query count under 10x the rows.
create_products(50)
with self.assertNumQueries(4):
    self.client.get("/api/products/")
# PASS: same number as with 5 products
```

```bash
grep -rn "many=True, read_only=True" --include=serializers.py .
# PASS: every nested serializer has a matching prefetch_related on its viewset
```

## 9. Prefetches are not discarded

```bash
grep -rn "obj\.\w*\.filter(\|obj\.\w*\.count()\|obj\.\w*\.order_by(" \
  --include=serializers.py .
# PASS: no hits inside a SerializerMethodField for a prefetched relation —
#       any queryset method re-queries and restores the N+1
```

## 10. List endpoints are bounded

```bash
curl -s "http://localhost:8000/api/products/" | python -m json.tool | head -5
# PASS: response has "count", "next", "previous" — pagination is active
```

```bash
grep -rn "pagination_class = None" --include=views.py .
# PASS: no hits on any endpoint whose table grows
```

## 11. Atomicity

```python
def test_failed_order_creates_no_rows(self):
    before = Order.objects.count()
    with self.assertRaises(ValidationError):
        place_order(user, [{"product": p, "quantity": 0}], addr)
    self.assertEqual(Order.objects.count(), before)
# PASS: no partial order survives
```

```python
def test_no_email_when_order_fails(self):
    with self.assertRaises(ValidationError):
        place_order(...)
    self.assertEqual(len(mail.outbox), 0)
# PASS: side effects are in on_commit, not inline
```

## 12. Races

```bash
grep -rn "select_for_update" --include=*.py . | head
# PASS: every hit is inside a `with transaction.atomic():` block —
#       outside one it silently does nothing
```

```python
# Real threads, real database, TransactionTestCase.
def test_last_unit_sells_once(self):
    attr = ProductAttribute.objects.create(stock_quantity=1, ...)
    with ThreadPoolExecutor(max_workers=2) as ex:
        results = [ex.submit(try_order, attr.pk).result() for _ in range(2)]
    self.assertEqual(sum(1 for r in results if r), 1)
# PASS: exactly one succeeds
```

## 13. Time is local and explicit

```python
from django.conf import settings
assert settings.TIME_ZONE == "Asia/Dhaka"   # C2
assert settings.USE_TZ is True
```

```bash
grep -rn "datetime.now()\|date.today()\|datetime.today()" --include=*.py . \
  | grep -v migrations
# PASS: no output — timezone.now() / timezone.localdate() everywhere
```

```python
# Day book stores its own date rather than deriving it.
assert "business_date" in [f.name for f in DayBookEntry._meta.get_fields()]
```

## 14. Prices come from the server

```bash
grep -rn "validated_data\[.\?\(price\|amount\|total\)" --include=*.py .
# PASS: no hit writes a client-supplied price to a model.
#       OrderItem.unit_price is copied from the server's own Product lookup (S5).
```

```bash
grep -rn "read_only_fields" --include=serializers.py . | grep -i order
# PASS: total_amount, created_at, status, user are all read-only
```

## 15. Intentional deviations are documented

```bash
grep -rn -B3 "stock_quantity = models.IntegerField" --include=models.py .
# PASS: a comment above it explains negatives are permitted by design (C6)
#       and references problems-and-solutions
```

An undocumented intentional deviation is indistinguishable from a bug, and the
next person "fixes" it.

---

## Mapping to tests

| Section | Test form |
|---|---|
| 1, 2 | CI step: `makemigrations --check` + migrate from empty DB |
| 3, 4, 5, 15 | Static assertion / grep in CI |
| 6 | `IntegrityError` test via `objects.create` |
| 7 | Manual `EXPLAIN` at volume |
| 8, 9 | `assertNumQueries` with a pinned count |
| 10 | API response shape test |
| 11 | Rollback + `mail.outbox` test |
| 12 | `TransactionTestCase` with `ThreadPoolExecutor` |
| 13 | Settings assertion + grep |
| 14 | Security regression test — owned by `security-hardening` |
