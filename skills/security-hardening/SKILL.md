---
name: security-hardening
description: Harden a Django REST Framework + React application against the vulnerability classes that actually ship — open write endpoints, client-trusted prices and roles, missing rate limits, unvalidated uploads, leaked secrets, and insecure production settings. Provides copy-ready DRF permission classes, a production settings block, upload validators, and a pre-deploy gate. Trigger on "secure the API", "add permissions", "who can access this", "harden", "lock down", "security review", "is this safe", "rate limit", "throttle", "permission class", "validate uploads", "check --deploy", "before we deploy", "prevent price manipulation", "server-side validation".
---

# Security Hardening

The single source of truth for security decisions in this stack. Nothing else in
the suite re-decides these — other skills reference this one.

Every rule here traces to a defect found in a real audit of this project. The IDs
(S1–S8, N1–N10) are used throughout so a fix is always tied to the failure it
prevents.

## When to use

Use this skill whenever you are:

- Writing or reviewing any DRF `ViewSet`, `APIView` or permission class
- Adding an endpoint that accepts money, quantities, roles, ownership, or status
- Accepting a file upload
- Touching `settings.py`, `.env`, or anything that reads a secret
- Preparing to deploy
- Asked "is this secure", "can a customer do X", or "what if someone tampers with Y"

Do **not** use it for identity flows — login, OTP, password reset, sessions,
tokens, and role assignment belong to `auth-flows`.

## The three rules

Everything in this skill reduces to these. If you remember nothing else:

1. **Every ViewSet declares `permission_classes` explicitly.**
   Never inherit the global default. A reader must see the access policy without
   opening `settings.py`. *(S1, S2)*

2. **The client may propose; only the server decides.**
   Price, total, role, ownership, stock, status and payment confirmation are
   computed or verified server-side. Client values are advisory at best.
   *(S5, S7, S8)*

3. **Fail closed.**
   A permission class enumerates what is allowed and denies the rest. A
   validator rejects what it does not recognise. An unresolvable owner is a
   denial, not a pass. *(S6)*

## Decision rules

| Situation | Use | Reference |
|---|---|---|
| Public catalog: products, categories, brands, images | `IsAdminOrReadOnly` | [01](./references/01-permissions.md) |
| Staff-only data: users, buying prices, suppliers, reports | `IsAdminOnly` | [01](./references/01-permissions.md) |
| Customer-owned: orders, addresses, own profile | `IsStaffOrOwner` + queryset scoping | [01](./references/01-permissions.md) |
| User-authored content: reviews | `IsOwnerOrReadOnly` | [01](./references/01-permissions.md) |
| Role-gated: godown receive/dispatch, stock adjustment | `HasRole("inventory_manager")` | [01](./references/01-permissions.md) |
| Inbound-only: contact form, newsletter | `IsAdminOrWriteOnly` | [01](./references/01-permissions.md) |
| Any auth, OTP, or high-cost endpoint | Scoped throttle | [02](./references/02-throttling.md) |
| Endpoint accepts a price, total, or quantity | Recompute server-side | [06](./references/06-server-authority.md) |
| Endpoint accepts a file | `validate_image_file` + `safe_upload_to` | [05](./references/05-uploads.md) |
| Preparing settings for production | `settings_security.py` + `check --deploy` | [03](./references/03-settings-hardening.md) |
| A secret was committed | Rotate first, then scrub history | [04](./references/04-secrets.md) |
| Before any deploy | Run the gate | [checklist](./checklists/pre-deploy-security.md) |

## Workflow

1. **Identify the resource class.** Public / staff-only / owner-scoped /
   role-gated / inbound-only. Use the decision table above.
2. **Install the assets** if not already present: copy
   [`assets/permissions.py`](./assets/permissions.py) to `api/permissions.py`
   and [`assets/validators.py`](./assets/validators.py) to `common/validators.py`.
3. **Declare `permission_classes` explicitly** on the view. Never leave it off.
4. **Scope the queryset** if the resource is owner-scoped — a permission class
   does not filter list routes.
5. **Recompute anything that matters** from the database. Never persist a price,
   total, role or status that arrived in a request body.
6. **Attach a throttle scope** if the endpoint is auth-related, sends email or
   SMS, or is expensive.
7. **Validate uploads** with the validators, and generate the filename with
   `safe_upload_to`.
8. **Run the verification below.**

## Verification

Every claim this skill makes is checkable. Run these — do not assume.

