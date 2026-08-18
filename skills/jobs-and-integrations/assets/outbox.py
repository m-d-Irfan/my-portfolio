"""Durable outbox for work that must not happen inside a request.

Copy the model to `common/models.py` and the command body to
`common/management/commands/drain_outbox.py`.

Why this exists (C3): `orders/views.py` called send_invoice_email_task(...)
synchronously inside place_order, so the customer's checkout waited on Gmail's
SMTP. The docstring claimed it ran in a thread; `threading` was imported in two
files and never used. The proposed fix — wrapping it in threading.Thread — is
worse than it looks: Passenger kills idle processes, so the thread dies with the
worker and the email is lost with no error anywhere.

The shape that works with no worker process:

    request  ──►  write an OutboxMessage row inside the transaction
                  return immediately
    on_commit ──► (nothing; the row is already durable)
    cron      ──► drain_outbox picks it up within a few minutes

The row is committed with the order, so it cannot be lost. If the process dies
mid-send, the next drain retries it.
"""

import logging
import uuid

from django.core.mail import EmailMultiAlternatives
from django.db import models, transaction
from django.utils import timezone

log = logging.getLogger("jobs.outbox")

# Backoff per attempt, in seconds: ~1min, 5min, 15min, 1hr, 6hr.
RETRY_BACKOFF_SECONDS = (60, 300, 900, 3600, 21600)
MAX_ATTEMPTS = len(RETRY_BACKOFF_SECONDS)


class OutboxMessage(models.Model):
    """One unit of deferred work.

    Deliberately generic: `kind` selects the handler, `payload` carries its
    arguments. A table per job type is cleaner in theory and unmaintainable in
    practice — the drainer, retry policy and monitoring are identical for all
    of them.
    """

    class Kind(models.TextChoices):
        INVOICE_EMAIL = "invoice_email", "Invoice email"
        OTP_EMAIL = "otp_email", "OTP email"
        PASSWORD_RESET = "password_reset", "Password reset email"
        COURIER_DISPATCH = "courier_dispatch", "Courier dispatch"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Dead-lettered"

    kind = models.CharField(max_length=32, choices=Kind.choices)
    payload = models.JSONField(default=dict)

    # N10: the idempotency key. Unique, so the same logical work cannot be
    # enqueued twice — a double-submitted checkout writes one row, not two.
    # Checked BEFORE the work, never set as a flag after: the process can die
    # between doing the work and recording that it did.
    idempotency_key = models.CharField(max_length=255, unique=True)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Truncated on write. A provider error body can be a full HTML page, and an
    # unbounded error column is how one bad row makes the admin list unusable.
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            # The drainer's exact query shape.
            models.Index(
                fields=["status", "next_attempt_at"], name="outbox_ready_idx"
            ),
        ]
        ordering = ["next_attempt_at"]

    def __str__(self):
        return f"{self.kind} {self.idempotency_key} ({self.status})"

    def record_failure(self, exc, permanent=False):
        """Schedule a retry, or dead-letter.

        Permanent failures do not retry. A 400 or a malformed address will fail
        identically forever; retrying it is a busy loop that buries the real
        error under thousands of log lines.
        """
        self.attempts += 1
        self.last_error = f"{exc.__class__.__name__}: {exc}"[:2000]

        if permanent or self.attempts >= MAX_ATTEMPTS:
            self.status = self.Status.FAILED
            log.error(
                "Outbox %s dead-lettered after %d attempts: %s",
                self.pk, self.attempts, self.last_error,
            )
        else:
            delay = RETRY_BACKOFF_SECONDS[self.attempts - 1]
            self.next_attempt_at = timezone.now() + timezone.timedelta(seconds=delay)
            log.warning(
                "Outbox %s attempt %d failed, retrying in %ds: %s",
                self.pk, self.attempts, delay, self.last_error,
            )

        self.save(update_fields=["attempts", "last_error", "status",
                                 "next_attempt_at"])

    def record_success(self):
        self.status = self.Status.SENT
        self.sent_at = timezone.now()
        self.save(update_fields=["status", "sent_at"])


