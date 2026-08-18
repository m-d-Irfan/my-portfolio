# Queries

Making the ORM issue the queries you think it does.

## The N+1

Audit finding **P4**: `ProductSerializer` used `fields = '__all__'` with four
nested read-only serializers and no `select_related`/`prefetch_related` on the
viewset queryset. One request for 50 products issued 200+ queries.

```python
# WRONG
queryset = Product.objects.all()
# Serializing 50 products with nested category, brand, images, attributes:
#   1 for products
# + 50 for category   (one per row)
# + 50 for brand
# + 50 for images
# + 50 for attributes
# = 201 queries
```

```python
# RIGHT
queryset = (
    Product.objects
    .select_related("category", "brand")            # JOIN — forward FK
    .prefetch_related("images", "attributes")       # 2nd query — reverse FK / M2M
)
# = 3 queries, regardless of row count
```

Which to use:

| Relation | Method | Mechanism |
|---|---|---|
| `ForeignKey`, `OneToOneField` (forward) | `select_related` | SQL JOIN, one query |
| Reverse FK, `ManyToManyField` | `prefetch_related` | Separate query, joined in Python |

`select_related` on a reverse relation raises. `prefetch_related` on a forward FK
works but costs an extra query where a JOIN would do.

## Filtering a prefetch

```python
from django.db.models import Prefetch

queryset = Product.objects.prefetch_related(
    Prefetch(
        "images",
        queryset=ProductImage.objects.filter(is_active=True).order_by("sort_order"),
        to_attr="active_images",
    )
)
```

Then the serializer reads `obj.active_images` — a plain list, already in memory.

The trap this avoids:

```python
# WRONG — .filter() on a prefetched relation discards the prefetch and issues
# a fresh query per row. The N+1 you just removed, back again.
def get_images(self, obj):
    return ProductImageSerializer(obj.images.filter(is_active=True), many=True).data

# RIGHT — iterate what was prefetched
def get_images(self, obj):
    return ProductImageSerializer(obj.active_images, many=True).data
```

Any queryset method on a prefetched relation — `.filter()`, `.exclude()`,
`.order_by()`, `.count()` — re-queries. Only iteration and `len()` use the cache.

## `only` and `defer`

```python
Product.objects.only("id", "title", "slug", "price")
```

Useful when a table has large columns (`description`, JSON blobs) that a list
view does not need. But touching a deferred field later triggers a query *per
row*, which is worse than fetching it once.

Use `only()` when the field list is genuinely fixed — a list serializer with
explicit `fields`. Never combine it with `fields = '__all__'`.

## Aggregate in the database

```python
# WRONG — loads every order into Python to add up a column
total = sum(o.total_amount for o in Order.objects.all())

# RIGHT
from django.db.models import Count, Sum
total = Order.objects.aggregate(total=Sum("total_amount"))["total"] or 0
```

`aggregate` returns one dict for the whole queryset; `annotate` adds a column
per row:

```python
Product.objects.annotate(review_count=Count("reviews"))
```

Beware multiple `annotate(Count(...))` calls across different relations — the
JOINs multiply and the counts come out wrong. Use `distinct=True`, or separate
subqueries:

```python
from django.db.models import OuterRef, Subquery

Product.objects.annotate(
    review_count=Subquery(
        Review.objects.filter(product=OuterRef("pk"))
        .values("product").annotate(c=Count("id")).values("c")
    )
)
```

## `exists` and `count`

```python
if Order.objects.filter(user=user).exists():   # SELECT 1 ... LIMIT 1
if Order.objects.filter(user=user).count():    # COUNT(*) over the whole table
if Order.objects.filter(user=user):            # loads every row into memory
```

Use `exists()` for presence, `count()` when you need the number, and never
truthiness on a queryset.

If you are about to iterate the rows anyway, `len(qs)` on an evaluated queryset
is free — `count()` there is a second query.

## Bulk operations

```python
# 1000 queries
for item in items:
    OrderItem.objects.create(**item)

# 1
OrderItem.objects.bulk_create([OrderItem(**item) for item in items])
```

`bulk_create` and `bulk_update` do not call `save()`, do not fire signals, and
do not run `full_clean()`. That is exactly why database constraints matter —
see `references/02-constraints-and-indexes.md`.

`.update()` is likewise a single UPDATE with no signals:

```python
Order.objects.filter(status="pending", created_at__lt=cutoff).update(status="expired")
```

## Iterating large tables

```python
# Loads every row into memory
for order in Order.objects.all():

# Streams in chunks
for order in Order.objects.iterator(chunk_size=2000):
```

Use `iterator()` in management commands and exports. It cannot be combined with
`prefetch_related` on older Django versions, and it disables the queryset cache
— so do not use it where you iterate twice.

## Pagination is not optional

An endpoint returning an unbounded list is a denial-of-service vector against
your own database. `PAGE_SIZE = 20` is set globally in
`django-backend-builder/assets/settings.py`; do not override it to something
large on an endpoint that can grow.

Deep offset pagination degrades — `LIMIT 20 OFFSET 100000` makes MySQL scan
100,020 rows. For large tables use keyset pagination:

```python
Order.objects.filter(created_at__lt=last_seen_created_at).order_by("-created_at")[:20]
```

## Measure

```python
from django.db import connection, reset_queries

reset_queries()
list(Product.objects.all()[:50])
print(len(connection.queries))
```

Requires `DEBUG = True`. In tests, assert it:

```python
def test_product_list_query_count(self):
    # Fails if someone adds a nested serializer without a prefetch.
    with self.assertNumQueries(4):
        self.client.get("/api/products/")
```

Pin the number. A range hides the regression this test exists to catch.

`django-debug-toolbar` shows the same information interactively, including
duplicate queries and which line issued them.

## Verification

```bash
# Nested serializers whose viewset has no prefetch.
grep -rn "many=True, read_only=True" */serializers.py
# For each hit, confirm the corresponding viewset queryset prefetches it.

grep -rn "\.objects\.all()" */views.py
# Review each — a bare .all() feeding a nested serializer is P4.
```

```python
# Query count is bounded and does not grow with row count.
with self.assertNumQueries(4):
    self.client.get("/api/products/")          # 5 products
create_products(50)
with self.assertNumQueries(4):                 # same number
    self.client.get("/api/products/")
```

The second assertion is the real test: a constant query count under a 10×
increase in rows is what "no N+1" actually means.

## Common mistakes

- Nested serializer with no `prefetch_related` (**P4**)
- `.filter()` on a prefetched relation, discarding the prefetch
- `select_related` on a reverse relation
- Aggregating in Python
- Multiple `annotate(Count(...))` producing multiplied counts
- Truthiness on a queryset
- `count()` immediately before iterating
- `bulk_create` while relying on `save()` or signals
- Unbounded list endpoints
- `assertNumQueries` with a loose range
