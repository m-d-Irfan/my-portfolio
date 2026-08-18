# Modeling

Field choices, relationships, and abstract bases.

Copy [`assets/models_base.py`](../assets/models_base.py) to `common/models.py`
and subclass. Every base in it exists because the naive version was written
wrong in this codebase at least once.

## Field types that matter

| Data | Use | Never |
|---|---|---|
| Money | `DecimalField(max_digits=12, decimal_places=2)` | `FloatField` — `0.1 + 0.2 != 0.3`, and a rounding drift in an invoice total is unexplainable to a customer |
| Quantity | `PositiveIntegerField`, or `IntegerField` with a documented reason | An unbounded `IntegerField` where negatives are meaningless |
| Phone (BD) | `CharField(max_length=20)` | `IntegerField` — drops the leading `0` in `01712…` |
| Status | `TextChoices` + `db_index=True` | A free-text `CharField`, or a bare `BooleanField` that later needs a third state |
| Slug | `SlugField(unique=True)` | `CharField` |
| Long text | `TextField` | `CharField(max_length=5000)` |
| Flag | `BooleanField(default=…)` | `null=True` on a boolean — three states where you meant two |

`max_digits=12` holds ৳9,999,999,999.99. Enough for any single line item; check
it against your largest realistic order total before copying.

### TextChoices, always

```python
class OrderStatus(models.TextChoices):
    PENDING   = "pending",   "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    SHIPPED   = "shipped",   "Shipped"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"

status = models.CharField(
    max_length=20, choices=OrderStatus.choices,
    default=OrderStatus.PENDING, db_index=True,
)
```

A bare string means `"shipped"`, `"Shipped"` and `"shiped"` all coexist in the
column, and every filter has to guess. `TextChoices` gives you validation,
`get_status_display()`, and a symbol the IDE can rename.

Add `db_index=True` to any status you filter on — every admin queue does.

## on_delete is a business decision

Django's most-copied default is `CASCADE`, and it is almost always wrong for a
foreign key pointing at a business entity.

| Choice | Use for | Example |
|---|---|---|
| `PROTECT` | Anything referenced by financial or historical data | `Product.category` — deleting a category with products must fail loudly |
| `CASCADE` | Rows meaningless without the parent | `ProductImage.product`, `OrderItem.order` |
| `SET_NULL` | Optional references that outlive the target | `Order.user` when a customer closes their account but the order must remain |

```python
# WRONG — one click in the admin destroys the catalogue
category = models.ForeignKey(Category, on_delete=models.CASCADE)

# RIGHT — refuses, and tells you why
category = models.ForeignKey(Category, on_delete=models.PROTECT)
```

`PROTECT` raises `ProtectedError`. Catch it in the viewset and return 409 with a
readable message rather than letting it 500 — see
`api-contract/references/02-error-envelope.md`.

`OrderItem` needs a second protection: it must copy the price at purchase time,
not read it through the FK. See §"Denormalise deliberately".

## Abstract bases

```python
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True          # ← without this, Django creates a real table
```

Omitting `abstract = True` is silent and permanent: Django builds a table for
the base, and every subclass becomes multi-table inheritance with a hidden JOIN
on every single query. The audit found exactly this on `BaseDomainItem`.

On an abstract base, `related_name` must interpolate:

```python
category = models.ForeignKey(
    Category, on_delete=models.PROTECT,
    related_name="%(class)s_items",   # product_items, article_items, …
)
```

A literal `related_name="items"` collides the moment a second subclass exists,
and the error surfaces at import time in an apparently unrelated app.

## Slugs

Three separate defects, all in one line of the original code:

```python
# WRONG
self.slug = slugify(self.title)
```

1. No collision handling → `IntegrityError` on the second product named "Teak
   Door".
2. Runs on every save → renaming a product silently changes a live URL that
   search engines indexed and customers bookmarked. A 404 with no redirect.
3. No length guard → a 200-character title into a 50-character column is
   `DataError` on MySQL and a silent truncation on SQLite.

`SluggedModel` handles all three: assign once on create, suffix `-2`/`-3` until
free, truncate to fit including the suffix. Set `slug_source` on the subclass.

If a slug genuinely must change, change it explicitly and ship a redirect.

## Never reference a field that may not exist

```python
# WRONG — the audit's AttributeError. The field is `title`, not `name`.
old = BaseDomainItem.objects.filter(pk=self.pk).first().name
```

Two failures: the wrong attribute, and `.first()` returning `None` on create.
It only ran on edit, so nothing caught it until a customer edited a product.

If you need the pre-save value, guard both:

```python
if self.pk:
    old = type(self).objects.filter(pk=self.pk).values_list("title", flat=True).first()
```

`values_list` avoids loading the whole row for one field.

## Do not redeclare inherited fields

```python
class User(AbstractUser):
    date_joined = models.DateTimeField(default=timezone.now)   # WRONG
```

`AbstractUser` already defines it. Redeclaring shadows the parent, generates
migration churn, and diverges from what Django's own auth code expects.

## Denormalise deliberately

Some duplication is correctness, not redundancy:

```python
class OrderItem(models.Model):
    product     = models.ForeignKey(Product, on_delete=models.PROTECT)
    product_name = models.CharField(max_length=255)   # as sold
    unit_price   = models.DecimalField(max_digits=12, decimal_places=2)
    quantity     = models.PositiveIntegerField()
```

`unit_price` is copied at purchase time. Reading the price through the FK means
tomorrow's price change silently rewrites last month's invoices. `product_name`
likewise — a renamed product must not rewrite history.

This is the *only* legitimate reason to store a price on a write path, and it is
written by the server from the server's own lookup, never from the request body
(**S5**).

## Documented deviations

`ProductAttribute.stock_quantity` is a plain `IntegerField` and negatives are
storable. That is intentional under this project's ops design (**C6**) — the
godown can go negative pending reconciliation.

Document it in the model, or the next person "fixes" it:

```python
# Negatives are permitted by design: the godown may oversell pending
# reconciliation. Do not add PositiveIntegerField or a CheckConstraint here.
# See problems-and-solutions C6.
stock_quantity = models.IntegerField(default=0)
```

An undocumented intentional deviation is indistinguishable from a bug.

## Verification

```bash
python manage.py makemigrations --check --dry-run   # PASS: no changes
grep -rn "FloatField" */models.py                   # PASS: no money fields
grep -rn "on_delete=models.CASCADE" */models.py     # review each hit
grep -rn "class Meta" -A2 common/models.py          # PASS: abstract = True on every base
```

```python
# Abstract bases have no table.
from django.db import connection
assert "common_basedomainitem" not in connection.introspection.table_names()
```

## Common mistakes

- `FloatField` for money
- `CASCADE` on a business FK
- Missing `abstract = True`
- Literal `related_name` on an abstract base
- Re-slugging on rename
- Reading a price through an FK on an invoice
- Redeclaring an inherited field
- An intentional deviation with no comment
