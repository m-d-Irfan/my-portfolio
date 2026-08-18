# Server authority

This file owns one rule, and it is the most important rule in this skill: **the client may propose; only the server decides.**

## The rule

Every value that affects money, ownership, privilege or state must be **computed or looked up by the server**, never read from the request body and saved.

The client is not a component of your system. It is a program running on hardware you do not control, which an attacker can rewrite, replace, or skip entirely. Your React app is a convenience for honest users. `curl` is the real client.

The correct mental model for any request handler:

> The request body is a set of **claims made by a stranger**. Some claims are inputs you genuinely need (which product, how many, where to ship). Some claims are answers to questions only the server may answer (what it costs, who owns it, whether it is paid). Accepting the second kind is the bug.

The test for which is which: **if the user benefits from lying about this field, the server must decide it.**

## What must never be trusted

| Field | Why the client cannot decide it | Server decides by |
| --- | --- | --- |
| Unit price | User pays less | Reading `ProductAttribute.discountedPrice`/`mainPrice` |
| Discount / coupon amount | User pays less | Looking up the coupon, validating dates and eligibility |
| `total_amount` | User pays less | Summing item subtotals after creation |
| Tax | User pays less | Applying the rule to the server-computed subtotal |
| Shipping cost | User pays less | Zone/weight table lookup |
| `stock_quantity` | Buy what does not exist; corrupt inventory | The current DB value, adjusted transactionally |
| `role`, `is_staff`, `is_superuser` | Privilege escalation | Never writable outside a staff-only endpoint |
| `user` / owner id | Attribute records to, or steal them from, others | `request.user` |
| `status` (order) | Mark unpaid orders as completed | A state machine, staff-gated |
| Payment confirmation | Free goods | The payment provider's API |
| `transaction_id` | Free goods | Verifying against bKash |
| `created_at` and timestamps | Backdate to fit an expired promotion | `timezone.now()` |
| Related object IDs | Reference records the user does not own | Re-fetch and check ownership |
| `is_active`, `is_featured` | Publish or unpublish catalog entries | Staff-only serializer fields |
| `buying_price` | Corrupt margin reporting | Inventory-role endpoints only |

`created_at` is not a hypothetical on this project. `OrderSerializer` declares `created_at = serializers.DateTimeField(required=False)` with `fields = '__all__'`, so it is writable: a client can post an order dated last year, or dated into the future, landing it outside every report the business runs.

## S5: the worked example

This is the real bug, and it is the reason this file exists.

### The vulnerable code

```python
class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    created_at = serializers.DateTimeField(required=False)

    class Meta:
        model = Order
        fields = '__all__'          # includes total_amount, status, user

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = Order.objects.create(**validated_data)       # total_amount from the body
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)   # price from the body
        return order
```

`OrderItemSerializer` has `price` in its `fields`. `OrderSerializer` uses `fields = '__all__'`, which includes `total_amount`, `status` and `user`. Both are written straight through.

### The exploit

```bash
curl -X POST https://api.delhialuminium.com/orders/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "total_amount": "1.00",
    "status": "completed",
    "payment_method": "cod",
    "contact_number": "01700000000",
    "street_address": "House 12, Road 4, Dhanmondi",
    "city": "Dhaka",
    "items": [
      {"product": 42, "attribute": 118, "quantity": 10, "price": "0.10"}
    ]
  }'
```

Ten units of a ৳45,000 item, ordered for ৳1, marked `completed` so it skips payment review, and shipped. The attacker needs no special access — an ordinary customer token, or none at all through `/place_order/`, which is `AllowAny`.

Nothing here is a "hack". Every field was a documented part of the API.

### The fix

