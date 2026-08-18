# Viewsets

Every read and write endpoint in the API. This file owns the access declaration
and the queryset; serializers are [04](./04-serializers.md).

## The rule

**Every ViewSet declares `permission_classes` explicitly.**

Not "when it differs from the default". Always. A reader must be able to see an
endpoint's access policy without opening `settings.py`, and a ViewSet that omits
the declaration is a bug even on the day the default happens to be correct.

This is the direct fix for two real defects:

| Ref | What happened |
|---|---|
| **S1** | `permission_classes = [permissions.AllowAny]` on `ProductViewSet` (a `ModelViewSet`) left the entire catalog open to anonymous writes. Same on `ProductImageViewSet`, `ProductAttributeViewSet`, `ProductColorViewSet`. |
| **S2** | `CategoryViewSet` and `BrandViewSet` declared nothing, so the project default `IsAuthenticatedOrReadOnly` applied — and any logged-in shopper could create or delete categories and brands. |

S2 is the more instructive one. Nobody wrote a bad rule; somebody wrote *no*
rule and inherited one that was wrong for that resource. Silence is not a
default you can review.

## Anatomy

```python
from rest_framework import viewsets
from api.permissions import IsAdminOrReadOnly
from .models import Product
from .serializers import ProductListSerializer, ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    # 1. Access. Always present, always first — it is the most important line.
    permission_classes = [IsAdminOrReadOnly]

    # 2. Data. select_related for FKs, prefetch_related for reverse/M2M.
    queryset = (
        Product.objects.select_related("category", "brand")
        .prefetch_related("images", "attributes", "colors")
    )

    # 3. Shape. List and detail are different endpoints with different costs.
    serializer_class = ProductSerializer

    # 4. Query surface.
    filterset_fields = ["category", "brand", "is_active", "is_featured"]
    search_fields = ["title", "productcode", "description"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        return ProductSerializer
```

## Choosing the permission class

Import from `api/permissions.py` — the copy of
[`security-hardening/assets/permissions.py`](../../security-hardening/assets/permissions.py).
Do not hand-write these; a hand-written permission class is where S6 came from.

| Resource | Class | Why |
|---|---|---|
| `Product`, `ProductImage`, `ProductAttribute`, `ProductColor` | `IsAdminOrReadOnly` | Storefront must browse without an account; only staff mutate |
| `Category`, `Brand` | `IsAdminOrReadOnly` | Same. This is the S2 fix |
| `CustomUser` | `IsAdminOnly` | Even the list of accounts is privileged |
| `Order` | `IsStaffOrOwner` + queryset scoping | Customer sees their own; staff see all |
| `Review` | `IsOwnerOrReadOnly` | Anyone reads; only the author edits |
| `GodownReceive`, `GodownDispatch` | `HasRole("inventory_manager")` | `is_staff` cannot express "may move stock but not change prices" |
| `Party` (suppliers), `buying_price` fields | `IsAdminOnly` | Commercially sensitive |
| Contact form, newsletter | `IsAdminOrWriteOnly` | Anyone submits; only staff read |
| Sales reports | `HasRole("showroom_manager", "admin")` | |

## Queryset scoping is not optional for owner-scoped resources

`has_object_permission` is **never called for a list route**. DRF only invokes
it from `get_object()`, which list does not use.

```python
# WRONG — IsStaffOrOwner is declared, and GET /orders/ still returns every
# customer's orders to every logged-in customer.
class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrOwner]
    queryset = Order.objects.all()
```

```python
# RIGHT — the permission class guards detail routes; the queryset guards list.
class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrOwner]
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = (
            Order.objects.select_related("user")
            .prefetch_related("items__attribute__product")
        )
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        return qs.filter(user=user)
```

The same gap exists on **create**: `has_object_permission` is not called on POST
either, because there is no object yet. Ownership on create is set server-side,
never accepted from the body:

```python
    def perform_create(self, serializer):
        # NOT serializer.save(user=self.request.data["user"]) — that lets a
        # customer create an order in someone else's name.
        serializer.save(user=self.request.user)
```

