# OTP

One-time codes that resist brute force. Owns generation, storage, verification,
expiry, attempt caps and throttling.

Implementation: [`assets/backend/otp.py`](../assets/backend/otp.py). This file
explains why each control exists.

## What was wrong (N3 + N2)

```python
# The original.
class CustomUser(AbstractUser):
    otp = models.CharField(max_length=6, blank=True, null=True)
```

Six problems in one line:

| Problem | Consequence |
|---|---|
| Plaintext | A database read — backup leak, SQL injection, insider, a `fields = "__all__"` serializer — yields live codes |
| No expiry | A code intercepted from an old email works forever |
| No attempt counter | Unlimited guesses |
| No consumed flag | The same code is replayable |
| One column | Requesting a new code silently replaces the old, and there is no history for incident review |
| No purpose | A code issued to verify an email also validates a password reset |

And no throttling existed anywhere, so the 10⁶ keyspace was open to a script.
At 100 requests/second an unthrottled 6-digit code falls in under three hours,
and in seconds if the attacker parallelises.

## Control → attack

| Control | Stops |
|---|---|
| `secrets.randbelow` | Predicting the next code. `random` is a Mersenne Twister seeded from the clock — observing a few outputs reveals the state |
| HMAC-SHA256 of the code | A database read yielding usable codes |
| Purpose bound into the hash | A `verify_email` code satisfying a `reset_password` challenge |
| `expires_at` (10 min) | An old code from a forwarded or archived email |
| `attempts` / `max_attempts` (5) | Online brute force |
| `consumed_at` | Replay |
| Invalidate priors on reissue | "Request 50 codes, any works" — widening the keyspace 50× |
| `hmac.compare_digest` | Timing side channel that leaks the prefix |
| Throttle issue (5/hr) | Email bombing, keyspace widening |
| Throttle verify (10/hr) | The volume that makes guessing viable at all |
| Resend cooldown (60 s) | Using the resend button as a mail cannon |

## Why not bcrypt

A 6-digit code has 10⁶ possibilities. No work factor makes that hard offline —
even at 100 ms per hash, an attacker with the database enumerates the whole space
for one user in a day, and they only need the window before it expires.

What protects the code is the **short TTL and the attempt cap**, not hash cost.
HMAC-SHA256 keyed with `SECRET_KEY` is the right choice: fast enough to not slow
verification, and an attacker with a database dump but no `SECRET_KEY` cannot
build a rainbow table at all.

```python
def _hash_code(code, user_id, purpose):
    msg = f"{user_id}:{purpose}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
```

## Count the attempt before comparing

```python
    otp.attempts += 1
    otp.save(update_fields=["attempts"])

    submitted = _hash_code(str(code).strip(), user.pk, purpose)
    if not hmac.compare_digest(submitted, otp.code_hash):
        return False
```

If the increment came after the comparison, an attacker who can make the handler
raise — a malformed payload, a connection reset mid-request — gets an unlimited
supply of free guesses. Spend the attempt first.

## The views

```python
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .otp import OTPPurpose, can_resend, issue_otp, verify_otp


class RequestOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_issue"          # 5/hour, see settings_security.py

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()

        # ONE response shape for every path below. Whether the account exists,
        # whether it is active, whether we actually sent anything — the caller
        # learns nothing. Any difference here is an account-enumeration oracle
        # that tells an attacker which of a leaked email list are customers.
        generic = Response(
            {"detail": "If an account exists for that address, a code has been sent."},
            status=status.HTTP_200_OK,
        )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return generic

        ok, wait = can_resend(user, OTPPurpose.LOGIN)
        if not ok:
            return Response(
                {"detail": f"Please wait {wait} seconds before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = issue_otp(user, OTPPurpose.LOGIN, request_ip=_client_ip(request))
        send_otp_email(user, code)        # queued, not inline — see jobs-and-integrations
        return generic


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"         # 10/hour

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        code = request.data.get("code") or ""

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        # Same failure response whether the user is missing or the code is wrong.
        if not user or not verify_otp(user, OTPPurpose.LOGIN, code):
            return Response(
                {"detail": "That code is not valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})
```

Note `_client_ip` must read `X-Forwarded-For` only when behind a proxy you
control, and take the **first** entry — the header is client-appendable, so
trusting the last or the whole string lets an attacker rotate their apparent IP
and defeat per-IP throttling.

## Never return the code

Not in a response body. Not under `DEBUG`. Not in a log line. Not in a Sentry
breadcrumb.

The attacker requesting the code is the one reading the answer — an OTP echoed
anywhere the requester can see makes the entire flow decorative. In development,
use the console email backend (`assets/settings.py` selects it automatically
when `DEBUG` is on and no SMTP user is configured) so the code prints to the
server terminal, where only the developer sees it.

## Delivery is asynchronous

`send_otp_email` must not block the HTTP response. Sending inline makes login
latency equal to SMTP latency — which for Gmail is 1–3 seconds on a good day and
unbounded on a bad one — and a `threading.Thread` loses the email silently when
the worker recycles.

Use the outbox pattern from `jobs-and-integrations`. This is the same defect as
audit ref C3, where invoice email was sent inline despite a docstring claiming
otherwise.

## Verification

```bash
# Attempt cap: the 6th verify in an hour must be refused.
for i in $(seq 1 7); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST localhost:8000/api/auth/otp/verify/ \
    -H 'Content-Type: application/json' -d '{"email":"u@example.com","code":"000000"}'
done; echo
# expect: run ends in 429, and the CORRECT code no longer works either

# Enumeration: a real address and a fake one must be indistinguishable.
curl -s -X POST localhost:8000/api/auth/otp/request/ -d '{"email":"real@example.com"}' \
  -H 'Content-Type: application/json'
curl -s -X POST localhost:8000/api/auth/otp/request/ -d '{"email":"nope@nowhere.invalid"}' \
  -H 'Content-Type: application/json'
# expect: byte-identical bodies and the same status

# Replay: a consumed code must fail the second time.
# Expiry: wait past OTP_TTL_MINUTES, then submit the correct code -> rejected.

# The code is never stored in plaintext.
python manage.py shell -c "
from api.otp import OTPCode
print([o.code_hash[:12] for o in OTPCode.objects.all()[:3]])
"
# expect: 64-char hex digests, not 6 digits
```

## Common mistakes

- Comparing with `==`. Use `hmac.compare_digest`.
- Storing the code, not its hash.
- Forgetting to invalidate prior codes on reissue.
- Incrementing `attempts` after the comparison instead of before.
- Different responses for "no such account" and "code sent".
- Returning the code in the response under `DEBUG`.
- Sending the email inline.
- Throttling per-account only. Also throttle per-IP, or one attacker walks a list
  of accounts at 5 attempts each.
- Trusting `X-Forwarded-For` wholesale for the per-IP throttle key.
