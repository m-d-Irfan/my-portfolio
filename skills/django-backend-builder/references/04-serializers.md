# Serializers

The shape of every payload. This file owns field selection, list-vs-detail
splitting, and server-side recomputation of anything that matters.

## The two rules

1. **List and detail are different endpoints with different costs.** Never serve
   a detail-shaped payload from a list route.
2. **Never persist a value that arrived in a request body if the server can
   compute it.** Price, total, ownership, status, stock.

## Rule 1: split the serializer

`fields = '__all__'` with four nested read-only serializers over a full catalog
produced a payload the storefront then filtered client-side, plus an N+1 across
every product. (Audit refs: P1, P4.)

```python
# WRONG — one serializer for both routes.
class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    colors = ProductColorSerializer(many=True, read_only=True)
    features = ProductFeatureSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = "__all__"
```

Two separate problems in that block:

- `fields = "__all__"` means a field added to the model later is published
  automatically. That is how internal columns — `buying_price`, an OTP, an
  internal note — reach the public API without anyone deciding to publish them.
  **Always enumerate fields.**
- The four nested serializers are needed on a product page and wasted on a grid.

```python
# RIGHT — a lean list serializer and a full detail serializer.
class ProductListSerializer(serializers.ModelSerializer):
    """Grid and search results. No nested collections."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    image = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "title", "slug", "productcode",
            "category", "category_name", "brand", "brand_name",
            "is_active", "is_featured", "image", "min_price",
        ]

    def get_image(self, obj):
        # obj.images is prefetched by the viewset. Iterating the prefetched list
        # costs nothing; calling .filter() here would issue a fresh query per
        # row and reintroduce the N+1 the prefetch was meant to remove.
        main = next((i for i in obj.images.all() if i.is_main), None) or next(
            iter(obj.images.all()), None
        )
        if not main:
            return None
        request = self.context.get("request")
        url = main.image.url
        return request.build_absolute_uri(url) if request else url

    def get_min_price(self, obj):
        prices = [
            a.discountedPrice if a.discountedPrice and a.discountedPrice > 0 else a.mainPrice
            for a in obj.attributes.all()
        ]
        return min(prices) if prices else None


class ProductSerializer(serializers.ModelSerializer):
    """Product detail page. Everything."""

    images = ProductImageSerializer(many=True, read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    colors = ProductColorSerializer(many=True, read_only=True)
    features = ProductFeatureSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "title", "slug", "productcode", "description",
            "category", "category_name", "brand", "brand_name",
            "is_active", "is_featured",
            "images", "attributes", "colors", "features",
            "created_at", "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]
```

Wire it in the ViewSet with `get_serializer_class()` — see
[05-viewsets.md](./05-viewsets.md).

## Rule 2: recompute anything that matters

`total_amount` and per-item `price` were read straight from the request body and
saved. A crafted POST bought anything for ৳1. (Audit ref: S5.)

```python
# WRONG — the client sends the price and the server believes it.
def place_order(request):
    order = Order.objects.create(
        user=request.user,
        total_amount=request.data["total_amount"],
    )
    for item in request.data["items"]:
        OrderItem.objects.create(
            order=order,
            attribute_id=item["attribute"],
            quantity=item["quantity"],
            price=item["price"],
        )
```

```python
# RIGHT — the client proposes; the server prices.
from decimal import Decimal
from django.db import transaction
from rest_framework import serializers


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemInputSerializer(many=True, write_only=True)

    class Meta:
        model = Order
        fields = ["id", "items", "shipping_address", "payment_method", "total_amount"]
        # The client MAY send these — the frontend needs them to show a cart
        # total — but they are read-only, so what it sends is discarded.
        read_only_fields = ["total_amount"]

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(user=self.context["request"].user, **validated_data)

        # select_for_update: two concurrent orders for the last unit must not
        # both succeed. See data-layer/04-atomicity.md.
        attr_ids = [i["attribute"].id for i in items_data]
        attrs = {
            a.id: a
            for a in ProductAttribute.objects.select_for_update().filter(id__in=attr_ids)
        }

        total = Decimal("0.00")
        for item in items_data:
            attr = attrs[item["attribute"].id]
            # The price comes from the database, every time.
            unit = (
                attr.discountedPrice
                if attr.discountedPrice and attr.discountedPrice > 0
                else attr.mainPrice
            )
            qty = item["quantity"]
            OrderItem.objects.create(
                order=order, attribute=attr, quantity=qty, price=unit
            )
            total += unit * qty

        order.total_amount = total
        order.save(update_fields=["total_amount"])
        return order
```