## Actions

Custom actions inherit the ViewSet's `permission_classes` unless overridden.
Override whenever the action's risk differs from the resource's:

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from api.permissions import IsAdminOnly


class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrOwner]

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOnly])
    def dispatch_to_courier(self, request, pk=None):
        # A customer may read their own order. They may not dispatch it.
        ...

    @action(detail=True, methods=["get"], url_path="invoice")
    def invoice(self, request, pk=None):
        # Inherits IsStaffOrOwner — correct, the owner may fetch their invoice.
        ...
```

An action that reads a `throttle_scope` needs `ScopedRateThrottle` in
`throttle_classes` — see
[security-hardening/02-throttling.md](../../security-hardening/references/02-throttling.md).

## ReadOnlyModelViewSet

If a resource has no write path, use `ReadOnlyModelViewSet` rather than a
`ModelViewSet` with a restrictive permission class. It removes the routes
entirely instead of guarding them, which is a smaller surface and a clearer
statement of intent.

```python
class SalesReportViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasRole("showroom_manager", "admin")]
```

## N+1

A nested serializer without `prefetch_related` issues one query per row per
nesting level. `ProductSerializer` with four nested read-only serializers over a
200-product catalog is 800+ queries for one request. (Audit ref: P4.)

The fix is on the ViewSet, not the serializer — the serializer cannot know what
the queryset fetched:

- `select_related` for forward FK / OneToOne. Adds a JOIN, one query total.
- `prefetch_related` for reverse FK / ManyToMany. One extra query per relation.

Verify with `assertNumQueries` rather than by eye:

```python
def test_product_list_query_count(client, django_assert_num_queries):
    with django_assert_num_queries(4):   # 1 count + 1 page + 2 prefetch
        client.get("/api/products/")
```

## Verification

```bash
# The permission matrix. Run for products, categories AND brands — S2 was
# found on the two that looked too boring to check.
for R in products categories brands; do
  echo "-- $R"
  curl -s -o /dev/null -w '  anon:     %{http_code}\n' -X POST localhost:8000/api/$R/ \
    -H 'Content-Type: application/json' -d '{}'
  curl -s -o /dev/null -w '  customer: %{http_code}\n' -X POST localhost:8000/api/$R/ \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' -d '{}'
done
# expect: anon 401, customer 403 — on every resource

# Owner scoping: a customer's list must contain only their own rows.
curl -s localhost:8000/api/orders/ -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  | python -c "import sys,json; d=json.load(sys.stdin); print({o['user'] for o in d['results']})"
# expect: exactly one user id — their own
```

```bash
# Find every ViewSet that forgot to declare access.
grep -rn "class .*ViewSet" --include=views.py . -A 6 | grep -B 4 -L "permission_classes"
```

Better, as a test that cannot be skipped:

```python
def test_every_viewset_declares_permissions():
    """No ViewSet may inherit the default. (S2)"""
    from rest_framework.viewsets import GenericViewSet
    missing = [
        cls.__name__
        for cls in all_subclasses(GenericViewSet)
        if "permission_classes" not in cls.__dict__
    ]
    assert not missing, f"ViewSets without explicit permission_classes: {missing}"
```

## Common mistakes

- **Omitting `permission_classes` because the global default is fine.** The
  default is a backstop, not policy. *(S2)*
- **Declaring the class and forgetting the queryset scope.** List routes leak
  every row.
- **Accepting an owner id from the request body.** Set it from `request.user` in
  `perform_create`.
- **Putting `select_related` in the serializer.** It has no effect there — the
  queryset is already evaluated.
- **`queryset = Model.objects.all()` as a class attribute on an owner-scoped
  resource.** It is evaluated once at import; use `get_queryset()` so it can see
  `request.user`.
- **A custom `@action` that performs a privileged operation while inheriting a
  permissive class.** Dispatch, refund, price change and role change all need
  their own declaration.
