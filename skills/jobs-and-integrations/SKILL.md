---
name: jobs-and-integrations
description: Background work and third-party calls in a Django app without a queue worker — an email outbox drained by cron, idempotent jobs, an HTTP client with timeouts, retries and a circuit breaker, bKash and Steadfast integrations, PDF invoices, a health endpoint, structured logging and an audit log for privileged actions. Use when email blocks a response, a job needs retrying, an integration times out or fails silently, adding a payment or courier call, generating a PDF, or adding logging and health checks. Trigger on "background job", "async task", "send email", "email queue", "outbox", "cron", "retry", "webhook", "bKash", "payment", "Steadfast", "courier", "invoice PDF", "third party API", "timeout", "circuit breaker", "health check", "audit log", "structured logging", "idempotency".
---

# Jobs and integrations

Everything that happens outside the request/response cycle, and everything that
talks to a system you do not control.

## When to use

- A request is slow because it waits on email, a courier, or a payment gateway
- An integration fails silently, times out, or needs retrying
- Adding bKash, Steadfast, SMTP, or any third-party call
- Generating a PDF invoice or challan
- Adding `/health/`, structured logging, or an audit trail

Do **not** use it for request-path performance (`performance-budget`), server
and cron *setup* (`deploy-and-env`), or credential storage
(`security-hardening/04-secrets.md`). This skill owns what the job does and how
the call is made.

## The constraint that shapes everything

**This project has no long-lived worker process.** Passenger on cPanel kills
idle processes; there is no systemd, no supervisor, and cron is the only
scheduler.

So: no Celery, no RQ, and emphatically no `threading.Thread`. A thread started
in a request dies with the worker that spawned it, silently, taking the email
with it.

What works instead is a **database table drained by cron**. The row is committed
inside the request's transaction, so it cannot be lost; a cron job picks it up
seconds later. Durable, inspectable, restartable, and it needs no infrastructure.

## The three rules

1. **Nothing that talks to a third party happens inside a request.** Write a
   row, return, drain after commit. You do not control the other end's latency,
   and a 30-second SMTP timeout becomes a 30-second checkout. *(C3)*
2. **Every outbound call has a timeout, a retry policy and a bounded failure.**
   A call with no timeout inherits the socket default, which is forever.
3. **Every job is idempotent.** It will run twice — a retry, a duplicated cron,
   a manual re-run during an incident. Running twice must be indistinguishable
   from running once. *(N10)*

## Route by task

| Task | Read |
|---|---|
| Email, outbox, cron draining, retries, dead-letter, idempotency | [01-outbox.md](references/01-outbox.md) |
| HTTP clients, timeouts, backoff, circuit breaker, sandbox vs live | [02-integrations.md](references/02-integrations.md) |
| bKash verification, COD, Steadfast dispatch and tracking, webhooks | [03-payments-and-courier.md](references/03-payments-and-courier.md) |
| Invoice and challan PDFs, fonts, Bangla text, storage | [04-pdf.md](references/04-pdf.md) |
| `/health/`, structured logging, request ids, error tracking, audit log | [05-observability.md](references/05-observability.md) |

Copy in this order: [`assets/outbox.py`](assets/outbox.py) →
[`assets/integration_client.py`](assets/integration_client.py) →
[`assets/audit_log.py`](assets/audit_log.py).

## Decisions

**Outbox or queue?** Outbox here, because there is no worker. On a VPS with
systemd, Celery + Redis is a reasonable upgrade — but keep the outbox table as
the durable record even then. A queue that loses a message loses it silently;
a table does not.

**Retry or dead-letter?** Retry a *transient* failure — timeout, connection
reset, 5xx, 429. Dead-letter a *permanent* one — 400, 401, 404, a malformed
address. Retrying a 400 forever is a busy loop that never succeeds, and it will
hide the real failure behind ten thousand log lines.

**Where does idempotency live?** A unique key in the database
(`data-layer/05`), checked before doing the work. Not a flag set after — the
process can die between the work and the flag.

**Webhook or poll?** Webhook where the provider offers a signed one. Poll where
they do not, or where the webhook is unauthenticated — an unsigned webhook is
an unauthenticated write endpoint that changes payment status, and treating it
as trusted is a critical vulnerability.

**Sync anything, ever?** Only a payment *verification* the user is actively
waiting on, with a hard timeout under 15 seconds and a clear timeout path. Never
email, never courier, never PDF.

## Workflow

**Adding a background job**

1. Model the work as a row: `status`, `attempts`, `next_attempt_at`,
   `last_error`, and an idempotency key.
2. Write the row inside the request's transaction.
3. Enqueue side effects with `transaction.on_commit` — never inside the
   transaction, or you send an invoice for an order that rolled back.