**Log the mismatch.** A client total that disagrees with the server total is
either a stale cart or an attack, and you want to know which:

```python
        claimed = self.initial_data.get("total_amount")
        if claimed is not None and Decimal(str(claimed)) != total:
            logger.warning(
                "order.total_mismatch user=%s claimed=%s computed=%s",
                order.user_id, claimed, total,
            )
```

Full list of never-trust fields:
[security-hardening/06-server-authority.md](../../security-hardening/references/06-server-authority.md).

## Write-protecting privilege fields

A registration serializer that publishes `is_staff` is one-line privilege
escalation.

```python
class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=10)

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "password",
            "first_name", "last_name", "phone_number",
            "is_staff", "is_superuser", "role",
        ]
        # Present in the response so the client can render a role badge, and
        # ignored on input. Omitting this line lets anyone POST
        # {"is_staff": true} to /register/.
        read_only_fields = ["is_staff", "is_superuser", "role"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

Same for `Order.status`, `Order.user`, `ProductAttribute.stock_quantity`, and
every `*_at` timestamp.

## Validation belongs here, authorisation does not

A serializer validates *shape and consistency*. Whether the actor is allowed to
do it at all is a permission class.

```python
class OrderItemInputSerializer(serializers.Serializer):
    attribute = serializers.PrimaryKeyRelatedField(
        # Scope the queryset. The default publishes every row's id as a valid
        # input, including inactive and staff-only records.
        queryset=ProductAttribute.objects.filter(product__is_active=True)
    )
    quantity = serializers.IntegerField(min_value=1, max_value=999)

    def validate(self, attrs):
        attr = attrs["attribute"]
        if attr.stock_quantity < attrs["quantity"]:
            raise serializers.ValidationError(
                {"quantity": f"Only {attr.stock_quantity} in stock."}
            )
        return attrs
```

`PrimaryKeyRelatedField` with an unscoped queryset is a quiet IDOR: the client
supplies an id and DRF resolves it without asking whether this actor may
reference that row.

## Verification

```bash
# S5: the server must ignore a client-supplied price.
curl -s -X POST localhost:8000/api/orders/place_order/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"attribute":1,"quantity":1,"price":1}],"total_amount":1,
       "shipping_address":"x","payment_method":"cod"}' | python -m json.tool
# expect: total_amount is the real catalogue price, not 1

# Privilege escalation via registration.
curl -s -X POST localhost:8000/api/register/ -H 'Content-Type: application/json' \
  -d '{"email":"e@x.com","password":"correct-horse-battery","is_staff":true}' \
  | python -c "import sys,json; print('is_staff:', json.load(sys.stdin).get('is_staff'))"
# expect: False

# No serializer uses __all__.
grep -rn 'fields = .__all__.' --include=serializers.py .
# expect: no output
```

## Common mistakes

- **`fields = "__all__"`.** Publishes every future column automatically.
- **One serializer for list and detail.** Ships nested collections to a grid. *(P1)*
- **`.filter()` inside a `SerializerMethodField`.** Bypasses the prefetch and
  reintroduces the N+1. Iterate `obj.relation.all()` instead. *(P4)*
- **Trusting a price, total or status from the body.** *(S5)*
- **`is_staff` / `role` writable on any serializer.** Mark them read-only.
- **`PrimaryKeyRelatedField` with an unscoped queryset.** Quiet IDOR.
- **Business rules in `to_representation`.** It runs on every read; put
  computation in the queryset with `annotate()` instead.
