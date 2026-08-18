# Observability

Knowing what the system is doing, and who did what.

## Health check

One endpoint, checking real dependencies. A 200 from Django proves the process
booted, which is almost never the thing that broke.

```python
def health(request):
    checks = {}
    ok = True

    # Database — a real query, not just an open connection.
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        checks['database'] = 'ok'
    except Exception as exc:
        checks['database'] = f'error: {exc.__class__.__name__}'
        ok = False

    # Cache — required for throttling to work at all (N2).
    try:
        cache.set('health', '1', 10)
        checks['cache'] = 'ok' if cache.get('health') == '1' else 'error: no readback'
        ok = ok and checks['cache'] == 'ok'
    except Exception as exc:
        checks['cache'] = f'error: {exc.__class__.__name__}'
        ok = False

    # Outbox backlog — the check that catches a stopped cron.
    oldest = (OutboxMessage.objects
              .filter(status='pending').order_by('created_at').first())
    age = (timezone.now() - oldest.created_at).total_seconds() if oldest else 0
    checks['outbox_backlog_seconds'] = int(age)
    checks['outbox_dead_lettered'] = OutboxMessage.objects.filter(status='failed').count()
    if age > 1800:
        checks['outbox'] = 'error: backlog over 30 minutes'
        ok = False

    return JsonResponse({'status': 'ok' if ok else 'degraded', **checks},
                        status=200 if ok else 503)
```

Rules:

- **503 when degraded**, so an uptime monitor notices. A 200 with
  `"status": "degraded"` in the body is invisible to every monitor by default.
- **Public, and boring.** No version numbers, no hostnames, no settings, no
  stack traces — it is unauthenticated and it is the first thing an attacker
  reads.
- **Cheap.** It runs every 60 seconds forever. No aggregate queries.
- **Never call a third party from it.** Their outage is not your health, and a
  timeout in the health check makes your monitor report you down.

The outbox backlog check is the one that earns its place: a stopped cron is
otherwise invisible until a customer asks where their invoice is.

## Structured logging

Log lines are read by grep at 2am. Make them greppable.

```python
# WRONG — unfindable, and leaks
log.info(f'User {user.email} placed order for {amount}')

# RIGHT
log.info('order.placed', extra={
    'order_id': order.pk,
    'user_id': user.pk,             # id, not email — PII in logs is a liability
    'amount': str(order.total),
    'payment_method': order.payment_method,
    'request_id': request.request_id,
})
```

- **Dotted event names**: `order.placed`, `payment.verified`,
  `courier.dispatch.failed`. Greppable, aggregatable, and stable when the
  message wording changes.
- **IDs, not identities.** A log full of email addresses is a PII store with
  weaker access controls than the database.
- **Never a password, OTP, token, or a whole request body.** `/auth/login/`
  bodies contain passwords; `/auth/verify-otp/` bodies contain codes.
  `security-hardening/04-secrets.md` ships the redaction filter as a backstop —
  the control is not logging it.

Levels, used consistently:

| Level | Means | Example |
|---|---|---|
| `DEBUG` | Local only | Query shapes |
| `INFO` | Normal, worth knowing | `order.placed`, `outbox.drained` |
| `WARNING` | Recovered, or a retry | `integration.retry`, `throttle.hit` |
| `ERROR` | Something failed and a human should know | `payment.verify.failed` |
| `CRITICAL` | The system cannot function | Database unreachable |

If everything is `ERROR`, nothing is.

## Request IDs

One id per request, on every log line, returned to the client. It turns "a
customer says checkout failed at 3pm" into one grep.

```python
class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Accept an inbound id only from a trusted proxy — otherwise a client
        # can forge one and poison the logs. deploy-and-env/02 covers the proxy.
        incoming = request.headers.get('X-Request-ID', '')
        request.request_id = (incoming[:64] if incoming and settings.BEHIND_TLS_PROXY
                              else uuid.uuid4().hex[:16])
        response = self.get_response(request)
        response['X-Request-ID'] = request.request_id
        return response
```

Put it in the error envelope too (`api-contract/02`), so a support screenshot
carries the id.

## Error tracking

Sentry, or equivalent. The value is not that errors are recorded — it is
grouping, frequency, and the release that introduced them.

```python
sentry_sdk.init(
    dsn=env('SENTRY_DSN', default=''),
    environment=env('ENVIRONMENT', default='production'),
    release=env('RELEASE_SHA', default=''),
    traces_sample_rate=0.1,
    send_default_pii=False,          # never ship request bodies or user emails
    before_send=scrub_sensitive,     # strip Authorization, Cookie, password fields
)
```

