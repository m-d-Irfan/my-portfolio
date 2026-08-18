# Apps and domains

Modelling the business domain. Adapting the skeleton to e-commerce, CMS, SaaS or
a service portal.

Model *patterns* — abstract bases, constraints, indexes, atomicity, soft delete —
belong to the `data-layer` skill. This file is about what to model and how the
apps divide.

## Start from the transactions, not the entities

The usual instinct is to model nouns first: Product, Category, Brand. That
produces a clean diagram and misses the thing that actually constrains the
schema — what happens when money or stock moves.

Ask in this order:

1. What events change state irreversibly? (order placed, stock received, payment
   captured, invoice issued)
2. What must be true after each one? (stock decremented exactly once, total
   matches the sum of its lines, invoice number never reused)
3. What must survive deletion of everything around it? (the order line's price
   at the time of sale, even if the product is deleted and the price changed)

Answering 3 is what tells you which fields must be **denormalised on purpose**.

## Denormalise what history depends on

```python
class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    attribute = models.ForeignKey("product.ProductAttribute", on_delete=models.PROTECT)

    # Copied at the time of sale, deliberately. These are NOT a cache of the
    # product's current values — they are the historical record of what was
    # actually sold and for how much.
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    product_title = models.CharField(max_length=255)
    product_code = models.CharField(max_length=64, blank=True)
```

Without the copies, raising a price rewrites every historical invoice and last
quarter's revenue changes. `on_delete=PROTECT` stops a product deletion from
destroying order history; the title copy means an archived product still renders
on an old invoice.

The same applies to a shipping address: copy it onto the order. A customer
editing their saved address must not alter where a shipped order went.

## The domain shapes

### E-commerce

```
Category (self-referencing tree)
  └── Product
        ├── ProductImage        (is_main flag)
        ├── ProductAttribute    (size/variant + mainPrice, discountedPrice, stock_quantity)
        ├── ProductColor
        └── ProductFeature      ({name, value} pairs — spec table and filters)
Brand ──┘

Order ── OrderItem ── ProductAttribute
Party (supplier) ── GodownReceive / GodownDispatch ── stock movement
```

**Price lives on the variant, not the product.** A 4-foot and a 12-foot section
are different prices; the moment a product-level price exists, something will
read it.

**Stock lives on the variant too**, and a stock movement is an event, not an
edit. A `stock_quantity` integer that people adjust by hand cannot answer "why
is this number wrong" — a `GodownReceive`/`GodownDispatch` ledger can. If the
project maintains both, the ledger is the truth and the integer is a cache.

### CMS

```
Category ── Article ── ArticleBlock (ordered, typed content blocks)
Author ────┘
Tag (M2M)
```

Publication state is a workflow (`draft → review → scheduled → published`), not
a boolean. `published_at` in the future plus a filtered queryset gives you
scheduling for free.

### SaaS

```
Organisation ── Membership ── User
      └── Subscription ── Plan
      └── <every tenant-scoped model>
```

Every tenant-scoped model carries `organisation`, and **every queryset filters on
it**. This is the highest-risk pattern in the list: one endpoint that forgets the
filter leaks another customer's data. Enforce it with a base manager, not with
discipline.

### Service portal

```
Service ── Booking ── Slot
Customer ─┘
```

The hard part is the double-booking constraint. It belongs in the database as an
exclusion constraint, not in a `if Slot.objects.filter(...).exists()` check that
two concurrent requests both pass.

## Choices on the model, not in the code

```python
class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    PROCESSING = "processing", "Processing"
    SHIPPED = "shipped", "Shipped"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"
    RETURNED = "returned", "Returned"


class Order(models.Model):
    status = models.CharField(
        max_length=20, choices=OrderStatus.choices,
        default=OrderStatus.PENDING, db_index=True,
    )
```

`TextChoices` gives the admin a dropdown, DRF a validated field, and code a
constant instead of a string literal. Bare strings scattered across views are
how `"cancelled"` and `"canceled"` end up in the same table.

Transitions are a separate concern — a status field does not stop
`delivered → pending`. Put the allowed map on the model:

```python
    ALLOWED_TRANSITIONS = {
        OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
        OrderStatus.CONFIRMED: {OrderStatus.PROCESSING, OrderStatus.CANCELLED},
        OrderStatus.PROCESSING: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
        OrderStatus.SHIPPED: {OrderStatus.DELIVERED, OrderStatus.RETURNED},
        OrderStatus.DELIVERED: {OrderStatus.RETURNED},
        OrderStatus.CANCELLED: set(),
        OrderStatus.RETURNED: set(),
    }
```

## Money

```python
price = models.DecimalField(max_digits=12, decimal_places=2)
```

Never `FloatField`. `0.1 + 0.2 != 0.3` in binary floating point, and a total
assembled from floats drifts by paisa in a way that surfaces as an unexplainable
reconciliation gap months later.

`max_digits=12` allows up to ৳9,999,999,999.99. Size it for the largest
plausible order, not the typical one.

Use `Decimal` in Python too — `Decimal("19.99")`, from a string, never
`Decimal(19.99)`, which inherits the float's error.

## Signals, sparingly

A `post_save` signal that decrements stock is invisible at the call site. When
stock is wrong, nothing in `place_order()` explains why.

Use signals for genuinely cross-cutting concerns (audit log, cache
invalidation, search reindex). For domain logic that belongs to a transaction,
call it explicitly inside the `transaction.atomic` block that owns the change.

If a signal must exist, make it idempotent and guard it:

```python
@receiver(post_save, sender=Order)
def on_order_saved(sender, instance, created, **kwargs):
    if not created:
        return
    # Not `if instance.status == 'confirmed'` — post_save fires on every save,
    # and a status touched twice would fire twice.
```

## Verification

```bash
python manage.py makemigrations --check --dry-run   # no un-migrated model changes
python manage.py migrate --plan                     # review before applying

# No float columns holding money.
grep -rn "FloatField" --include=models.py . | grep -iE "price|amount|total|cost"
# expect: no output

# Every FK states on_delete deliberately — CASCADE on a business entity is
# almost always wrong.
grep -rn "ForeignKey" --include=models.py . | grep -c "on_delete"
```

## Related

- `data-layer` — abstract bases, constraints, indexes, atomicity, migrations
- [04-serializers.md](./04-serializers.md) — exposing these models over HTTP
- `api-contract` — keeping the serializer, the model and the frontend in step
