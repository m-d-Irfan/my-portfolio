"""Audit log for privileged actions (N9).

Copy the model to `common/models.py` and the helpers alongside it.

Why: nothing in this project recorded who changed a role, edited a price,
adjusted stock, or modified an order after placement. When a price is wrong or
an unexpected account has is_staff, there is no way to answer "who did this and
when" — which matters most during an incident, when you need to know whether an
attacker used a leaked credential (security-hardening/04-secrets.md, step 5).

Scope: privileged and financial actions only. Logging every read produces a
table nobody can query and a write amplification nobody budgeted for.
"""

import logging

from django.conf import settings
from django.db import models
from django.utils import timezone

log = logging.getLogger("security.audit")


class AuditLog(models.Model):
    """An append-only record of one privileged action.

    Never updated, never deleted by application code. A mutable audit log is
    not an audit log — the first thing an attacker with admin access edits is
    the record of what they did.
    """

    class Action(models.TextChoices):
        ROLE_CHANGED = "role_changed", "Role changed"
        STAFF_FLAG_CHANGED = "staff_changed", "Staff flag changed"
        PRICE_CHANGED = "price_changed", "Price changed"
        STOCK_ADJUSTED = "stock_adjusted", "Stock adjusted"
        ORDER_EDITED = "order_edited", "Order edited after placement"
        ORDER_STATUS_CHANGED = "order_status", "Order status changed"
        PAYMENT_MARKED = "payment_marked", "Payment marked manually"
        USER_DELETED = "user_deleted", "User deleted"
        LOGIN_FAILED = "login_failed", "Failed login"
        PERMISSION_DENIED = "permission_denied", "Permission denied"

    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)

    # SET_NULL, not CASCADE: deleting a user must not erase the record of what
    # they did. actor_label preserves the identity after the row is gone.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_entries",
    )
    actor_label = models.CharField(max_length=255, blank=True)

    # Generic target, stored as strings so a deleted object still reads.
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_label = models.CharField(max_length=255, blank=True)

    # {"field": {"from": x, "to": y}}. Never put a password, token or OTP here —
    # see redact_changes below.
    changes = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    request_id = models.CharField(max_length=64, blank=True, db_index=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "-created_at"], name="audit_action_time_idx"),
            models.Index(fields=["target_type", "target_id"], name="audit_target_idx"),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.actor_label} {self.action} {self.target_label}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError(
                "AuditLog rows are append-only. Editing one defeats the purpose."
            )
        super().save(*args, **kwargs)


SENSITIVE_FIELDS = frozenset({
    "password", "otp", "token", "secret", "api_key", "access", "refresh",
})


def redact_changes(changes):
    """Strip credential-shaped fields before they reach the log.

    An audit log full of password hashes is a second copy of the credential
    store with weaker access controls.
    """
    return {
        field: ("***REDACTED***" if any(s in field.lower() for s in SENSITIVE_FIELDS)
                else value)
        for field, value in (changes or {}).items()
    }


def _request_meta(request):
    if request is None:
        return {}
    # X-Forwarded-For only when a trusted proxy sets it — otherwise a client
    # can forge the header and every audit entry records an IP of its choosing.
    # deploy-and-env/02 covers the proxy configuration.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = (forwarded.split(",")[0].strip()
          if forwarded and getattr(settings, "BEHIND_TLS_PROXY", False)
          else request.META.get("REMOTE_ADDR"))
    return {
        "ip_address": ip,
        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:255],
        "request_id": getattr(request, "request_id", ""),
    }


def record(action, *, actor=None, target=None, changes=None, request=None):
    """Write one audit entry. Never raises into the caller.

    An audit failure must not roll back the action being audited — but it must
    be loud, because a silent audit gap is indistinguishable from no activity.
    """
    try:
        if actor is None and request is not None:
            actor = getattr(request, "user", None)
            if actor is not None and not actor.is_authenticated:
                actor = None

        entry = AuditLog(
            action=action,
            actor=actor,
            actor_label=(str(actor) if actor else "anonymous")[:255],
            target_type=target.__class__.__name__ if target is not None else "",
            target_id=str(getattr(target, "pk", "")) if target is not None else "",
            target_label=str(target)[:255] if target is not None else "",
            changes=redact_changes(changes),
            **_request_meta(request),
        )
        entry.save()
        log.info(
            "audit %s actor=%s target=%s:%s",
            action, entry.actor_label, entry.target_type, entry.target_id,
        )
        return entry
    except Exception:                                    # noqa: BLE001
        log.exception("Failed to write audit entry for action=%s", action)
        return None


def diff(instance, updated_fields):
    """{"field": {"from": old, "to": new}} for the fields that actually changed.

    Call BEFORE saving. Re-reads the row from the database rather than trusting
    an in-memory copy, which may already carry the new values.
    """
    if instance.pk is None:
        return {}

    try:
        stored = type(instance).objects.get(pk=instance.pk)
    except type(instance).DoesNotExist:
        return {}

    changes = {}
    for field in updated_fields:
        old = getattr(stored, field, None)
        new = getattr(instance, field, None)
        if old != new:
            changes[field] = {"from": str(old), "to": str(new)}
    return changes


# --- Usage -------------------------------------------------------------------
#
# In a serializer's update(), or a viewset's perform_update():
#
#     from common.audit_log import AuditLog, record, diff
#
#     def perform_update(self, serializer):
#         instance = serializer.instance
#         changes = diff(instance, ["mainPrice", "discountedPrice"])
#         serializer.save()
#         if changes:
#             record(AuditLog.Action.PRICE_CHANGED,
#                    target=instance, changes=changes, request=self.request)
#
# On a role change — the one that matters most, because it is the action an
# attacker with a leaked admin credential takes first:
#
#     record(AuditLog.Action.ROLE_CHANGED, target=user,
#            changes={"role": {"from": old_role, "to": new_role}},
#            request=request)
#
# Pair with auth-flows/06-session-revocation.md: a role change should also bump
# token_version, or the demoted admin keeps their access for the full token
# lifetime.