```python
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from product.models import ProductAttribute
from .models import Order, OrderItem

import logging

logger = logging.getLogger('security.audit')


class OrderItemWriteSerializer(serializers.ModelSerializer):
    """Input for one line. Note what is NOT here: price."""

    class Meta:
        model = OrderItem
        fields = ['product', 'attribute', 'quantity']

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError('Quantity must be at least 1.')
        if value > 100:
            raise serializers.ValidationError('Contact us directly for orders above 100 units.')
        return value


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemWriteSerializer(many=True, write_only=True)

    class Meta:
        model = Order
        # Explicit allowlist. `fields = '__all__'` is how S5 happened: adding a
        # field to the model silently made it client-writable.
        fields = [
            'items', 'payment_method', 'street_address', 'city',
            'customer_name', 'customer_email', 'contact_number',
            'bkash_number', 'transaction_id',
        ]
        # Server-decided. Present on the model, absent from the input.
        read_only_fields = ['total_amount', 'status', 'user', 'created_at',
                            'consignment_id', 'tracking_code', 'platform']

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('An order must contain at least one item.')
        return value

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']

        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            total_amount=Decimal('0.00'),     # placeholder; recomputed below
            status='pending',                 # never from the client
            platform='website',
            **validated_data,
        )

        calculated_total = Decimal('0.00')

        for item_data in items_data:
            attribute = item_data.get('attribute')
            quantity = item_data['quantity']

            if attribute is None:
                raise serializers.ValidationError(
                    {'items': 'Every line must name a product variant.'}
                )

            # Re-fetch under a row lock. Two reasons: the price must come from
            # the database, and the lock makes the stock check below correct
            # under concurrency.
            attribute = (
                ProductAttribute.objects
                .select_for_update()
                .select_related('product')
                .get(pk=attribute.pk)
            )

            if not attribute.product.is_active:
                raise serializers.ValidationError(
                    {'items': f'{attribute.product.name} is no longer available.'}
                )

            if attribute.stock_quantity < quantity:
                raise serializers.ValidationError(
                    {'items': f'Only {attribute.stock_quantity} left of '
                              f'{attribute.product.name} ({attribute.name}).'}
                )

            # THE price rule for this project: the discounted price when one is
            # set and positive, otherwise the main price. Never the client's.
            unit_price = (
                attribute.discountedPrice
                if attribute.discountedPrice and attribute.discountedPrice > 0
                else attribute.mainPrice
            )

            subtotal = unit_price * quantity
            calculated_total += subtotal

            OrderItem.objects.create(
                order=order,
                product=attribute.product,
                attribute=attribute,
                quantity=quantity,
                price=unit_price,
            )

            attribute.stock_quantity -= quantity
            attribute.save(update_fields=['stock_quantity'])

        # Total is the sum of what was actually created, not a number anyone sent.
        order.total_amount = calculated_total
        order.save(update_fields=['total_amount'])
        return order
```

Four properties make this correct, and each maps to a specific attack:

1. **`price` is absent from the input serializer.** Not read-only — absent. A field that does not exist cannot be set by a future refactor that changes `read_only_fields`.
2. **`unit_price` is read from a re-fetched `ProductAttribute`.** Not from the client's copy, and not from the instance DRF resolved during validation, because `select_for_update()` must run inside the transaction for the lock to mean anything.
3. **`total_amount` is the sum of the lines that were actually created.** It is derived, not asserted. There is no code path where it can disagree with the items.
4. **`status` is hardcoded to `'pending'`.** Order state advances through a staff-gated transition, never through order creation.

### Treat client values as advisory, and log mismatches

The client legitimately needs to *show* a total — the cart displays ৳45,000 before submission. Accept that number as a **claim to be checked**, never as the value to store.

```python
def validate(self, attrs):
    """Compare the client's claimed total against the server's. Never adopt it."""
    claimed = self.initial_data.get('total_amount')
    if claimed is None:
        return attrs

    try:
        claimed = Decimal(str(claimed))
    except (TypeError, ValueError, ArithmeticError):
        return attrs

    expected = Decimal('0.00')
    for item in attrs.get('items', []):
        attribute = item.get('attribute')
        if attribute is None:
            continue
        unit = (
            attribute.discountedPrice
            if attribute.discountedPrice and attribute.discountedPrice > 0
            else attribute.mainPrice
        )
        expected += unit * item['quantity']

    if claimed != expected:
        request = self.context['request']
        logger.warning(
            'ORDER_TOTAL_MISMATCH actor=%s ip=%s claimed=%s expected=%s',
            getattr(request.user, 'pk', None) or 'anonymous',
            request.META.get('REMOTE_ADDR'),
            claimed,
            expected,
        )
        # Do NOT reject on mismatch alone. A stale cart after a price change is
        # the common cause and it is innocent. The server's number is used
        # either way; the log entry is what turns a repeated mismatch from one
        # actor into a visible attack signal (N9).
    return attrs
```

