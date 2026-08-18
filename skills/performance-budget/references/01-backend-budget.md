# Backend budget

Queries and payload. Both budgets are per request, and both are testable.

| Budget | Limit |
|---|---|
| Queries per request | 10 |
| List response, gzipped | 100 KB |
| Order placement round trip | 1 s |
| TTFB | 600 ms |

## N+1 is the default, not the exception

A nested serializer over a queryset with no prefetch produces one query per row
per relation. This is what the ORM does; it is not a mistake anyone makes, it is
what happens when nobody does anything.

**P4, as shipped:**

```python
class ProductSerializer(serializers.ModelSerializer):
    images     = ProductImageSerializer(many=True, read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    color      = ProductColorSerializer(many=True, read_only=True)
    category   = CategorySerializer(read_only=True)

    class Meta:
        model  = Product
        fields = '__all__'          # every column, including buying_price

queryset = Product.objects.all()     # 1 + 50×4 = 201 queries for 50 products
```

**Fixed:**

```python
queryset = (
    Product.objects
    .select_related('category', 'brand')          # forward FK → JOIN
    .prefetch_related('images', 'attributes', 'color')   # reverse → one query each
)
# 5 queries, regardless of row count
```

`select_related` for forward `ForeignKey` and `OneToOne`. `prefetch_related`
for reverse FK and `ManyToMany`. `select_related` on a reverse relation raises;
`prefetch_related` on a forward FK works but costs an extra query.

**Pin it with a test in the same commit**, or the next serializer field
reintroduces it:

```python
def test_product_list_query_count(client, products_50):
    with assertNumQueries(5):
        client.get('/api/products/')
```

Exact, not a range. `assertNumQueries(5)` catches a regression to 6; `< 20`
hides it until it is 21. When the count legitimately changes, first confirm it
is still *constant* under more rows — then update the number.

## List vs detail serializer

A list endpoint must not return what only a detail view needs.

```python
class ProductListSerializer(serializers.ModelSerializer):
    """Catalogue grid: image, name, price. Nothing else."""
    class Meta:
        model  = Product
        fields = ['id', 'name', 'slug', 'productcode',
                  'category_name', 'brand_name', 'min_price',
                  'primary_image', 'is_active', 'is_featured']

def get_serializer_class(self):
    return ProductListSerializer if self.action == 'list' else ProductSerializer
```

The measured difference on this project's catalogue: ~2.1 MB → ~180 KB for the
same 200 products.

`fields = '__all__'` on a list is also a security problem — it publishes every
future column automatically, which is how `buying_price` reaches a customer.
`api-contract` owns that rule; the performance case and the security case point
the same way.

## Pagination is not optional

```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 24,
}
```

With `page_size_query_param` exposed, **cap it**:

```python
class StandardPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100          # without this, ?page_size=100000 is a free DoS
```

For a large or frequently-appended table, offset pagination degrades — the
database still walks the skipped rows, so page 500 is slow and a row inserted
mid-scroll shifts everything. Cursor pagination on `-created_at` fixes both.
Not needed below ~10k rows.

**Filtering and searching happen in the database.** `django-filter` and DRF's
`SearchFilter`, with `search_fields` indexed. P1 was the frontend fetching
everything and filtering in JavaScript — that is not a filter, it is a download.

## Aggregate in the database

```python
# WRONG — one query per order, then arithmetic in Python
total = sum(item.price * item.quantity for o in orders for item in o.items.all())

# RIGHT — one query
from django.db.models import Sum, F
total = OrderItem.objects.aggregate(
    total=Sum(F('price') * F('quantity'))
)['total']
```

Same for `Count`, `Avg`, `Min`, `Max` and for annotating a computed column onto
a list queryset. A `min_price` annotated in SQL costs nothing; a `min_price`
property evaluated per row in a serializer costs one query per row.

Use `.only()` / `.defer()` where a table has a large text or JSON column that
the list does not need — but measure first, because a deferred field touched
later triggers a query per row, which is worse than fetching it once.

## Do not do slow work inside the response

**C3** — the invoice email was sent synchronously inside `place_order`, so the
customer's checkout waited on SMTP. An SMTP timeout meant a 30-second checkout
and, on failure, a 500 for an order that had already been created.

Anything that talks to a third party — email, SMS, courier dispatch, payment
callback, PDF render — goes to the outbox. `jobs-and-integrations` owns the
pattern. From this skill's side the rule is only: **a request that makes a
network call to a third party cannot meet a 1 s budget**, because you do not
control the other end.

`transaction.on_commit` is the boundary. Inside the request: write the row.
After commit: enqueue. Never: block.

## Caching, after correctness

Cache only what is hot, stable, and expensive. In order of preference:

1. **A better query.** Free, permanent, no invalidation.
2. **An index.** `data-layer/02` owns which.
3. **`cached_property`** for something computed twice in one request.
4. **Redis, with an explicit TTL**, for a genuinely expensive aggregate —
   dashboard counts, category trees.
5. **HTTP caching** — `ETag` / `Last-Modified` on public catalogue reads, so a
   repeat visit gets a 304 and no body.

Never cache a response whose content depends on the user unless the cache key
includes the user. A per-user response in a shared cache leaks one customer's
orders to another — that is a security incident, not a perf bug.

`LocMemCache` is per-process. Behind four gunicorn workers you have four
independent caches with four different states — the same reason
`security-hardening/02` forbids it for throttling.

## Verification

```bash
# Query count on the hot endpoints.
pytest tests/test_query_budget.py -v
# PASS: green, exact counts

# Response size.
curl -s "http://localhost:8000/api/products/?page=1" | wc -c
# PASS: under 102400

# Response size gzipped, which is what actually ships.
curl -s -H 'Accept-Encoding: gzip' "http://localhost:8000/api/products/" | wc -c

# No unpaginated list endpoints.
grep -rn "class .*ViewSet" --include=views.py . | while read -r line; do
  f="${line%%:*}"; grep -Lq "pagination_class\|PAGE_SIZE" "$f" && echo "$f"
done
# PASS: no output, or the global default applies

# No __all__ on a list serializer.
grep -rn "fields = '__all__'" --include=serializers.py .
# PASS: no output

# Time an order placement.
curl -s -o /dev/null -w 'total: %{time_total}s\n' -X POST \
  http://localhost:8000/api/orders/place_order/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"attribute":1,"quantity":1}]}'
# PASS: under 1.0s
```

With `django-debug-toolbar` installed in dev, the SQL panel gives the count and
flags duplicates directly. It is the fastest way to find an N+1 and should be
the first thing opened when a page is slow.