4. Write a management command that drains a bounded batch.
5. Schedule it with cron (`deploy-and-env/02-hosting.md`).
6. Make the handler idempotent. Test by running it twice.

**Adding an integration**

1. Credentials via `env()`, grouped with `require_all` — never a literal.
2. Subclass `IntegrationClient`: base URL, timeout, retry policy, auth.
3. Sandbox and live as separate env values; log which is active at boot.
4. Log every request and response with the credential redacted.
5. Handle timeout, 4xx and 5xx distinctly.
6. Write the failure path first — it is the one that will run at 2am.

## What this skill does not own

| Concern | Owner |
|---|---|
| Where credentials live, rotation, git history | `security-hardening/04-secrets.md` |
| Never trusting a client-supplied amount or transaction id | `security-hardening/06-server-authority.md` |
| Idempotency key columns and constraints | `data-layer/05-transactions-and-time.md` |
| Cron setup, server paths, log locations | `deploy-and-env/02-hosting.md` |
| Request-path latency budgets | `performance-budget/01-backend-budget.md` |
| The error envelope a failed integration surfaces as | `api-contract/02-error-envelope.md` |

## Before you start — what to ask the user for

An integration cannot be built from the code alone. Ask for all of it **before**
writing the client, in one batch.

Per provider:

- **Credentials** — key, secret, merchant/store id, username. From the provider
  console; the user must fetch them.
- **Sandbox or live**, explicitly, per environment. The base URL differs, and so
  does the consequence of getting it wrong. Never assume live.
- **The webhook secret**, and the callback URL to register.
- **Amount and currency conventions** — bKash amounts are strings; ৳ is
  two-decimal `Decimal`. Confirm rather than infer.

Human-only actions, confirmed done before the wiring:

- Registering the callback/webhook URL in the provider console.
- Whitelisting the server IP, if the provider requires it.
- Creating the sandbox account, and getting test credentials that actually work.
- Creating the Gmail app password (needs 2FA on the account).
- Rotating any provider key that has appeared in git.

Then scaffold what does not depend on the answers — the outbox, the model, the
handler signature, the tests against a stubbed client — and **stop before the
live call**, saying so. Do not fill a missing key with a plausible string: that
is exactly **C1**, where `environ.get('steadfast_api_key')` returned `None`, the
`if settings.STEADFAST_API_KEY:` guard skipped dispatch, and every order was
handled manually for months without a single error being logged.

## Verification

```bash
# 1. No thread-based background work.
grep -rn "threading.Thread\|Thread(" --include=*.py . | grep -v test
# PASS: no output (C3)

# 2. No third-party call inside a request path.
grep -rnE "requests\.(get|post)|send_mail|EmailMessage" --include=views.py --include=signals.py .
# PASS: no output — these belong in the outbox handler

# 3. Every outbound call has a timeout.
grep -rnE "requests\.(get|post|put|patch|delete)\(" --include=*.py . | grep -v "timeout="
# PASS: no output

# 4. Order placement returns fast.
curl -s -o /dev/null -w '%{time_total}\n' -X POST .../api/orders/place_order/ \
  -H "Authorization: Bearer $TOKEN" -d '{"items":[{"attribute":1,"quantity":1}]}'
# PASS: under 1.0

# 5. Cron is actually draining, and nothing is stuck.
tail -20 ~/logs/outbox.log        # PASS: recent timestamps, no growing backlog
python manage.py shell -c "
from common.models import OutboxMessage as M
print(M.objects.filter(status='failed').count(), 'dead-lettered')"

# 6. Health reports its dependencies; privileged actions are audited.
curl -sf https://api.example.com/health/ | python -m json.tool
python manage.py shell -c "
from common.models import AuditLog
print(AuditLog.objects.order_by('-created_at')[:5].values_list('action', flat=True))"
```

Full list: [checklists/jobs-acceptance.md](checklists/jobs-acceptance.md).

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| **C3** | `send_invoice_email_task` called synchronously in `place_order`; `threading` imported in two files and never used, while the docstring claimed it ran in a thread | [01](references/01-outbox.md) |
| **C1** | Steadfast credentials read as `os.environ.get('<literal key>')` → `None` → courier silently dead. Fail-loud client config | [02](references/02-integrations.md) |
| **N9** | No audit log for role changes, price edits, order edits or stock adjustments | [05](references/05-observability.md) |
| **N10** | No idempotency on order/transaction creation — a double submit created duplicate orders | [01](references/01-outbox.md) |
| **C5** | `courier_type` read into `instance._courier_type` and never persisted; the signal defaulted to `'manual'` | [03](references/03-payments-and-courier.md) |
| **S5** (part) | A client-supplied bKash transaction id accepted as proof of payment | [03](references/03-payments-and-courier.md) |