The judgement here matters. Rejecting every mismatch breaks honest customers whose cart went stale during a sale change. Silently ignoring it discards the single clearest signal that someone is probing your pricing. Log it, use the server's number, and alert on repetition.

## The pattern, field by field

### Price

WRONG:

```python
OrderItem.objects.create(
    order=order,
    product_id=item_data.get('product'),
    quantity=item_data.get('quantity'),
    price=item_data.get('price'),          # the client's number
)
```

Also WRONG — the fallback in the current `place_order`, which is a real backdoor:

```python
if attr_id:
    try:
        attr = ProductAttribute.objects.get(id=attr_id)
        unit_price = attr.discountedPrice if (attr.discountedPrice and attr.discountedPrice > 0) else attr.mainPrice
    except ProductAttribute.DoesNotExist:
        unit_price = item_data.get('price') or 0    # <-- falls back to the client
else:
    unit_price = item_data.get('price') or 0        # <-- and again
```

The lookup is correct. The **fallbacks defeat it entirely**: omit `attribute` from the payload, or send a non-existent id, and the client's price is used. The secure path is bypassed by leaving out one field.

RIGHT — no fallback exists:

```python
attribute = get_object_or_404(ProductAttribute.objects.select_related('product'), pk=attr_id)
unit_price = (
    attribute.discountedPrice
    if attribute.discountedPrice and attribute.discountedPrice > 0
    else attribute.mainPrice
)
```

A missing or unknown attribute is a 400. It is never a licence to trust the client.

**The general principle: a secure path with an insecure fallback is an insecure path.** Attackers do not take the branch you tested.

### Ownership

WRONG:

```python
serializer.save()                            # `user` came from fields = '__all__'
Order.objects.create(user_id=request.data.get('user'), ...)
```

RIGHT:

```python
def perform_create(self, serializer):
    serializer.save(user=self.request.user)
```

`request.user` is derived from the signed JWT. The attacker cannot forge it without `SECRET_KEY` (`03-settings-hardening.md`, `04-secrets.md`).

### Role and staff flags

WRONG:

```python
class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = '__all__'                   # is_staff, is_superuser, role all writable
```

Any customer then does:

```bash
curl -X PATCH https://api.delhialuminium.com/users/57/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"is_superuser": true, "is_staff": true, "role": "admin"}'
```

RIGHT — the current serializer already gets this right; keep it that way:

```python
class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'street_address', 'city', 'phone_number', 'profile_picture',
            'role', 'date_joined', 'is_active', 'is_staff', 'is_superuser',
        ]
        read_only_fields = ['id', 'date_joined', 'otp', 'is_staff',
                            'is_active', 'is_superuser', 'role']
```

