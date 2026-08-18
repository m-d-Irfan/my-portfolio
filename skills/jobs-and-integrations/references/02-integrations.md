# Integrations

Calling a system you do not control.

## Assume it is broken

Every third-party call will, at some point: time out, return 500, return 200
with an unexpected body, rate-limit you, and be down for an hour. Write the
failure path first. It is the one that runs at 2am.

## Timeouts

**Every outbound call has an explicit timeout.** Without one, `requests`
inherits the socket default, which is effectively forever — one unresponsive
provider holds a gunicorn worker until the process is killed. With three workers
and a dead gateway, the whole site is down.

```python
# WRONG — no timeout
requests.post(url, json=payload)

# RIGHT
requests.post(url, json=payload, timeout=10)

# Better: (connect, read) separately
requests.post(url, json=payload, timeout=(3.05, 10))
```

Connect should be fast (3s) — a slow connect means DNS or a dead host. Read
depends on the work: 10s for a courier lookup, 15s for a payment.

```bash
grep -rnE "requests\.(get|post|put|patch|delete)\(" --include=*.py . | grep -v "timeout="
# PASS: no output
```

CI-enforceable, and worth enforcing.

## Fail loud on misconfiguration

**C1** is the canonical failure. Credentials read as
`os.environ.get('<the literal key>')` — the secret pasted in as the variable
name — so both were `None`. Then:

```python
# orders/views.py, OrderViewSet.track
api_key = getattr(settings, 'STEADFAST_API_KEY', '')
if api_key:                     # None is falsy, so this never ran
    ...dispatch...
```

Courier dispatch and tracking were dead in production for months. No exception,
no log line, no alert. The `if api_key:` guard — written to be defensive — is
what made it invisible.

```python
# WRONG — silently disables the feature
if settings.STEADFAST_API_KEY:
    dispatch(order)

# RIGHT — the client refuses to exist without its credentials
class SteadfastClient(IntegrationClient):
    name = 'steadfast'
    timeout = settings.STEADFAST_TIMEOUT_SECONDS

    def __init__(self):
        super().__init__(
            base_url=settings.STEADFAST_BASE_URL,
            credentials={
                'STEADFAST_API_KEY': settings.STEADFAST_API_KEY,
                'STEADFAST_SECRET_KEY': settings.STEADFAST_SECRET_KEY,
            },
        )

    def auth_headers(self):
        return {'Api-Key': settings.STEADFAST_API_KEY,
                'Secret-Key': settings.STEADFAST_SECRET_KEY}
```

`IntegrationClient.__init__` raises `ImproperlyConfigured` naming the missing
keys. Combined with `require_all()` in settings
(`deploy-and-env/01-env-contract.md`), a missing credential is a boot failure
rather than a feature that quietly does nothing.

The general rule: **a function that talks to a third party either does the work
or raises. It never returns `None` to mean "skipped".**

## Retries

Retry transient failures only — timeout, connection reset, 5xx, 429. See
[01-outbox.md](01-outbox.md) for the full classification table.

Exponential backoff **with jitter**:

```python
delay = base * (2 ** (attempt - 1))
delay += random.uniform(0, delay * 0.3)
```

Without jitter, every client that failed together retries together and
re-DDoSes a recovering provider.

Three retries in-request; more than that belongs in the outbox. A 15-second
payment call retried three times is a 45-second request, which is past every
proxy's own timeout anyway.

**Respect `Retry-After` on a 429.** Ignoring it is how a temporary rate limit
becomes a ban.

## Idempotency on the provider side

A timeout does not mean the call failed — it means the *response* was lost. The
charge may have gone through. Retrying without an idempotency key can create a
second charge or a second consignment.

```python
client.post('/create_order', json=payload, idempotency_key=f'order-{order.pk}')
```

