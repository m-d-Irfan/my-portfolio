# Payments and courier

The two integrations where a bug costs money.

## The rule

**The server decides what was paid and what ships. The client tells you
nothing.**

Every field the browser sends is an assertion by a party with an incentive to
lie. `security-hardening/06-server-authority.md` owns the principle; this file
applies it to the two places it matters most.

## bKash

### What the browser may send

A `paymentID` — bKash's own reference for a payment the user just completed.
That is all.

**Not** the amount. **Not** the status. **Not** a `transaction_id` you then
trust.

### S5, as shipped

```python
# WRONG — this was the code
transaction_id = request.data.get('transaction_id')
order.payment_status = 'paid'
order.transaction_id = transaction_id
order.save()
```

A client-supplied string was accepted as proof of payment. Anyone could POST an
arbitrary `transaction_id` and mark their order paid. There was no verification
call, no amount comparison, nothing.

### The verification flow

```python
def verify_bkash_payment(order, payment_id):
    """Server-side verification. The ONLY thing that marks an order paid."""
    client = BkashClient()
    result = client.post('/payment/execute', json={'paymentID': payment_id})

    # 1. The provider must say it succeeded.
    if result.get('transactionStatus') != 'Completed':
        raise PaymentNotCompleted(result.get('transactionStatus'))

    # 2. The amount must match what WE calculated. Never what the client sent.
    #    Decimal, not float — see data-layer/02.
    paid = Decimal(str(result['amount']))
    expected = order.recalculate_total()       # from prices in the database
    if paid != expected:
        log.error('bKash amount mismatch on order %s: paid %s, expected %s',
                  order.pk, paid, expected)
        raise PaymentAmountMismatch(paid, expected)

    # 3. The currency must match.
    if result.get('currency') != 'BDT':
        raise PaymentCurrencyMismatch(result.get('currency'))

    # 4. The trxID must not already belong to another order — replay.
    if Order.objects.filter(transaction_id=result['trxID']).exclude(pk=order.pk).exists():
        raise PaymentReplay(result['trxID'])

    return result
```

Then, and only then:

```python
with transaction.atomic():
    order = Order.objects.select_for_update().get(pk=order_id)
    if order.payment_status == 'paid':
        return order                    # idempotent — a double callback is a no-op
    verified = verify_bkash_payment(order, payment_id)
    order.payment_status = 'paid'
    order.transaction_id = verified['trxID']
    order.paid_amount = Decimal(str(verified['amount']))
    order.save(update_fields=['payment_status', 'transaction_id', 'paid_amount'])
    record(AuditLog.Action.PAYMENT_MARKED, target=order,
           changes={'payment_status': {'from': 'pending', 'to': 'paid'}})
```

Four properties: `select_for_update` so two concurrent callbacks serialise, an
early return so the second is a no-op, an amount compared against a
server-computed total, and an audit entry.

### The timeout case

A payment call that times out is the worst case in this document: the money may
have moved and you do not know.

- **Never** mark paid on timeout.
- **Never** mark failed on timeout.
- Set `payment_status = 'verifying'`, enqueue a re-query by `paymentID`, and
  tell the user "we're confirming your payment".
- The re-query is idempotent and can run as many times as needed.

A third state is not optional here. Two states force you to guess, and both
guesses are wrong some of the time — one gives away goods, the other charges a
customer for nothing.

### Credentials

`BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` — all
four server-side, grouped with `require_all`. None may ever reach the React
bundle. The browser receives a checkout script URL and a short-lived,
server-issued token; nothing replayable.

Grant tokens are short-lived — cache them until just before expiry rather than
requesting one per call, but never persist one past its TTL.

## COD

Cash on delivery has no gateway, which makes it easy to get wrong in a different
way.

- `payment_status` stays `pending` until the courier confirms collection.
- **Only a staff action or a courier status webhook** may mark it collected.
  Never a customer request.
- Record the amount collected — it can differ from the order total, and the
  difference is a real reconciliation problem, not a bug to hide.
- Every transition gets an audit entry (**N9**). "Who marked this COD order
  paid" is a question that gets asked.

## Steadfast courier

### C5: the field that went nowhere

```python
# serializers.py — read it off the payload into a private attribute
def create(self, validated_data):
    instance._courier_type = validated_data.pop('courier_type', 'manual')
    ...

# signals.py — read a DIFFERENT thing, defaulted, on a fresh instance
courier_type = getattr(instance, '_courier_type', 'manual')
```

The value was never persisted to a column. The signal ran on an instance
reloaded from the database, where `_courier_type` did not exist, so it always
took the `'manual'` default. Every order dispatched manually regardless of what
the admin selected — and because `'manual'` is a legitimate value, nothing looked
wrong.

