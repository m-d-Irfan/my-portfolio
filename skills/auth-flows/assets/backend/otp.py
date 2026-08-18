"""OTP issue and verify, done correctly.

Copy to `api/otp.py`. Add `OTPCode` to the app's models (or move the model into
models.py and keep the functions here), then makemigrations.

Background — N3 and N2. The project stored the OTP as a plaintext
`CharField(max_length=6)` directly on the user row: no expiry, no attempt
counter, no hashing, and it persisted forever after use. There was also no DRF
throttling anywhere, so the 6-digit space (10^6) was open to unlimited guessing
— minutes to crack with a script.

Every control below maps to a specific attack:

    hashed storage      a database read (backup leak, SQL injection, insider)
                        does not yield live codes
    expires_at          a code intercepted from an old email stays useless
    attempts/max        online brute force
    consumed_at         replay of an already-used code
    invalidate priors   "request 50 codes, any of them works" — widening the
                        keyspace by requesting more codes
    secrets module      predictable codes; random.randint is seeded from time
                        and is not cryptographically secure
    compare_digest      timing side channel that leaks the code prefix by prefix
    throttling          the volume that makes all online guessing viable
"""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

OTP_LENGTH = getattr(settings, "OTP_LENGTH", 6)
OTP_TTL_MINUTES = getattr(settings, "OTP_TTL_MINUTES", 10)
OTP_MAX_ATTEMPTS = getattr(settings, "OTP_MAX_ATTEMPTS", 5)
OTP_RESEND_COOLDOWN_SECONDS = getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 60)


class OTPPurpose(models.TextChoices):
    LOGIN = "login", "Login"
    VERIFY_EMAIL = "verify_email", "Verify email"
    RESET_PASSWORD = "reset_password", "Reset password"


def _hash_code(code, user_id, purpose):
    """Hash the code, bound to the user and purpose.

    Binding matters: without it, a code issued for VERIFY_EMAIL would validate
    against a RESET_PASSWORD challenge, letting a low-privilege flow mint a
    credential for a high-privilege one.

    SHA-256 with SECRET_KEY as the HMAC key, not bcrypt/argon2. A 6-digit code
    has only 10^6 possibilities, so no work factor makes an offline crack hard —
    what protects it is the short TTL and the attempt cap, not the hash cost.
    HMAC also means an attacker with a database dump but no SECRET_KEY cannot
    even build a rainbow table.
    """
    msg = f"{user_id}:{purpose}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


class OTPCode(models.Model):
    """A single one-time code challenge.

    A separate table, not a column on the user. A column can hold one code, has
    no history, cannot express purpose, and gets accidentally serialised into an
    API response by `fields = '__all__'`.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="otp_codes",
    )
    purpose = models.CharField(max_length=32, choices=OTPPurpose.choices)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=OTP_MAX_ATTEMPTS)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Forensics. A burst of issues from one IP across many accounts is an attack
    # in progress; without this column you cannot see it.
    request_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "consumed_at"]),
            models.Index(fields=["expires_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP({self.user_id}, {self.purpose}, used={bool(self.consumed_at)})"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self):
        return self.consumed_at is not None

    @property
    def is_exhausted(self):
        return self.attempts >= self.max_attempts

    @property
    def is_usable(self):
        return not (self.is_expired or self.is_consumed or self.is_exhausted)


@transaction.atomic
def issue_otp(user, purpose, request_ip=None):
    """Generate, store and return a fresh code.

    Returns the PLAINTEXT code exactly once, for immediate delivery by email or
    SMS. It is never stored in plaintext and cannot be recovered afterwards.

    NEVER return this value in an API response, log it, or include it in an
    error message — not even under DEBUG. A code echoed in a response makes the
    whole flow decorative, because the attacker asking for the code is the one
    reading the answer.
    """
    # Invalidate every outstanding code for this user and purpose. Without this,
    # requesting N codes leaves N valid answers and multiplies the attacker's
    # odds by N.
    OTPCode.objects.filter(
        user=user, purpose=purpose, consumed_at__isnull=True
    ).update(consumed_at=timezone.now())

    # secrets, not random. random is a Mersenne Twister seeded from the clock;
    # observing a few outputs lets an attacker predict the rest.
    code = "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))

    OTPCode.objects.create(
        user=user,
        purpose=purpose,
        code_hash=_hash_code(code, user.pk, purpose),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
        max_attempts=OTP_MAX_ATTEMPTS,
        request_ip=request_ip,
    )
    return code


def can_resend(user, purpose):
    """Cooldown check. True when a new code may be issued.

    Stops a resend button from becoming a free email-bombing service against
    any address an attacker names, and slows keyspace-widening.
    """
    last = (
        OTPCode.objects.filter(user=user, purpose=purpose)
        .order_by("-created_at")
        .first()
    )
    if last is None:
        return True, 0
    elapsed = (timezone.now() - last.created_at).total_seconds()
    remaining = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
    return (remaining <= 0), max(remaining, 0)


@transaction.atomic
def verify_otp(user, purpose, code):
    """Check a submitted code. Returns True only on a valid, live, unused code.

    Every failure path returns False with no detail about *why*. Distinguishing
    "wrong code" from "expired" from "too many attempts" tells an attacker
    whether they are guessing in the right window.
    """
    if not code or not str(code).strip():
        return False

    otp = (
        OTPCode.objects.select_for_update()
        .filter(user=user, purpose=purpose, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if otp is None or otp.is_expired or otp.is_exhausted:
        return False

    # Count the attempt BEFORE comparing. If the comparison raised, or the
    # process died mid-request, the attempt must still be spent — otherwise an
    # attacker who can crash the handler gets unlimited free guesses.
    otp.attempts += 1
    otp.save(update_fields=["attempts"])

    submitted = _hash_code(str(code).strip(), user.pk, purpose)
    # compare_digest, not ==. String equality short-circuits at the first
    # differing byte, so response time leaks how many leading characters were
    # correct, reducing 10^6 guesses to about 60.
    if not hmac.compare_digest(submitted, otp.code_hash):
        return False

    otp.consumed_at = timezone.now()
    otp.save(update_fields=["consumed_at"])
    return True


def purge_expired_otps(older_than_days=7):
    """Delete spent and expired codes. Run from a daily cron.

    Consumed rows are useful briefly for incident review, then become a growing
    table of hashes with no purpose.
    """
    cutoff = timezone.now() - timedelta(days=older_than_days)
    deleted, _ = OTPCode.objects.filter(created_at__lt=cutoff).delete()
    return deleted
