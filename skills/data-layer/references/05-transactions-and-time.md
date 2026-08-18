# Transactions and time

Atomicity, race conditions, and the timezone bug that made every daily report
wrong.

## Atomicity

An order is not one row. It is an `Order`, several `OrderItem`s, and a stock
decrement. Half of that written is corrupt data.

```python
from django.db import transaction

@transaction.atomic
def place_order(user, cart_items, address):
    order = Order.objects.create(user=user, shipping_address=address, total_amount=0)
    total = Decimal("0.00")
    for item in cart_items:
        ...
    order.total_amount = total
    order.save(update_fields=["total_amount"])
    return order
```

Any exception rolls back everything. Without it, an error partway through leaves
an order with three of its five items and a total that matches neither.

`ATOMIC_REQUESTS = True` wraps every request instead. It is safer by default but
holds a transaction open for the entire request — including any external HTTP
call — so a slow courier API exhausts the connection pool. Prefer explicit
`@transaction.atomic` on the writes that need it.

### Side effects go after commit

```python
# WRONG — the email is sent, then the transaction rolls back. The customer has
# an invoice for an order that does not exist.
@transaction.atomic
def place_order(...):
    order = Order.objects.create(...)
    send_invoice_email(order)
    ...
```

```python
# RIGHT
transaction.on_commit(lambda: queue_invoice_email(order.id))
```

`on_commit` fires only if the transaction actually commits, and never on
rollback. Everything with an outside effect belongs there: email, courier
dispatch, cache invalidation, webhooks, SMS.

Pass an **id**, not the object — see `jobs-and-integrations`.

## Race conditions

Two customers order the last unit at the same time:

```python
# WRONG — both requests read stock=1, both write stock=0, both succeed
attr = ProductAttribute.objects.get(pk=pk)
if attr.stock_quantity >= qty:
    attr.stock_quantity -= qty
    attr.save()
```

Read-check-write across two statements is never safe under concurrency. Two
fixes:

**`select_for_update`** — locks the row until the transaction ends:

```python
with transaction.atomic():
    attr = ProductAttribute.objects.select_for_update().get(pk=pk)
    if attr.stock_quantity < qty:
        raise ValidationError({"quantity": f"Only {attr.stock_quantity} left."})
    attr.stock_quantity -= qty
    attr.save(update_fields=["stock_quantity"])
```

Must be inside `atomic()` — outside one it silently does nothing. Always lock
rows in a consistent order across the codebase, or two transactions locking the
same two rows in opposite orders deadlock.

**`F()` expressions** — the arithmetic happens in the database, no read needed:

```python
updated = ProductAttribute.objects.filter(pk=pk, stock_quantity__gte=qty).update(
    stock_quantity=F("stock_quantity") - qty
)
if not updated:
    raise ValidationError({"quantity": "Insufficient stock."})
```

The condition is in the `WHERE` clause, so it is evaluated atomically with the
write. `updated == 0` means someone got there first. This is cheaper than a lock
and is the better default for a single-row counter.

After an `F()` update the in-memory object is stale — call `refresh_from_db()`
before reading the value.

> This project permits negative stock by design (**C6**), so the godown can
> oversell pending reconciliation. Apply the guard on the web checkout path,
> not on the inventory adjustment path.

## Idempotency

A double-submitted checkout creates two orders. The customer is charged twice.

```python
key = request.headers.get("Idempotency-Key")
if key:
    existing = Order.objects.filter(user=request.user, idempotency_key=key).first()
    if existing:
        return Response(OrderSerializer(existing).data, status=200)
```

With `unique_together = ("user", "idempotency_key")`, the database enforces it
even when two requests race past the check.

The client generates the key once per checkout attempt — `crypto.randomUUID()`
when the form mounts, not per submit.

## Timezone

Audit finding **C2**: `TIME_ZONE = 'UTC'` with `USE_TZ = True`. Bangladesh is
UTC+6, so a "day" split at 06:00 local. Every daily total counted six hours of
the wrong day's orders.

```python
TIME_ZONE = "Asia/Dhaka"
USE_TZ = True
```

`USE_TZ = True` stores UTC in the database and converts on the way out —
correct, and unrelated to the bug. `TIME_ZONE` sets the local zone for
conversion, and it was the default.

### Never use naive dates for "today"

```python
# WRONG — server's idea of today, in UTC
today = datetime.date.today()
Order.objects.filter(created_at__date=today)
```

```python
# RIGHT
from django.utils import timezone
today = timezone.localdate()          # Asia/Dhaka
Order.objects.filter(created_at__date=today)
```

`__date` converts to `TIME_ZONE` before comparing, so with the setting correct
this now works. It also cannot use an index on `created_at` — for a large table,
filter on a range instead:

```python
start = timezone.make_aware(datetime.combine(today, time.min))
Order.objects.filter(created_at__gte=start, created_at__lt=start + timedelta(days=1))
```

### Store `business_date` explicitly

For a day book or ledger, do not derive the business day from a timestamp:

```python
class DayBookEntry(models.Model):
    business_date = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Two reasons. A business day may not align with a calendar day — a shop closing
at 01:00 books those sales to the previous day. And a derived value silently
changes if `TIME_ZONE` is ever corrected again, rewriting history.

This is the second half of the C2 fix, and the more important one.

## Verification

```python
from django.conf import settings
assert settings.TIME_ZONE == "Asia/Dhaka"
assert settings.USE_TZ is True
```

```bash
grep -rn "datetime.now()\|date.today()\|datetime.today()" --include=*.py . \
  | grep -v migrations
# PASS: no output — use timezone.now() / timezone.localdate()
```

```python
# Rollback leaves nothing behind.
def test_failed_order_creates_no_rows(self):
    before = Order.objects.count()
    with self.assertRaises(ValidationError):
        place_order(user, [{"product": p, "quantity": 0}], addr)
    self.assertEqual(Order.objects.count(), before)

# No email on rollback.
def test_no_email_when_order_fails(self):
    with self.assertRaises(ValidationError):
        place_order(...)
    self.assertEqual(len(mail.outbox), 0)
```

Concurrency, with real threads — a single-threaded test cannot catch a race:

```python
from concurrent.futures import ThreadPoolExecutor

def test_last_unit_sells_once(self):
    attr = ProductAttribute.objects.create(stock_quantity=1, ...)
    with ThreadPoolExecutor(max_workers=2) as ex:
        results = [f.result for f in [ex.submit(try_order, attr.pk) for _ in range(2)]]
    self.assertEqual(sum(1 for r in results if r), 1)
```

Requires a real database (MySQL, not SQLite in-memory) and
`TransactionTestCase`.

## Common mistakes

- Multi-row writes without `atomic()`
- Email or an API call inside the transaction instead of `on_commit`
- Read-check-write on a counter
- `select_for_update()` outside `atomic()`
- Reading a value after an `F()` update without `refresh_from_db()`
- Locking rows in inconsistent order — deadlock
- No idempotency key on checkout
- `datetime.date.today()` instead of `timezone.localdate()`
- Deriving a business date from a timestamp