Two rules fall out:

1. **If it affects behaviour, it is a column.** An instance attribute does not
   survive a reload, a `refresh_from_db`, or a signal on a re-fetched row.
2. **`getattr(obj, '_x', default)` is where behaviour goes to die.** The default
   silently becomes the only path. Prefer a field with `choices` and no default,
   so an unset value is a validation error.

```python
class Order(models.Model):
    class Courier(models.TextChoices):
        STEADFAST = 'steadfast', 'Steadfast'
        MANUAL = 'manual', 'Manual'

    courier_type = models.CharField(max_length=16, choices=Courier.choices)
    # No default. An unset value must fail validation, not pick a path.
```

### Dispatch

Dispatch is **not** synchronous with order placement. It goes to the outbox: the
customer must not wait on a courier API, and a courier outage must not prevent
checkout.

```python
with transaction.atomic():
    order = Order.objects.create(..., courier_type=validated['courier_type'])
    if order.courier_type == Order.Courier.STEADFAST:
        enqueue(Kind.COURIER_DISPATCH, {'order_id': order.pk},
                idempotency_key=f'dispatch:{order.pk}')
```

The handler:

```python
def handle_courier_dispatch(payload):
    order = Order.objects.get(pk=payload['order_id'])
    if order.consignment_id:
        return                        # already dispatched — idempotent

    result = SteadfastClient().post('/create_order', json={
        'invoice': str(order.pk),
        'recipient_name': order.name,
        'recipient_phone': order.phone,
        'recipient_address': order.address,
        'cod_amount': str(order.total if order.payment_method == 'cod' else 0),
    })

    order.consignment_id = result['consignment']['consignment_id']
    order.tracking_code = result['consignment']['tracking_code']
    order.save(update_fields=['consignment_id', 'tracking_code'])
```

`cod_amount` comes from the server-computed total. A client-supplied COD amount
is a way to have goods delivered for less than they cost.

The `if order.consignment_id: return` guard is the idempotency check — a retry
after a lost response must not create a second consignment. Where Steadfast
supports it, also send an idempotency key; where it does not, query by `invoice`
before creating.

### Tracking

Cache tracking responses for 5–15 minutes, keyed by consignment id. Customers
refresh a tracking page repeatedly, and the provider rate-limits.

A tracking failure is **not** an order failure. Return the last known status with
a note, not a 500. The order exists and shipped regardless of whether the
courier's API is answering.

### Status sync

Poll open consignments on a cron (every 15–30 minutes), or consume a signed
webhook if Steadfast offers one. Update order status from the courier's status,
and **audit** each transition — an order that moves to `delivered` without a
courier event is a manual override somebody should be able to find.

## Verification

```bash
# 1. No client-supplied transaction id trusted (S5).
grep -rn "data.get('transaction_id')\|data\['transaction_id'\]" --include=*.py .
# PASS: no output

# 2. No client-supplied amount trusted.
grep -rnE "data\.get\('(amount|total|price)'" --include=*.py .
# PASS: no output

# 3. courier_type is a real column (C5).
python manage.py shell -c "
from orders.models import Order
f = Order._meta.get_field('courier_type')
print('column:', f.column, '| choices:', bool(f.choices), '| default:', f.default)"
# PASS: a column, with choices, and NOT_PROVIDED as the default

# 4. No behaviour behind a private instance attribute.
grep -rnE "getattr\(instance, '_" --include=*.py .
# PASS: no output

# 5. Forged payment is rejected.
curl -s -X POST .../api/orders/1/confirm_payment/ \
  -H "Authorization: Bearer $TOKEN" -d '{"transaction_id":"FORGED123"}'
# PASS: 400/402, and the order is NOT paid

# 6. Amount mismatch is rejected.
#    Sandbox-pay 1 BDT against a 5000 BDT order.
# PASS: PaymentAmountMismatch, order unpaid, error logged

# 7. Double callback is idempotent.
#    POST the same paymentID twice.
# PASS: one paid order, one transaction_id, no second charge

# 8. Courier outage does not block checkout.
#    Point STEADFAST_BASE_URL at 10.255.255.1 and place an order.
# PASS: 201 in under a second; dispatch queued and retried

# 9. Dispatch is idempotent.
python manage.py drain_outbox && python manage.py drain_outbox
# PASS: one consignment id

# 10. Payment transitions are audited (N9).
python manage.py shell -c "
from common.models import AuditLog
print(AuditLog.objects.filter(action='payment_marked').count())"
# PASS: matches the number of paid orders
```

Checks 5 and 6 are the ones that would have caught S5 before a customer did.
