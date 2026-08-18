# Jobs and integrations acceptance

Run before shipping anything that talks to a third party or happens outside a
request.

## 1. Nothing blocking in the request path

- [ ] No `threading.Thread` anywhere (**C3**)
- [ ] No `send_mail`, `EmailMessage` or `requests.*` in a view, serializer or
      signal
- [ ] Order placement returns in under 1 s
- [ ] Every side effect is an outbox row written inside the transaction, or an
      `on_commit` callback
- [ ] No email is sent inside a transaction
- [ ] PDF rendering is deferred, or cached after the first render

## 2. Outbox

- [ ] `OutboxMessage` has `status`, `attempts`, `next_attempt_at`,
      `last_error`, and a unique `idempotency_key`
- [ ] `enqueue()` with the same key twice is a no-op (**N10**)
- [ ] Idempotency keys are derived from the logical work, not a fresh UUID
- [ ] Handlers are idempotent — running the drain twice sends once
- [ ] Transient failures retry with exponential backoff **and jitter**
- [ ] Permanent failures (4xx, bad address, missing row) dead-letter immediately
- [ ] A 401 from a provider dead-letters **and alerts**
- [ ] `drain_outbox` uses a bounded batch and `select_for_update(skip_locked=True)`
- [ ] Cron uses absolute paths and redirects both streams to a log
- [ ] Backlog age and dead-letter count are exposed in `/health/`
- [ ] Dead-lettered rows can be re-queued after a fix

## 3. Integrations

- [ ] Every `requests` call has an explicit timeout
- [ ] Every client raises `ImproperlyConfigured` at construction when a
      credential is missing (**C1**)
- [ ] No `if settings.SOME_KEY:` guard that silently skips the call
- [ ] No integration function returns `None` to mean "skipped"
- [ ] Retries are transient-only, capped at 3 in-request
- [ ] `Retry-After` is honoured on 429
- [ ] A circuit breaker fails fast during a provider outage
- [ ] A permanent 4xx does not count toward the breaker
- [ ] Sandbox and live are separate env values; the active one is logged at boot
- [ ] Every request and response is logged with credentials redacted
- [ ] Response bodies are truncated before logging
- [ ] An idempotency key is sent where the provider supports it

## 4. Webhooks in

- [ ] Signature verified with `hmac.compare_digest` over the **raw** body
- [ ] CSRF-exempt but never authentication-exempt
- [ ] Idempotent by the provider's event id
- [ ] Returns 200 quickly; work is deferred
- [ ] Amounts and statuses are re-queried from the provider, never taken from
      the body
- [ ] An unsigned webhook is not used at all — poll instead

## 5. Payments

- [ ] No client-supplied `transaction_id` is trusted (**S5**)
- [ ] No client-supplied amount is trusted
- [ ] Every payment is verified server-side before the order is marked paid
- [ ] Paid amount is compared against a server-recomputed total
- [ ] Currency is checked
- [ ] A `trxID` already used by another order is rejected as a replay
- [ ] Verification runs under `select_for_update` with an early return, so a
      double callback is a no-op
- [ ] A timeout sets a third state (`verifying`), never paid and never failed
- [ ] bKash credentials are server-side only and absent from the bundle
- [ ] COD is marked collected only by staff or a courier event, never by the
      customer
- [ ] Every payment transition is audited

## 6. Courier

- [ ] `courier_type` is a real column with `choices` and no default (**C5**)
- [ ] No `getattr(instance, '_private_attr', default)` driving behaviour
- [ ] Dispatch runs in the outbox, not in the checkout request
- [ ] Dispatch is idempotent — a retry does not create a second consignment
- [ ] `cod_amount` comes from the server-computed total
- [ ] Tracking responses are cached
- [ ] A tracking failure returns the last known status, not a 500
- [ ] A courier outage does not prevent checkout

## 7. PDF

- [ ] Bengali fonts are committed under `static/fonts/` as TTF
- [ ] Regular and bold are registered as separate `@font-face` rules
- [ ] Font paths are absolute filesystem paths, not URLs
- [ ] `৳` renders in the output
- [ ] `result.err` is checked; a failed render raises rather than emailing a
      corrupt file
- [ ] Line items read from `OrderItem`, never live product prices
- [ ] A sent invoice is never regenerated from current data
- [ ] Dates are rendered in `Asia/Dhaka` (**C2**)
- [ ] `<thead>` repeats across pages
- [ ] Render uses `select_related`; under 10 queries
- [ ] Stored invoices are not publicly enumerable (**N11** class)

## 8. Observability

- [ ] `/health/` checks database, cache and outbox backlog
- [ ] It returns 503 when degraded
- [ ] It exposes no version, host, path or setting
- [ ] It makes no third-party call
- [ ] An uptime monitor watches it, alerting after two consecutive failures
- [ ] Log events use dotted names and structured `extra`
- [ ] Logs contain IDs, not emails
- [ ] No password, OTP, token or request body in any log
- [ ] Request ids are generated, logged, returned, and in the error envelope
- [ ] An inbound `X-Request-ID` is trusted only behind a proxy
- [ ] Error tracking is configured with `send_default_pii=False` and a scrubber
- [ ] A deliberate test error was confirmed to arrive
- [ ] No `print()` in production code

## 9. Audit log (N9)

- [ ] Role and `is_staff` changes are recorded
- [ ] Price changes are recorded
- [ ] Stock adjustments are recorded
- [ ] Order edits and status changes are recorded
- [ ] Manual payment marking is recorded
- [ ] User deletion is recorded
- [ ] Entries capture actor, target, before/after, IP, and request id
- [ ] Credential-shaped fields are redacted from `changes`
- [ ] The log is append-only — editing a row raises
- [ ] `actor_label` survives deletion of the user
- [ ] An audit write failure never rolls back the audited action
- [ ] A role change also bumps `token_version` (`auth-flows/06`, **N4**)

## Sign-off

Done when every box is ticked, or an unticked box has a written reason and an
owner. The two that are never negotiable: **no third-party call in a request
path**, and **no client-supplied amount or transaction id trusted**. Both have
already cost this project once.