`send_default_pii=False` and a `before_send` scrubber, both. The default
includes headers, and headers include `Authorization` — a bearer token in an
error report is a credential in a third-party SaaS.

An empty DSN disables it cleanly, so local development does not report.

## Audit log (N9)

Nothing recorded who changed a role, edited a price, adjusted stock, or modified
an order after placement. When a price is wrong or an account unexpectedly has
`is_staff`, there is no way to answer "who and when" — and that question is
exactly what step 5 of the secrets incident runbook depends on.

Copy [`assets/audit_log.py`](../assets/audit_log.py). What must be audited:

| Action | Why |
|---|---|
| Role or `is_staff` change | The first thing an attacker with admin access does |
| Price change | Money, and it is silently retroactive if not recorded |
| Stock adjustment | The ledger's integrity |
| Order edit after placement | Disputes |
| Order status change | Who marked it delivered |
| Manual payment marking | COD reconciliation |
| User deletion | Irreversible |
| Failed login (aggregate) | Credential stuffing detection |
| Permission denied on a staff endpoint | Someone probing |

Properties that make it an audit log rather than a table:

- **Append-only.** `save()` raises on an existing pk. A mutable audit log is
  the first thing edited by whoever it would incriminate.
- **`on_delete=SET_NULL` with `actor_label` preserved.** Deleting a user must
  not erase what they did.
- **Redacted.** Never a password hash, token or OTP in `changes`.
- **Never blocks the action.** An audit write failure logs an exception and
  returns; it does not roll back the operation being audited.

Pair a role change with a `token_version` bump (`auth-flows/06`), or the demoted
admin keeps access for the full token lifetime (**N4**).

## Metrics worth having

Without a metrics stack, a nightly management command emailing five numbers is
enough:

- Orders placed, and total value
- Outbox: pending, sent, dead-lettered
- Failed logins
- 5xx count
- p95 response time on `/api/products/` and `/place_order/`

The point is a *trend*. "37 dead-lettered" means nothing; "37, up from 2
yesterday" means the courier credentials were rotated and not deployed.

## What not to do

- **Do not log every request.** The web server already does. Application logs
  are for application events.
- **Do not log a whole response body.** Product lists fill a disk; order
  responses contain addresses.
- **Do not alert on a single failure.** One `/health/` failure is a blip; two
  consecutive is an outage. Alerts that cry wolf get muted, and a muted alert is
  no alert.
- **Do not put `print()` in production code.** It goes to `stderr.log`,
  unstructured, unlevelled, unredacted — and that file was tracked in git here.

## Verification

```bash
# 1. Health reports dependencies, not just liveness.
curl -sf https://api.example.com/health/ | python -m json.tool
# PASS: database, cache and outbox all reported

# 2. Degraded returns 503.
#    Stop Redis, then:
curl -s -o /dev/null -w '%{http_code}\n' https://api.example.com/health/
# PASS: 503

# 3. Health leaks nothing.
curl -s https://api.example.com/health/ | grep -iE "version|django|host|path|secret"
# PASS: no output

# 4. Request ids are returned and logged.
curl -sI https://api.example.com/api/products/ | grep -i x-request-id
# PASS: present, and the same id appears in the log line

# 5. No credential in the logs.
grep -rniE "password|otp|Bearer [A-Za-z0-9]|api[_-]key" ~/logs/*.log | grep -v REDACTED
# PASS: no output

# 6. No print() in production code.
grep -rn "print(" --include=*.py . | grep -v test | grep -v management/commands
# PASS: no output

# 7. Privileged actions are audited (N9).
python manage.py shell -c "
from common.models import AuditLog
for a in AuditLog.objects.order_by('-created_at')[:10]:
    print(a)"
# PASS: recent role changes, price edits and stock adjustments appear

# 8. The audit log is append-only.
python manage.py shell -c "
from common.models import AuditLog
e = AuditLog.objects.first()
try:
    e.action = 'tampered'; e.save(); print('FAIL: audit row was edited')
except ValueError as exc:
    print('PASS:', exc)"

# 9. Error tracking works.
python manage.py shell -c "raise RuntimeError('sentry smoke test')"
# PASS: it appears in Sentry within a minute, with no token in the payload
```

Check 9 is worth doing once per environment. Error tracking that was configured
and never verified is the most common form of "we have monitoring".