```bash
# 1. Deployment checks must be clean. Zero warnings, not "only warnings we know about".
python manage.py check --deploy

# 2. The permission matrix. Substitute a real product id.
#    Anonymous write must be rejected.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/products/ \
  -H 'Content-Type: application/json' -d '{"title":"pwned"}'
# expect: 401

#    Authenticated non-staff write must be rejected.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/products/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"pwned"}'
# expect: 403

#    Staff write must succeed.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/products/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"ok", ...}'
# expect: 200 or 201

# Repeat all three for /api/categories/ and /api/brands/ — S2 was found there.

# 3. Server authority. Place an order claiming a price of 1.
curl -s -X POST http://localhost:8000/api/orders/place_order/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"attribute":1,"quantity":1,"price":1}],"total_amount":1}'
# then confirm in the database that OrderItem.price is the real
# ProductAttribute price and Order.total_amount is the recomputed sum.

# 4. Throttling is active.
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:8000/api/auth/otp/request/ \
    -H 'Content-Type: application/json' -d '{"email":"someone@example.com"}'
done; echo
# expect: the tail of the sequence is 429

# 5. No secrets are tracked.
git ls-files | xargs grep -lEi '(SECRET_KEY|PASSWORD|API_KEY)\s*=\s*["'"'"'][^"'"'"']{8,}' 2>/dev/null
# expect: no output
```

A finding on any line is a blocker, not a note.

## Related skills

| Skill | Relationship |
|---|---|
| `auth-flows` | Owns identity: login, OTP, tokens, sessions, role assignment. This skill owns what a role is *allowed to do*. |
| `data-layer` | Owns DB-level constraints. Prefer a `CheckConstraint` over a validator when the rule is about data integrity rather than authorisation. |
| `api-contract` | Owns the error envelope these permission denials are returned in. |
| `testing-harness` | Turns [`checklists/pre-deploy-security.md`](./checklists/pre-deploy-security.md) into automated regression tests. That checklist is the source of truth. |
| `deploy-and-env` | Owns where secrets live and how env vars are validated at startup. |

## Reference files

- [01-permissions.md](./references/01-permissions.md) — the permission decision tree *(S1, S2, S6)*
- [02-throttling.md](./references/02-throttling.md) — DRF throttling and rate limits *(N2)*
- [03-settings-hardening.md](./references/03-settings-hardening.md) — production settings, line by line *(S4)*
- [04-secrets.md](./references/04-secrets.md) — `.env`, rotation, git history *(S3)*
- [05-uploads.md](./references/05-uploads.md) — file upload security *(N5)*
- [06-server-authority.md](./references/06-server-authority.md) — what never to trust from a client *(S5)*
- [07-threat-model.md](./references/07-threat-model.md) — the pre-ship threat model *(N9)*
- [checklists/pre-deploy-security.md](./checklists/pre-deploy-security.md) — the deploy gate

## Assets

- [permissions.py](./assets/permissions.py) — `ReadOnly`, `IsAdminOrReadOnly`, `IsAdminOnly`, `IsOwnerOrReadOnly`, `IsStaffOrOwner`, `IsAdminOrWriteOnly`, `HasRole()`, `IsAuthenticatedAndVerified`
- [settings_security.py](./assets/settings_security.py) — the production settings block and throttle rates
- [validators.py](./assets/validators.py) — `validate_image_file`, `validate_document_file`, `MaxFileSizeValidator`, `safe_upload_to`, `strip_image_metadata`

Copy these verbatim. Do not retype them — a retyped permission class is how S6
happened.

## Common mistakes

- **Relying on `DEFAULT_PERMISSION_CLASSES`.** The default exists as a backstop,
  not as policy. A ViewSet without an explicit declaration is a bug even when
  the default happens to be correct today. *(S2)*
- **A permission class that returns `True` by default.** `has_permission`
  returning an unconditional `True`, or an object check that falls through to
  `True` for unhandled methods, provides no protection. DELETE lands in that
  fall-through. *(S6)*
- **Assuming `has_object_permission` protects a list route.** It is never called
  for list. Scope `get_queryset()` or you return every customer's orders.
- **Assuming `has_object_permission` protects a create.** It is not called on
  POST either. Validate ownership in the serializer or `perform_create()`.
- **Trusting a client-supplied price because "the frontend calculates it
  correctly".** The frontend is a suggestion box. *(S5)*
- **Hiding an admin button and calling it access control.** If the endpoint is
  open, the button is irrelevant. *(S7)*
- **Trusting `Content-Type` on an upload.** It is set by the client. Check magic
  bytes. *(N5)*
- **Deleting a committed secret without rotating it.** It is in the git history,
  in every clone, and in every fork. Removal is cleanup; rotation is the fix. *(S3)*
- **Throttling with `LocMemCache`.** It is per-process. Behind four gunicorn
  workers an attacker gets four times the rate, and a restart resets every
  counter. *(N2)*
