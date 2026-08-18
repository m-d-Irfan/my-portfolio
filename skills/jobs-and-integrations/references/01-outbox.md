# Outbox

Deferred work with no worker process.

## Why not a thread

**C3**, as shipped: `orders/views.py:203` called `send_invoice_email_task(...)`
synchronously inside `place_order`. The customer's checkout waited on Gmail's
SMTP. The docstring at `utils.py:11` claimed it ran in a thread; `threading` was
imported in two files and never used.

The obvious fix is worse than it looks:

```python
# WRONG — the fix that looks right
threading.Thread(target=send_invoice_email_task, args=(order.id,), daemon=True).start()
```

Four failure modes, all silent:

1. **Passenger kills idle processes.** The thread dies mid-send with the
   worker. `daemon=True` guarantees it is not waited for.
2. **No retry.** An SMTP blip loses the invoice permanently.
3. **No record.** Nothing distinguishes "sent" from "the process died"; you
   cannot answer "did the customer get it".
4. **A thread started inside a transaction can read rows that never commit** —
   it sends an invoice for an order that rolled back.

## The shape that works

```
request   ──► write an OutboxMessage row inside the transaction
              return immediately
commit    ──► the row is durable
cron      ──► drain_outbox sends it within a few minutes
```

The row commits with the order, so it cannot be lost. If the process dies
mid-send, the next drain retries. If the order rolls back, so does the message.

```python
# orders/views.py
with transaction.atomic():
    order = Order.objects.create(...)
    OrderItem.objects.bulk_create(items)
    enqueue_invoice_email(order, base_url)      # a row, not a send
return Response(OrderSerializer(order).data, status=201)
```

Copy [`assets/outbox.py`](../assets/outbox.py). The model, `enqueue()`, the
handlers and `drain()` are all there.

## Inside the transaction, or on_commit?

**Write the outbox row inside** the transaction — that is what ties its fate to
the data.

**`transaction.on_commit` is for anything that must not happen if the
transaction rolls back and cannot be a row** — cache invalidation, a metric,
a websocket push.

```python
# RIGHT
with transaction.atomic():
    order = Order.objects.create(...)
    enqueue_invoice_email(order, base_url)          # row, committed together

# ALSO RIGHT, for non-durable side effects
transaction.on_commit(lambda: cache.delete(f'orders:{user.id}'))

# WRONG — sends for an order that may roll back
with transaction.atomic():
    order = Order.objects.create(...)
    send_mail(...)
```

Note `on_commit` callbacks do **not** run under `django_db` in tests, because
the test transaction never commits. `testing-harness` covers
`django_capture_on_commit_callbacks`.

## Idempotency (N10)

Every job runs twice eventually — a retry after a lost response, a duplicated
cron, a manual re-run at 2am.

The key is **unique in the database and checked before the work**, never a flag
set after: the process can die between doing the work and recording that it did.

```python
enqueue(Kind.INVOICE_EMAIL, {...}, idempotency_key=f"invoice:{order.pk}")
```

A second call with the same key is a no-op. Derive the key from the *logical*
work — the order id — not from a UUID generated per call, or every retry
enqueues a fresh row.

The same rule applies to order creation itself. A double-submitted checkout must
create one order:

```python
key = request.headers.get('Idempotency-Key')
order, created = Order.objects.get_or_create(
    idempotency_key=key,
    defaults={...},
)
if not created:
    return Response(OrderSerializer(order).data, status=200)   # 200, not 201
```

`data-layer/05` owns the column and the constraint. `forms-and-validation` owns
the client generating the key once per form instance rather than per click —
one per click is no protection at all.

## Retry vs dead-letter

| Failure | Class | Action |
|---|---|---|
| Timeout, connection reset | Transient | Retry |
| 500, 502, 503, 504 | Transient | Retry |
| 429 | Transient | Retry, respecting `Retry-After` |
| 400, 422 | Permanent | Dead-letter |
| 401, 403 | Permanent | Dead-letter **and alert** — a credential is wrong |
| 404 | Permanent | Dead-letter |
| Malformed address, missing row | Permanent | Dead-letter |

Retrying a permanent failure is a busy loop that never succeeds and buries the
real error under thousands of log lines.