Where the provider supports it (bKash does; check Steadfast's current API),
send it. Where they do not, **query before creating**: look up by your own
reference, and only create if absent.

## Circuit breaker

A provider outage should fail fast, not add its timeout to every request. Ten
concurrent checkouts against a dead gateway with a 15s timeout occupies every
worker for fifteen seconds — their outage becomes yours.

`IntegrationClient` opens the circuit after 5 consecutive failures and
half-opens after 60 seconds. A permanent 4xx does **not** count toward it — that
is your bug, not the provider being down, and opening the circuit for it refuses
healthy calls.

State is in-process, so each gunicorn worker learns independently. Acceptable
here. **Not** acceptable for throttling, where per-process counters multiply the
rate limit by the worker count (`security-hardening/02`, N2).

## Sandbox vs live

Separate credentials, separate base URLs, both from `env()`. Keep the example
pointed at **sandbox** so a fresh copy cannot hit live payments.

**Log which environment is active at boot:**

```python
log.info('bKash client: %s', 'SANDBOX' if 'sandbox' in settings.BKASH_BASE_URL else 'LIVE')
```

Two failures this prevents: sandbox credentials in production (every payment
fails, and it looks like a provider outage), and live credentials in staging
(real money moves during a test).

Rotating sandbox keys while live keys are exposed accomplishes nothing —
`security-hardening/04-secrets.md` notes this per provider.

## Logging

Log every request and response: provider, method, path, status, elapsed. It is
the only evidence you have when a provider says "we never received that".

**Never log a credential.** `IntegrationClient` redacts `Authorization`,
`Api-Key`, `Secret-Key`, `app_secret`, `password` and `token` from both headers
and bodies before logging. That redaction is a backstop, not a licence — the
control is not putting the value in the log call.

Truncate response bodies. A provider error can be a full HTML page, and an
unbounded log line fills the disk.

## Webhooks in

An incoming webhook is an **unauthenticated write endpoint** until you verify it.
A payment-status webhook that trusts its body lets anyone mark any order paid.

1. **Verify the signature** before parsing. HMAC over the raw body with a shared
   secret, compared with `hmac.compare_digest` — `==` on a signature is a timing
   oracle.
2. **Read the raw body**, not the parsed JSON. Re-serializing changes bytes and
   breaks the HMAC.
3. **Exempt from CSRF, never from authentication.** The signature *is* the
   authentication.
4. **Idempotent by the provider's event id** — providers retry, sometimes for
   days.
5. **Return 200 fast.** Write a row, return, process on the next drain. A slow
   webhook endpoint gets retried and then disabled.
6. **Never trust amounts or statuses from the body.** Re-query the provider's
   API by their reference. `security-hardening/06-server-authority.md` owns this
   rule; the webhook is the highest-value place it applies.

```python
@csrf_exempt
@require_POST
def bkash_webhook(request):
    signature = request.headers.get('X-Signature', '')
    expected = hmac.new(settings.BKASH_WEBHOOK_SECRET.encode(),
                        request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        log.warning('bKash webhook signature mismatch from %s',
                    request.META.get('REMOTE_ADDR'))
        return HttpResponse(status=401)

    event = json.loads(request.body)
    enqueue('bkash_event', event, idempotency_key=f"bkash:{event['eventId']}")
    return HttpResponse(status=200)      # fast; the drain re-queries and applies
```

If the provider offers no signature, **do not use their webhook**. Poll instead.

## Verification

```bash
# 1. Every call has a timeout.
grep -rnE "requests\.(get|post|put|patch|delete)\(" --include=*.py . | grep -v "timeout="
# PASS: no output

# 2. No silent skip on a missing credential (C1).
grep -rnE "if (settings\.|getattr\(settings)[A-Z_]*(API_KEY|SECRET|TOKEN)" --include=*.py .
# PASS: no output — the client should raise at construction

# 3. Clients raise without credentials.
python manage.py shell -c "
from unittest.mock import patch
from django.core.exceptions import ImproperlyConfigured
from common.integrations import SteadfastClient
with patch('django.conf.settings.STEADFAST_API_KEY', ''):
    try:
        SteadfastClient(); print('FAIL: constructed without a key')
    except ImproperlyConfigured as e:
        print('PASS:', e)"

# 4. Which environment is live.
grep -n "sandbox" .env
# PASS: matches the intended environment

# 5. No credential in the logs.
grep -rniE "api-key|secret-key|app_secret" ~/logs/*.log | grep -v REDACTED
# PASS: no output

# 6. Webhook rejects a bad signature.
curl -s -o /dev/null -w '%{http_code}\n' -X POST .../webhooks/bkash/ \
  -H 'X-Signature: wrong' -d '{"eventId":"x"}'
# PASS: 401

# 7. Timeouts degrade rather than hang.
#    Point the base URL at a blackhole (10.255.255.1) and place an order.
# PASS: the order succeeds; dispatch is queued and retried
```

Check 7 is the real test of the design: a dead courier API must not prevent a
customer from checking out.