Role changes go through a dedicated, staff-only, audited endpoint:

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from api.permissions import IsAdminOnly


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOnly]

    @action(detail=True, methods=['post'], url_path='set-role')
    def set_role(self, request, pk=None):
        target = self.get_object()
        new_role = request.data.get('role')

        if new_role not in dict(CustomUser.ROLE_CHOICES):
            return Response({'error': 'Unknown role.'}, status=status.HTTP_400_BAD_REQUEST)

        if target.pk == request.user.pk:
            return Response(
                {'error': 'You cannot change your own role.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous = target.role
        target.role = new_role
        target.is_staff = new_role in ('admin', 'showroom_manager', 'inventory_manager')
        target.save(update_fields=['role', 'is_staff'])

        AuditLog.objects.create(
            actor=request.user,
            action='user.role_changed',
            target_type='CustomUser',
            target_id=str(target.pk),
            before={'role': previous},
            after={'role': new_role},
            ip=request.META.get('REMOTE_ADDR'),
        )
        return Response({'role': target.role})
```

The self-change guard prevents a compromised staff account quietly promoting itself to superuser, and it means the audit trail always has a distinct actor and target.

### Order status

WRONG — a customer marks their own COD order as paid:

```python
serializer = self.get_serializer(instance, data=request.data, partial=partial)
```

The current `OrderViewSet.update` mitigates this by stripping the field for non-staff:

```python
data = request.data.copy()
if not (request.user.is_staff or request.user.is_superuser):
    data.pop('status', None)
```

That is correct as far as it goes, but it is a denylist — it names the one field to remove. Add `total_amount` and someone will forget. And staff are still unconstrained: any staff member can move any order to any status, so a `cancelled` order can be resurrected to `completed`.

RIGHT — a state machine:

```python
ALLOWED_TRANSITIONS = {
    'pending':    {'processing', 'cancelled'},
    'processing': {'shipped', 'cancelled'},
    'shipped':    {'completed', 'cancelled'},
    'completed':  set(),          # terminal
    'cancelled':  set(),          # terminal
}


def transition_order(order, new_status, actor, ip=None):
    current = order.status
    if new_status not in ALLOWED_TRANSITIONS.get(current, set()):
        raise serializers.ValidationError(
            f'An order cannot move from {current} to {new_status}.'
        )
    order.status = new_status
    order.save(update_fields=['status'])
    AuditLog.objects.create(
        actor=actor,
        action='order.status_changed',
        target_type='Order',
        target_id=str(order.pk),
        before={'status': current},
        after={'status': new_status},
        ip=ip,
    )
    return order
```

Terminal states are terminal. Restoring a completed or cancelled order is a new order, not an edit — which also keeps the accounting honest.

### Stock

WRONG — read, decide, write, with a gap in between:

```python
attribute = ProductAttribute.objects.get(pk=attr_id)
if attribute.stock_quantity >= quantity:            # check
    attribute.stock_quantity -= quantity            # decide, on a stale value
    attribute.save()                                # write
```

Two customers ordering the last unit simultaneously both read `stock_quantity = 1`, both pass the check, both write `0`. You have sold two units of one item — and if the requests are crafted, an attacker races deliberately to buy stock you do not have.

RIGHT — lock the row, or use an atomic conditional update:

```python
from django.db import transaction
from django.db.models import F

with transaction.atomic():
    attribute = ProductAttribute.objects.select_for_update().get(pk=attr_id)
    if attribute.stock_quantity < quantity:
        raise serializers.ValidationError('Not enough stock.')
    attribute.stock_quantity = F('stock_quantity') - quantity
    attribute.save(update_fields=['stock_quantity'])
```

Or, without holding a lock, let the database enforce it:

```python
updated = (
    ProductAttribute.objects
    .filter(pk=attr_id, stock_quantity__gte=quantity)
    .update(stock_quantity=F('stock_quantity') - quantity)
)
if not updated:
    raise serializers.ValidationError('Not enough stock.')
```

The second form does the check and the write in one statement, so there is no window. `updated == 0` means someone else got there first.

`select_for_update()` requires a transaction and does nothing on SQLite — which this project uses in development. Test concurrency against MySQL, or the protection exists only in production where you cannot observe it failing.

### Related object IDs

WRONG:

```python
receive = GodownReceive.objects.get(pk=request.data['receive_id'])
receive.notes = request.data['notes']
receive.save()
```

An integer in the body selects any row in the table. This is IDOR, and it is the most common serious API bug there is.

RIGHT — scope the lookup to what the actor may reach:

```python
receive = get_object_or_404(
    GodownReceive.objects.filter(created_by=request.user),
    pk=request.data['receive_id'],
)
```

The ownership condition is in the **queryset**, so a non-owner gets 404. A 404 is better than a 403 here: a 403 confirms the record exists, which is a free bit of information for an enumeration attack.

For nested writes, validate that referenced objects belong together:

```python
def validate(self, attrs):
    product = attrs['product']
    attribute = attrs.get('attribute')
    if attribute and attribute.product_id != product.pk:
        # Otherwise: order a cheap product with an expensive product's SKU,
        # or vice versa, by mixing IDs across rows.
        raise serializers.ValidationError('That variant does not belong to that product.')
    return attrs
```

### Timestamps

WRONG:

```python
created_at = serializers.DateTimeField(required=False)      # in the real serializer today
```

RIGHT:

```python
read_only_fields = ['created_at']
```

If staff genuinely need to backdate a phone order, that is a separate staff-only field with its own audit entry — never the same field the public endpoint writes.

## bKash: never trust a transaction ID

`Order` has `payment_method` in `('bkash', 'cod')`, plus `bkash_number` and `transaction_id`. Today `transaction_id` is whatever the client typed.

That means:

```bash
curl -X POST https://api.delhialuminium.com/place_order/ \
  -H 'Content-Type: application/json' \
  -d '{
    "payment_method": "bkash",
    "transaction_id": "9XYZ1A2B3C",
    "bkash_number": "01700000000",
    "contact_number": "01700000000",
    "street_address": "House 12, Road 4", "city": "Dhaka",
    "order_items": [{"product": 42, "attribute": 118, "quantity": 5}]
  }'
```

An invented transaction ID, and the order enters fulfilment as paid. Nobody checked with bKash.

A manually-reconciled flow — someone in the office matching IDs against the merchant statement — is a legitimate business process, but then the order must **not** be treated as paid until that reconciliation happens. The failure is not the manual step; it is that the record says paid before anyone looked.

RIGHT — verify against the provider, and model payment state separately from order state:

```python
import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger('security.audit')


class PaymentVerificationError(Exception):
    pass


def _bkash_token():
    """Grant tokens are short-lived; cache below their TTL."""
    token = cache.get('bkash_grant_token')
    if token:
        return token
    response = requests.post(
        f"{settings.BKASH_BASE_URL}/tokenized/checkout/token/grant",
        json={
            'app_key': settings.BKASH_APP_KEY,
            'app_secret': settings.BKASH_APP_SECRET,
        },
        headers={
            'username': settings.BKASH_USERNAME,
            'password': settings.BKASH_PASSWORD,
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    token = payload['id_token']
    cache.set('bkash_grant_token', token, timeout=int(payload.get('expires_in', 3600)) - 60)
    return token


def verify_bkash_payment(order, trx_id):
    """Confirm with bKash that this transaction exists, succeeded, and matches.

    Three properties must ALL hold. Checking only that the ID exists lets an
    attacker replay someone else's genuine transaction ID — including one for
    ৳50 against a ৳50,000 order.
    """
    response = requests.post(
        f"{settings.BKASH_BASE_URL}/tokenized/checkout/general/searchTransaction",
        json={'trxID': trx_id},
        headers={
            'Authorization': _bkash_token(),
            'X-App-Key': settings.BKASH_APP_KEY,
            'Content-Type': 'application/json',
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()

    if data.get('transactionStatus') != 'Completed':
        raise PaymentVerificationError('That transaction has not completed.')

    if Decimal(str(data.get('amount', '0'))) < order.total_amount:
        logger.warning(
            'PAYMENT_AMOUNT_MISMATCH order=%s trx=%s paid=%s expected=%s',
            order.pk, trx_id, data.get('amount'), order.total_amount,
        )
        raise PaymentVerificationError('The amount paid does not cover this order.')

    if data.get('currency') not in (None, 'BDT'):
        raise PaymentVerificationError('Unexpected currency.')

    # Replay guard: a transaction ID settles exactly one order. Enforced by a
    # unique constraint, not by this check alone.
    if Order.objects.filter(transaction_id=trx_id).exclude(pk=order.pk).exists():
        logger.warning('PAYMENT_REPLAY order=%s trx=%s', order.pk, trx_id)
        raise PaymentVerificationError('That transaction has already been used.')

    return data
```

And the model:

```python
class Order(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('pending_verification', 'Pending verification'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]
    payment_status = models.CharField(
        max_length=24, choices=PAYMENT_STATUS_CHOICES, default='unpaid',
    )
    transaction_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    payment_verified_at = models.DateTimeField(null=True, blank=True)
```

`unique=True` on `transaction_id` is the control that actually prevents replay — the check above races, the database constraint does not. (Note: MySQL treats NULLs as distinct, so multiple COD orders with a NULL `transaction_id` remain valid.)

The rules, stated plainly:

- A client-supplied `transaction_id` sets `payment_status = 'pending_verification'`, never `'paid'`.
- Only a successful provider response, or a named staff member's explicit reconciliation, sets `'paid'`.
- The verified amount must be **at least** `order.total_amount`, in BDT (৳).
- One transaction ID settles one order, enforced by a unique constraint.
- Failed verification is logged with actor and IP — repeated failures from one account are the clearest fraud signal you will get.

For COD there is no transaction to verify. The equivalent control is that `payment_status` becomes `'paid'` on delivery confirmation, from the courier integration or a staff action, never from the customer.

## N10: idempotency on order creation

A double-click, a flaky mobile connection retrying, or a user hitting back-and-resubmit all create duplicate orders. With no idempotency, `POST /place_order/` twice creates two orders, two stock decrements and two invoice emails. It is also an abuse primitive: replay a COD order a thousand times and someone books a thousand courier pickups.

The fix is a client-generated key that the server enforces.

```python
import uuid

from django.db import models


class IdempotencyKey(models.Model):
    """One row per (key, endpoint). The unique constraint is the whole mechanism."""

    key = models.CharField(max_length=64)
    endpoint = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['key', 'endpoint'], name='uniq_idempotency_key'),
        ]
        indexes = [models.Index(fields=['created_at'])]
```

```python
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.response import Response


class OrderViewSet(viewsets.ModelViewSet):

    def create(self, request, *args, **kwargs):
        idem_key = request.headers.get('Idempotency-Key')
        if not idem_key:
            return Response(
                {'error': 'An Idempotency-Key header is required to place an order.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        endpoint = 'orders.create'

        # Replay: return the stored response rather than creating a second order.
        existing = IdempotencyKey.objects.filter(key=idem_key, endpoint=endpoint).first()
        if existing is not None:
            if existing.response_status is None:
                # First request is still in flight — a genuine double-submit.
                return Response(
                    {'error': 'That order is already being processed.'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(existing.response_body, status=existing.response_status)

        try:
            with transaction.atomic():
                record = IdempotencyKey.objects.create(
                    key=idem_key,
                    endpoint=endpoint,
                    user=request.user if request.user.is_authenticated else None,
                )
                response = super().create(request, *args, **kwargs)
                record.response_status = response.status_code
                record.response_body = response.data
                record.save(update_fields=['response_status', 'response_body'])
                return response
        except IntegrityError:
            # Two requests raced past the SELECT above. The unique constraint,
            # not the check, is what guarantees only one order exists.
            return Response(
                {'error': 'That order is already being processed.'},
                status=status.HTTP_409_CONFLICT,
            )
```

The key must be generated **once per checkout attempt**, not per request — regenerating it on retry defeats the whole mechanism:

```jsx
import { useRef, useState } from 'react';
import api from '../js/api';

export default function useCheckout() {
  // Created once when the checkout screen mounts. Every retry of THIS attempt
  // reuses it, so a retry after a timeout cannot create a second order.
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);

  const placeOrder = async (payload) => {
    if (submitting) return null;              // UX guard, not the control
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders/', payload, {
        headers: { 'Idempotency-Key': idempotencyKey.current },
      });
      return data;
    } finally {
      setSubmitting(false);
    }
  };

  return { placeOrder, submitting };
}
```

Purge old keys on a schedule — 24 hours is ample for retry windows:

```python
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Delete idempotency keys older than 24 hours.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=24)
        deleted, _ = IdempotencyKey.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(f'Deleted {deleted} expired idempotency keys.')
```

## Guest checkout

`place_order` is `AllowAny` because guest checkout is a product requirement. That is a legitimate decision, and it changes nothing about server authority — if anything it raises the stakes, since there is no account to hold accountable.

For an unauthenticated order:

- `user` is `None`. It is never taken from the body.
- Every price is recomputed exactly as above.
- The `order_create` throttle applies (`02-throttling.md`).
- An `Idempotency-Key` is still required.
- `/orders/<id>/track/` must not be a bare integer lookup. `Order.objects.get(pk=pk)` under `AllowAny` lets anyone walk `/orders/1/track/`, `/orders/2/track/` and read every customer's name, total and status. Use a random `tracking_token` (`uuid4`), or require the order id together with the contact number used to place it.

```python
class Order(models.Model):
    tracking_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
```

```python
@action(detail=False, methods=['get'], url_path=r'track/(?P<token>[0-9a-f-]{36})',
        permission_classes=[AllowAny])
def track(self, request, token=None):
    order = get_object_or_404(Order, tracking_token=token)
    ...
```

A 122-bit random token is not enumerable. A sequential integer is.

## Reviewing for this class of bug

Grep for the shapes. Each of these is a finding until proven otherwise:

```bash
# Serializers that expose everything the model has
grep -rn "fields = '__all__'" --include=serializers.py .

# Money read from the request
grep -rnE "request\.data\.get\(['\"](price|total|total_amount|discount|amount)" --include=*.py .

# Privilege read from the request
grep -rnE "request\.data(\.get\()?\[?['\"](is_staff|is_superuser|role|user)" --include=*.py .

# Unscoped lookups by a client-supplied id
grep -rnE "objects\.get\(\s*(pk|id)\s*=\s*request\.data" --include=*.py .

# Saves with no owner assignment
grep -rn "serializer.save()" --include=views.py .
```

Then read for the fallback pattern — a correct server-side lookup followed by `except ...: value = request.data...`. That is S5's actual shape, and grep alone will not show it to you.

The three questions for any write endpoint:

1. **Which fields in this payload does the user benefit from lying about?** Every one of them must be server-decided or ignored.
2. **If I send this request with `curl`, skipping the React app entirely, what stops me?** If the answer names anything in the frontend, there is no answer.
3. **What happens if I send it twice, simultaneously?** If the answer is "two orders" or "stock goes negative", you need idempotency or a lock.

## Checklist

- [ ] No serializer that accepts writes uses `fields = '__all__'`.
- [ ] `price`, `total_amount`, `discount`, `tax`, `shipping` appear in no write serializer's `fields`.
- [ ] Every unit price is read from a re-fetched `ProductAttribute`, with **no** client fallback.
- [ ] `total_amount` is computed as the sum of created `OrderItem` subtotals.
- [ ] `user` is assigned from `request.user` in `perform_create`.
- [ ] `is_staff`, `is_superuser`, `role`, `is_active`, `otp` are read-only in every customer-facing serializer.
- [ ] `status` changes go through the transition table and are audited.
- [ ] Stock decrements use `select_for_update()` or a conditional `.update()`.
- [ ] `created_at` is read-only.
- [ ] `transaction_id` is `unique=True` and never sets `payment_status = 'paid'` on its own.
- [ ] bKash payments are verified against the provider for status, amount and currency.
- [ ] `POST /orders/` and `/place_order/` require an `Idempotency-Key`.
- [ ] Order tracking uses a random token, not a sequential id.

## Related

- `references/01-permissions.md` — who reaches the endpoint at all
- `references/02-throttling.md` — bounding abuse of endpoints that must stay open
- `references/07-threat-model.md` — the server-authority section of the pre-ship review, and the audit log (N9)
- `checklists/pre-deploy-security.md` — the verifiable gate
