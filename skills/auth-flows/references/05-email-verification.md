# Email verification

Proving the address belongs to the person who typed it, and deciding what is
gated behind that proof.

## Why it matters here

Without verification anyone can register `ceo@yourcompany.com`, receive order
confirmations at an address they do not control, and — if any part of the system
treats email as identity — collide with a real account. For a store that emails
invoices, it also means bounces, spam complaints, and a sender reputation that
degrades until legitimate mail stops arriving.

The project currently has `ACCOUNT_EMAIL_VERIFICATION = 'optional'`, which
verifies nothing and gates nothing.

## Decide what verification gates

This is a product decision with security consequences. Write it down.

| Level | Gate | Fits |
|---|---|---|
| `none` | Nothing | Never for a store that sends transactional mail |
| `optional` | Send the mail, allow everything regardless | Reduces friction, verifies nothing. The current setting |
| `mandatory` | No login until verified | Highest assurance, highest signup drop-off |
| **`gated`** | Login allowed; **checkout blocked** | **Recommended** |

`gated` is the right default for this project: a shopper can browse, build a
cart and sign in immediately, and the wall appears at the one action where a
working address actually matters. Enforce it with
`IsAuthenticatedAndVerified` from
[`permissions.py`](../../security-hardening/assets/permissions.py) on the
order-create endpoint, never in the frontend alone.

```python
class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrOwner]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticatedAndVerified()]
        return super().get_permissions()
```

## Model fields

```python
class CustomUser(AbstractUser):
    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
```

Both. The boolean is what permissions read; the timestamp is what support and
audits read.

## Flow

Reuse [`otp.py`](../assets/backend/otp.py) with `purpose=VERIFY_EMAIL` — you get
hashing, expiry, attempt caps and throttling for free rather than building a
second, weaker token path.

```python
class SendVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_issue"

    def post(self, request):
        if request.user.is_email_verified:
            return Response({"detail": "Your email is already verified."})
        code = issue_otp(request.user, OTPPurpose.VERIFY_EMAIL)
        queue_verification_email(request.user, code)
        return Response({"detail": "Verification code sent."})


class ConfirmVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        # verify_otp(user, purpose, code) -> bool. See assets/backend/otp.py.
        if not verify_otp(
            request.user,
            OTPPurpose.VERIFY_EMAIL,
            request.data.get("code") or "",
        ):
            return Response({"detail": "That code is not valid."}, status=400)

        request.user.is_email_verified = True
        request.user.email_verified_at = timezone.now()
        request.user.save(update_fields=["is_email_verified", "email_verified_at"])
        return Response({"detail": "Email verified."})
```

## Changing an email address must un-verify it

The single most commonly missed rule. If a user changes their address from a
verified one to a new one, verification does not carry over:

```python
    def update(self, instance, validated_data):
        new_email = validated_data.get("email")
        if new_email and new_email.lower() != (instance.email or "").lower():
            instance.is_email_verified = False
            instance.email_verified_at = None
            # Tell the OLD address, so a hijacker cannot silently move the
            # account to a mailbox they control.
            queue_email_changed_notice(instance, old=instance.email, new=new_email)
        return super().update(instance, validated_data)
```

Better still, for an account that can place orders: hold the change pending
until the new address confirms, so the account is never in a state where the
address on file is unproven *and* mail is going there.

## Email uniqueness

`AbstractUser.email` is not unique by default. If any flow treats email as an
identifier — password reset, OTP login, "email or username" sign-in — it must
be, or those flows become ambiguous.

```python
    email = models.EmailField(unique=True)
```

Enforce case-insensitively too. `Ifti@example.com` and `ifti@example.com` are the
same mailbox everywhere in practice:

```python
    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("email"), name="user_email_ci_unique",
            ),
        ]
```

Normalise to lowercase on write so the constraint never surprises anyone.

## Do not block on the mail send

```python
# WRONG — the signup request now depends on Gmail's latency.
send_mail(...)
return Response({"detail": "Registered"})
```

SMTP takes 300 ms to several seconds and can time out entirely. A registration
that fails because the mail server was slow is a registration lost. Queue it.
(Audit ref: C3 — the same defect on the invoice path.)

## Frontend

`is_email_verified` arrives in `/auth/me/` and drives UI affordances only:

```jsx
{user && !user.is_email_verified && (
  <VerifyBanner onResend={resendVerification} />
)}
```

Show the wall before checkout as a courtesy so the user is not surprised by a
403, but the 403 is what enforces it. The banner is UX; the permission class is
security.

## Verification

```bash
# Unverified user cannot place an order.
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/orders/ \
  -H "Authorization: Bearer $UNVERIFIED_TOKEN" \
  -H 'Content-Type: application/json' -d '{"items":[]}'
# expect: 403

# Same user, verified, reaches validation instead of the permission wall.
# expect: 400 (empty items) — NOT 403

# Changing email clears the flag.
curl -s -X PATCH localhost:8000/api/auth/me/ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"email":"new@example.com"}'
curl -s localhost:8000/api/auth/me/ -H "Authorization: Bearer $TOKEN" | grep is_email_verified
# expect: false
```

## Common mistakes

- Leaving `ACCOUNT_EMAIL_VERIFICATION = 'optional'` and believing it does
  something.
- Gating checkout in the frontend only.
- Not clearing the flag when the address changes.
- Non-unique, case-sensitive email while using it as a login identifier.
- Blocking the signup response on SMTP.
- A verification link or code with no expiry.
