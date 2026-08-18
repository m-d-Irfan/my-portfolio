# Password reset

Single-use, expiring, enumeration-safe. Owns the forgot-password flow end to end.

## The four properties

| Property | Without it |
|---|---|
| **Single-use** | A link in an inbox stays a live credential forever; anyone who later reads that mailbox owns the account |
| **Expiring** | Same, bounded only by mailbox lifetime |
| **Enumeration-safe** | The endpoint becomes an oracle telling an attacker which addresses from a breach dump are customers here |
| **Session-invalidating** | The user resets *because* they were compromised, and the attacker's existing tokens keep working |

## Two implementations

This project can use either. Pick one and be consistent.

**A. Django's `PasswordResetTokenGenerator`** — stateless, no new table. The token
is an HMAC over the user's pk, current password hash, `last_login` and a
timestamp. Single-use comes for free: resetting changes the password hash, which
invalidates the token.

**B. OTP-backed** — reuses [`otp.py`](../assets/backend/otp.py) with
`purpose=RESET_PASSWORD`. Better when the flow is code-entry rather than
link-click, which suits a mobile-first audience on patchy connections. Gets
attempt caps and expiry from the OTP machinery.

Use **A** for an emailed link, **B** for an emailed code. Do not build both.

## Implementation A

```python
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"          # 3/hour

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()

        # ONE response for every path. Same body, same status, whether the
        # account exists, is inactive, or was never real.
        generic = Response(
            {"detail": "If an account exists for that address, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return generic

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        # Absolute and HTTPS. A relative link is unusable from an email client.
        link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password/{uid}/{token}/"
        queue_password_reset_email(user, link)   # queued, never inline
        return generic


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        uidb64 = request.data.get("uid") or ""
        token = request.data.get("token") or ""
        password = request.data.get("password") or ""

        invalid = Response(
            {"detail": "This reset link is invalid or has expired. Request a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return invalid

        if not default_token_generator.check_token(user, token):
            return invalid

        # Enforce the same validators as registration. A reset flow that skips
        # them is the weakest link in the password policy.
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=400)

        user.set_password(password)
        user.save()

        # Non-negotiable. The user is resetting because they suspect compromise;
        # leaving the attacker's refresh tokens live defeats the entire flow.
        user.revoke_all_sessions()

        queue_password_changed_notice(user)
        return Response({"detail": "Your password has been reset. Please sign in."})
```

`PASSWORD_RESET_TIMEOUT` in settings controls expiry — default 3 days, which is
long. Set it to 3600 (one hour):

```python
PASSWORD_RESET_TIMEOUT = 3600
```

## Enumeration safety is about timing too

Identical response bodies are not sufficient if the timing differs. The
"account exists" path hashes a token and queues an email; the "no account" path
returns immediately. A few hundred milliseconds of difference is a reliable
oracle.

Queuing the email (rather than sending it inline) removes most of the gap,
because the expensive part happens after the response. What remains is the
database lookup and token generation, which is small but measurable.

If the endpoint matters enough, normalise it:

```python
        started = time.monotonic()
        ...  # both branches
        # Pad every response to a fixed floor.
        remaining = 0.25 - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(remaining)
        return generic
```

Do not do this by default — it costs a worker thread per request. Do it when the
customer list is itself sensitive.

## Notify the old address

When a password changes, email the account holder — *at the address on file
before the change*:

> Your password was changed on 8 August 2026 at 14:32 (Asia/Dhaka).
> If this wasn't you, contact us immediately.

This is the only signal a user gets that their account was taken over via a
compromised mailbox. It costs one email and is the highest-value item in this
file after session revocation.

## Referer leakage

A reset link contains a credential in the URL path. If the reset page loads any
third-party resource — an analytics script, a font, an embedded image — the full
URL goes out in the `Referer` header.

```python
SECURE_REFERRER_POLICY = "same-origin"
```

is set by `settings_security.py` and covers the server-rendered case. For the
SPA route, also ensure the reset page loads no third-party assets, and strip the
token from the URL once consumed (`history.replaceState`) so it does not sit in
browser history.

## Verification

```bash
# Enumeration: real and fake addresses must be indistinguishable.
curl -s -w '\n%{http_code} %{time_total}s\n' -X POST localhost:8000/api/auth/password-reset/ \
  -H 'Content-Type: application/json' -d '{"email":"real@example.com"}'
curl -s -w '\n%{http_code} %{time_total}s\n' -X POST localhost:8000/api/auth/password-reset/ \
  -H 'Content-Type: application/json' -d '{"email":"nope@nowhere.invalid"}'
# expect: identical bodies, identical status, comparable timing

# Throttle at 3/hour.
for i in $(seq 1 5); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST localhost:8000/api/auth/password-reset/ \
    -H 'Content-Type: application/json' -d '{"email":"real@example.com"}'
done; echo
# expect: ends in 429

# Single use: replay the same token.
# expect: second attempt 400

# Sessions die: use a refresh token issued before the reset.
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/token/refresh/ \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$OLD_REFRESH\"}"
# expect: 401
```

## Common mistakes

- "No account with that email" as an error. That is the oracle.
- `PASSWORD_RESET_TIMEOUT` left at the 3-day default.
- Not revoking sessions after the reset.
- Skipping `validate_password` on the reset path.
- Sending the email inline, which both slows the response and leaks timing.
- A relative reset URL.
- Not notifying the account holder that the password changed.
- Leaving the token in the SPA URL and browser history after use.
