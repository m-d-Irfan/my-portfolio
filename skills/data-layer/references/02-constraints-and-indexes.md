# Constraints and indexes

The database is the last line of defence. Application code is not.

## Why constraints, not `clean()`

Validation in `clean()` or a serializer runs only on the paths that call it.
A management command, a data migration, `bulk_create`, a `.update()`, a shell
session, or a second service writing to the same MySQL instance all bypass it
entirely.

A `CheckConstraint` cannot be bypassed. It is enforced by MySQL on every write,
from every client, forever.

```python
class Meta:
    constraints = [
        models.CheckConstraint(
            condition=models.Q(quantity__gt=0),
            name="orderitem_quantity_positive",
        ),
    ]
```

> **Django version note.** The kwarg is `condition=` on Django 5.1+ and `check=`
> on earlier versions. Using the wrong one raises `TypeError` at import.
> Check `django.VERSION` before writing it.

Keep serializer validation as well — it produces a readable field error instead
of a 500. The constraint is the guarantee; the serializer is the user experience.

## The constraints this project needs

```python
class Order(models.Model):
    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="order_total_non_negative",
            ),
        ]


class OrderItem(models.Model):
    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="orderitem_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="orderitem_price_non_negative",
            ),
            # One line per product per order. Without this, "add to cart" twice
            # creates two rows and the invoice shows the item twice.
            models.UniqueConstraint(
                fields=["order", "product"],
                name="uniq_order_product",
            ),
        ]
```

A zero or negative `quantity` in an order is not a hypothetical: it is what a
tampered checkout payload sends first, and a negative quantity against a
positive price produces a negative line total that *reduces* the order value.

Deliberately absent: any constraint on `ProductAttribute.stock_quantity`.
Negatives are permitted by design (**C6**).

## Conditional uniqueness

A plain `unique=True` is wrong in two common situations.

**Soft delete.** A soft-deleted row keeps occupying its unique value forever, so
the user can never re-create it:

```python
models.UniqueConstraint(
    fields=["code"],
    condition=models.Q(deleted_at__isnull=True),
    name="uniq_active_code",
)
```

**Nullable columns.** MySQL treats `NULL` as distinct from `NULL`, so
`unique=True` on a nullable column permits unlimited `NULL` rows. Usually what
you want — but if it is not, add a constraint with `condition=Q(col__isnull=False)`.

**Case sensitivity.** With the usual `utf8mb4_unicode_ci` collation, MySQL
compares case-insensitively, so `"teak"` and `"Teak"` already collide. On
PostgreSQL they do not. Do not rely on the collation — normalise the value
before saving if case-insensitive uniqueness is the intent.

## Indexes

Index what you filter, order, or join on. Nothing else — every index slows
writes and consumes space.

```python
class Meta:
    indexes = [
        # Composite. Column order matters: equality filters first, then the
        # ordering column. This one serves the admin order queue:
        #   .filter(status="pending").order_by("-created_at")
        models.Index(fields=["status", "-created_at"], name="order_status_recent"),
        models.Index(fields=["user", "-created_at"], name="order_user_recent"),
    ]
```

A composite index on `(status, created_at)` also serves a query filtering on
`status` alone — a left-most prefix is usable. The reverse is not: filtering on
`created_at` alone cannot use it.

Already indexed, do not duplicate:

- Primary keys
- `ForeignKey` columns (Django indexes them automatically)
- `unique=True` columns
- Anything in a `UniqueConstraint`

Worth indexing here:

| Column | Why |
|---|---|
| `Order.status` | Every admin queue filters on it |
| `Order.created_at` | Default `-created_at` ordering; unindexed means a filesort |
| `Product.is_active` | Every storefront query filters on it |
| `Product.slug` | Detail lookups (already covered by `unique=True`) |
| `deleted_at` | The soft-delete manager filters on it on every query |

## Find the missing ones

```bash
pip install django-debug-toolbar
```

The SQL panel flags queries with no index. Or directly:

```sql
EXPLAIN SELECT * FROM orders_order
WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20;
```

`type: ALL` with a high `rows` count and `Using filesort` means a full table
scan. `type: ref` or `range` with `Using index` is what you want.

Test against realistic volume. Every query looks fast against 50 rows; the
question is what happens at 50,000.

## Constraint violations are 409, not 500

An `IntegrityError` reaching the client as a 500 leaks the constraint name and
tells the user nothing:

```python
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework.exceptions import ValidationError

try:
    serializer.save()
except IntegrityError as exc:
    if "uniq_order_product" in str(exc):
        raise ValidationError({"product": "This item is already in the order."})
    raise
except ProtectedError:
    raise ValidationError(
        {"detail": "This category still has products and cannot be deleted."}
    )
```

Match on the constraint *name* — that is why every constraint above has an
explicit one. Matching on the message text breaks between MySQL versions.

Better: catch it centrally in the exception handler
(`api-contract/references/02-error-envelope.md`) so every endpoint behaves the
same way.

## Adding a constraint to existing data

The migration fails if any existing row violates it. Check first:

```python
>>> OrderItem.objects.filter(quantity__lte=0).count()
3
```

Three rows to fix before the migration will apply. Fix them in a data migration
in the same PR, ordered before the constraint — see
`references/04-migrations.md`.

Never `--fake` past a failing constraint migration. The constraint then does not
exist in the database while Django believes it does, which is the worst of both.

## Verification

```bash
python manage.py makemigrations --check --dry-run   # PASS: no changes
```

```sql
SHOW CREATE TABLE orders_orderitem;
-- PASS: the CHECK and UNIQUE clauses are present
```

```python
# The constraint actually bites, from a path that skips validation.
from django.db import IntegrityError
from django.test import TestCase

class ConstraintTests(TestCase):
    def test_zero_quantity_rejected_at_db_level(self):
        with self.assertRaises(IntegrityError):
            OrderItem.objects.create(order=o, product=p, quantity=0, unit_price=10)
```

`objects.create` bypasses `full_clean()`, so this proves the *database* is
enforcing it and not the serializer. That is the whole point of the test.

## Common mistakes

- Validation only in `clean()` or a serializer
- `condition=` vs `check=` for the Django version in use
- No `name=` on a constraint, so it cannot be matched or migrated cleanly
- `unique=True` with soft delete
- Indexing everything, or nothing
- Composite index in the wrong column order
- Duplicating the automatic FK index
- `IntegrityError` surfacing as a 500
- `--fake`-ing a failed constraint migration