Backoff is exponential with jitter: 1min, 5min, 15min, 1hr, 6hr, then
dead-letter. Jitter matters — without it, everything that failed together
retries together and re-DDoSes a recovering provider.

The 401 row deserves an alert rather than a quiet dead-letter. It usually means
a credential was rotated and not deployed, which is the same class of silent
failure as C1.

## Draining

```bash
*/5 * * * * cd /home/user/daf_backend && \
  /home/user/virtualenv/daf_backend/3.11/bin/python manage.py drain_outbox \
  >> /home/user/logs/outbox.log 2>&1
```

Absolute paths — cron's `PATH` does not include the virtualenv. Redirect both
streams, or a failing job is indistinguishable from one that never ran.

Two properties make overlapping runs safe:

- **A bounded batch** (20). Cron may fire again before the previous run
  finishes; an unbounded drain of a backlog can outlive its own process.
- **`select_for_update(skip_locked=True)`.** The second run skips rows the
  first has claimed, instead of blocking or double-sending.

Frequency: every 5 minutes for email. For anything a user waits on, 1 minute —
and reconsider whether it should be synchronous with a hard timeout instead.

## Monitoring the queue

A queue nobody watches is a queue that silently stops.

```python
# In the health check — jobs-and-integrations/05.
oldest = OutboxMessage.objects.filter(status='pending').order_by('created_at').first()
backlog_age = (timezone.now() - oldest.created_at).total_seconds() if oldest else 0
dead = OutboxMessage.objects.filter(status='failed').count()
```

Alert when the oldest pending message is over 30 minutes old (cron has stopped,
or everything is failing) or when dead-lettered count grows. Both are visible in
`/health/` so an uptime monitor catches them.

Dead-lettered rows are re-runnable after the cause is fixed:

```bash
python manage.py shell -c "
from common.models import OutboxMessage
from django.utils import timezone
OutboxMessage.objects.filter(status='failed', kind='invoice_email').update(
    status='pending', attempts=0, next_attempt_at=timezone.now())"
```

Which is a good reason to dead-letter rather than delete.

## What still belongs in the request

- Validation, and the database write itself.
- A payment *verification* the user is actively waiting on — with a hard
  timeout under 15 seconds and a defined timeout path.

Everything else — email, SMS, courier dispatch, PDF rendering, webhooks out,
cache warming, report generation — goes to the outbox.

## Verification

```bash
# 1. No thread-based background work (C3).
grep -rn "threading.Thread\|Thread(" --include=*.py . | grep -v test
# PASS: no output

# 2. No send inside a view or signal.
grep -rnE "send_mail|EmailMessage|requests\.(get|post)" \
  --include=views.py --include=signals.py .
# PASS: no output

# 3. Checkout is fast.
curl -s -o /dev/null -w '%{time_total}\n' -X POST .../api/orders/place_order/ \
  -H "Authorization: Bearer $TOKEN" -d '{"items":[{"attribute":1,"quantity":1}]}'
# PASS: under 1.0

# 4. Double submit creates one order (N10).
for i in 1 2; do
  curl -s -X POST .../api/orders/place_order/ \
    -H "Authorization: Bearer $TOKEN" -H 'Idempotency-Key: test-key-123' \
    -d '{"items":[{"attribute":1,"quantity":1}]}' | python -c 'import json,sys;print(json.load(sys.stdin)["id"])'
done
# PASS: the same id twice

# 5. The drain works, and is idempotent.
python manage.py drain_outbox
python manage.py drain_outbox
# PASS: the second run sends nothing

# 6. Nothing is stuck.
python manage.py shell -c "
from common.models import OutboxMessage
from django.utils import timezone
o = OutboxMessage.objects.filter(status='pending').order_by('created_at').first()
print('oldest pending:', (timezone.now()-o.created_at) if o else 'none')
print('dead-lettered:', OutboxMessage.objects.filter(status='failed').count())"
# PASS: oldest under 30 minutes; dead-letter count understood and not growing

# 7. Cron is actually running.
tail -20 ~/logs/outbox.log
# PASS: recent timestamps
```

Check 7 is the one nobody runs until email has been broken for a week.