def enqueue(kind, payload, idempotency_key=None):
    """Queue work. Safe to call twice with the same key — the second is a no-op.

    Call inside the request's transaction so the row commits with the data it
    describes. Do NOT wrap the send itself in on_commit: the point of the table
    is that the work survives the process.
    """
    key = idempotency_key or f"{kind}:{uuid.uuid4()}"

    message, created = OutboxMessage.objects.get_or_create(
        idempotency_key=key,
        defaults={"kind": kind, "payload": payload},
    )
    if not created:
        log.info("Outbox %s already queued (idempotent no-op)", key)
    return message


def enqueue_invoice_email(order, base_url):
    """C3's replacement. Returns immediately; cron delivers.

    The idempotency key is derived from the order, so a retried checkout or a
    re-fired post_save signal cannot send two invoices for one order.
    """
    return enqueue(
        OutboxMessage.Kind.INVOICE_EMAIL,
        {"order_id": order.pk, "base_url": base_url},
        idempotency_key=f"invoice:{order.pk}",
    )


# --- Handlers ---------------------------------------------------------------
# One per Kind. Each must be idempotent and must raise on failure — the drainer
# uses the exception to decide retry vs dead-letter.


class PermanentFailure(Exception):
    """Raise when retrying cannot possibly help: 4xx, bad address, missing row."""


def handle_invoice_email(payload):
    from django.conf import settings

    from orders.models import Order
    from orders.utils import render_invoice_pdf   # see references/04-pdf.md

    try:
        order = Order.objects.select_related("user").get(pk=payload["order_id"])
    except Order.DoesNotExist as exc:
        # The order was deleted. No retry will find it.
        raise PermanentFailure(f"Order {payload['order_id']} no longer exists") from exc

    recipient = (order.email or "").strip()
    if not recipient or "@" not in recipient:
        raise PermanentFailure(f"Order {order.pk} has no usable email address")

    pdf = render_invoice_pdf(order, base_url=payload.get("base_url", ""))

    email = EmailMultiAlternatives(
        subject=f"Invoice for order #{order.pk}",
        body=f"Your invoice for order #{order.pk} is attached.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
    )
    email.attach(f"invoice-{order.pk}.pdf", pdf, "application/pdf")
    email.send(fail_silently=False)     # never silent — the drainer needs the error


HANDLERS = {
    OutboxMessage.Kind.INVOICE_EMAIL: handle_invoice_email,
}


# --- The drainer -------------------------------------------------------------
# Body of common/management/commands/drain_outbox.py. Scheduled by cron:
#
#   */5 * * * * cd /home/user/daf_backend && \
#     /home/user/virtualenv/daf_backend/3.11/bin/python manage.py drain_outbox \
#     >> /home/user/logs/outbox.log 2>&1


def drain(batch_size=20, dry_run=False):
    """Process ready messages. Returns (sent, failed).

    Bounded batch: cron may fire again before this finishes, and an unbounded
    drain of a large backlog can exceed the process's memory or lifetime.

    select_for_update(skip_locked=True) is what makes overlapping cron runs
    safe — the second run skips rows the first has claimed rather than blocking
    or double-sending.
    """
    sent = failed = 0
    now = timezone.now()

    ready = (
        OutboxMessage.objects
        .filter(status=OutboxMessage.Status.PENDING, next_attempt_at__lte=now)
        .order_by("next_attempt_at")[:batch_size]
    )
    ids = list(ready.values_list("pk", flat=True))

    for pk in ids:
        with transaction.atomic():
            message = (
                OutboxMessage.objects
                .select_for_update(skip_locked=True)
                .filter(pk=pk, status=OutboxMessage.Status.PENDING)
                .first()
            )
            if message is None:
                continue        # another run claimed it

            if dry_run:
                log.info("Would send %s", message)
                continue

            handler = HANDLERS.get(message.kind)
            if handler is None:
                message.record_failure(
                    PermanentFailure(f"No handler for kind {message.kind}"),
                    permanent=True,
                )
                failed += 1
                continue

            try:
                handler(message.payload)
            except PermanentFailure as exc:
                message.record_failure(exc, permanent=True)
                failed += 1
            except Exception as exc:               # noqa: BLE001 — transient
                message.record_failure(exc)
                failed += 1
            else:
                message.record_success()
                sent += 1

    log.info("Outbox drain: %d sent, %d failed, %d examined", sent, failed, len(ids))
    return sent, failed
