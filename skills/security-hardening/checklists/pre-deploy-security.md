# Pre-deploy security gate

This file owns the mechanical check before any deploy: every line is a command to run or a specific thing to look at, and every line has a defined pass condition.

## How to use it

Set these once per session, then work top to bottom.

```bash
export API=https://api.delhialuminium.com
export ANON=""                       # no token
export USER_TOKEN="<a regular customer's access token>"
export ADMIN_TOKEN="<a superuser's access token>"
```

Get the tokens:

```bash
curl -s -X POST "$API/auth/login/" -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"..."}' | python -m json.tool
```

A line is checked only when its stated pass condition holds. "Looks fine" is not a pass condition. If a command needs an environment you do not have, that is a blocker, not a skip.

**Nothing deploys with an unchecked box.** An exception needs a named owner and a date, recorded in the release notes.

---

## 1. Configuration

- [ ] `python manage.py check --deploy --fail-level WARNING` exits 0 against production environment variables. Zero warnings, not "zero important warnings". (**S4**)
- [ ] `echo $?` after the above prints `0`.
- [ ] `grep -n "^DEBUG" daf_backend/daf_backend/settings.py` shows `DEBUG` read from the environment, not a literal `True`. (**S4**)
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' "$API/nonexistent-path-xyz"` returns `404` with no traceback in the body. Check the body too: `curl -s "$API/nonexistent-path-xyz" | head -c 400` must not contain `Traceback` or `DJANGO_SETTINGS_MODULE`. (**S4**)
- [ ] `curl -sI "$API/" | grep -i strict-transport-security` returns a header with the expected `max-age`.
- [ ] `curl -sI "$API/" | grep -i x-content-type-options` returns `nosniff`.
- [ ] `curl -sI "$API/" | grep -i x-frame-options` returns `DENY`.
- [ ] `curl -sI "$API/" | grep -i referrer-policy` returns `same-origin`.
- [ ] `curl -sI "http://api.delhialuminium.com/" | head -1` returns a `301` to `https://`. (**S4**)
- [ ] Log in through the browser, open DevTools > Application > Cookies: every cookie shows `Secure` and, for the session cookie, `HttpOnly`. (**S4**)
- [ ] `grep -rn "CORS_ALLOW_ALL_ORIGINS" daf_backend/` returns nothing.
- [ ] Cross-origin probe is rejected — the response must have **no** `Access-Control-Allow-Origin` header:
  ```bash
  curl -sI -H 'Origin: https://evil.example' "$API/products/" | grep -i access-control-allow-origin
  # expect: no output
  ```
- [ ] `grep -n "ALLOWED_HOSTS" -A6 daf_backend/daf_backend/settings.py` shows no `'*'` and no entry containing `/` or `://`.
- [ ] Host-header probe is refused: `curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' "$API/products/"` returns `400`.
- [ ] Every entry in `SILENCED_SYSTEM_CHECKS` has a comment with a reason, an owner and a review date.

## 2. Secrets

- [ ] `git grep -nE "PASSWORD['\"]?\s*[:=]\s*['\"][^'\"]{4,}" -- '*.py'` returns nothing. (**S3**)
- [ ] `git grep -nE "\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b" -- '*.py'` returns nothing (Google App Password shape). (**S3**)
- [ ] `git grep -n "os.environ.get('" -- '*.py' | grep -vE "get\('[A-Z_]+'" ` returns nothing — every env lookup uses an UPPERCASE key name, catching the `os.environ.get('<literal secret>')` bug. (**S3**)
- [ ] `gitleaks detect --source . --no-git -v --exit-code 1` exits 0.
- [ ] `gitleaks detect --source . -v --exit-code 1` exits 0 (scans history). (**S3**)
- [ ] `git ls-files | grep -E "^\.env$|\.sqlite3$|\.log$"` returns nothing. (**S3**)
- [ ] `cat .gitignore` contains `.env`, `!.env.example`, `*.log`, `db.sqlite3`, `/media/`.
- [ ] `.env.example` exists, is tracked, and every key in it is present in the production `.env`:
  ```bash
  comm -23 <(grep -oE '^[A-Z_]+' .env.example | sort) <(grep -oE '^[A-Z_]+' .env | sort)
  # expect: no output
  ```
- [ ] `pre-commit run --all-files` passes.
- [ ] Every credential ever committed has been **rotated**, not merely deleted. Name each one and the date it was rotated. (**S3**)
- [ ] `npm run build && grep -rE "(SECRET|API_SECRET|PASSWORD)" dist/assets/*.js` returns nothing — no server secret reached the Vite bundle.

## 3. Permissions

The three-way matrix. Run all nine commands. This is the direct regression test for **S1** and **S2**.

**Products:**

- [ ] Anonymous write is rejected:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/products/" \
    -H 'Content-Type: application/json' \
    -d '{"name":"probe","slug":"probe","productcode":"PROBE1","description":"x","category":1}'
  # expect: 401
  ```
- [ ] Customer write is rejected:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/products/" \
    -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
    -d '{"name":"probe","slug":"probe","productcode":"PROBE1","description":"x","category":1}'
  # expect: 403
  ```
- [ ] Admin write succeeds:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/products/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d '{"name":"probe","slug":"probe-1","productcode":"PROBE1","description":"x","category":1}'
  # expect: 201
  ```

**Categories:**

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/categories/" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `401`.
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/categories/" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `403`. (**S2**)
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/categories/" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `201`.

**Brands:**

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/brands/" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `401`.
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/brands/" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `403`. (**S2**)
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/brands/" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"name":"probe"}'` returns `201`.

**Destructive verbs** — the S2 exploit was a DELETE, so test DELETE explicitly:

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$API/categories/1/" -H "Authorization: Bearer $USER_TOKEN"` returns `403`, and category 1 still exists. (**S2**)
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$API/brands/1/" -H "Authorization: Bearer $USER_TOKEN"` returns `403`.
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$API/products/1/" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"name":"tampered"}'` returns `403`.

**Nested catalog routes** — a locked-down parent is worthless if the child is open:

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$API/product-attributes/1/" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d '{"discountedPrice":"1.00"}'` returns `403` or `404`.
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/product-images/" -H "Authorization: Bearer $USER_TOKEN"` returns `403`.

**Users and roles:**

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' "$API/users/" -H "Authorization: Bearer $USER_TOKEN"` returns `403`, or `200` with only the caller's own record.
- [ ] Self-promotion is rejected:
  ```bash
  curl -s -X PATCH "$API/users/<own-id>/" -H "Authorization: Bearer $USER_TOKEN" \
    -H 'Content-Type: application/json' -d '{"is_superuser":true,"is_staff":true,"role":"admin"}'
  ```
  Returns `403`, **or** returns `200` with `is_superuser`, `is_staff` and `role` unchanged. Re-read via `/auth/me/` to confirm.
- [ ] Cross-account read is rejected: `curl -s -o /dev/null -w '%{http_code}\n' "$API/orders/<another-users-order-id>/" -H "Authorization: Bearer $USER_TOKEN"` returns `404` (preferred) or `403`.
- [ ] `GET /orders/` as a customer returns **only** that customer's orders:
  ```bash
  curl -s "$API/orders/" -H "Authorization: Bearer $USER_TOKEN" | python -c "import sys,json; d=json.load(sys.stdin); print({o.get('user') for o in (d if isinstance(d,list) else d['results'])})"
  # expect: a single user id, or {None}
  ```

**Static review:**

- [ ] Every registered ViewSet declares `permission_classes` in its own class body:
  ```bash
  python manage.py shell -c "
  from daf_backend.urls import router
  bad = [v.__name__ for _, v, _ in router.registry if 'permission_classes' not in vars(v)]
  print('OFFENDERS:', bad or 'none')
  "
  # expect: OFFENDERS: none
  ```
  (**S2**)
- [ ] `grep -rn "AllowAny" --include=views.py . | grep -i viewset` returns nothing. (**S1**)
- [ ] `grep -rn -B2 "return True" --include=permissions.py .` — no `has_permission` or `has_object_permission` ends in an unconditional `return True`. (**S6**)
- [ ] Every `@action` in the codebase either calls `self.get_object()` or checks permissions explicitly.

## 4. Frontend guard tampering (S7/S8)

Manual. Do this in a real browser; there is no curl substitute.

- [ ] Log in as an ordinary customer at `https://www.delhialuminium.com`.
- [ ] Open DevTools > Console and run:
  ```js
  let u = JSON.parse(localStorage.getItem('user'));
  u.is_staff = true;
  u.is_superuser = true;
  u.role = 'admin';
  localStorage.setItem('user', JSON.stringify(u));
  ```
- [ ] Navigate to `/admin`. **Pass condition: redirected away, or the panel does not render.** (**S8**)
- [ ] If the panel does render (a shell before the server check completes is acceptable), open the Network tab and confirm **every** admin API call returns 401 or 403. Not one 200. This is the control that matters. (**S8**)
- [ ] Repeat for `/inventory`. Same pass condition. (**S8**)
- [ ] With the tampered `localStorage` still in place, try an admin write from the UI — add a product, delete a category. Pass condition: the request fails with 403 and nothing changes in the database.
- [ ] Confirm the guard re-verifies server-side: `grep -n "fetchCurrentUser" "daf front/daf frontend/src/Pages/Admin/AdminLayout.jsx"` shows an authoritative check against `/auth/me/`, not only a `localStorage` read.
- [ ] Restore your `localStorage` (log out and back in) so you do not leave a tampered session behind.

## 5. Server authority (S5)

- [ ] Price tampering is ignored. Place an order with a deliberately wrong price and total:
  ```bash
  curl -s -X POST "$API/orders/" -H "Authorization: Bearer $USER_TOKEN" \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $(uuidgen)" \
    -d '{"total_amount":"1.00","payment_method":"cod","contact_number":"01700000000",
         "street_address":"Test","city":"Dhaka",
         "items":[{"product":<id>,"attribute":<attr-id>,"quantity":2,"price":"0.10"}]}' \
    | python -m json.tool
  ```
  **Pass condition:** the created order's `total_amount` equals 2 x the attribute's real price (`discountedPrice` if > 0, else `mainPrice`) — **not** `1.00`. Verify in the database, not only in the response. (**S5**)
- [ ] The stored `OrderItem.price` equals the server-side price, not `0.10`:
  ```bash
  python manage.py shell -c "
  from orders.models import Order
  o = Order.objects.latest('id')
  print(o.id, o.total_amount, [(i.attribute_id, str(i.price)) for i in o.items.all()])
  "
  ```
  (**S5**)
- [ ] `status` cannot be set at creation: the order above has `status = 'pending'` even though the payload can request `completed`. (**S5**)
- [ ] Omitting `attribute` does **not** fall back to a client price — it returns 400. (**S5**)
- [ ] `created_at` cannot be set from the body: post an order with `"created_at":"2020-01-01T00:00:00Z"` and confirm the stored value is now.
- [ ] `git grep -n "fields = '__all__'" -- '*serializers.py'` returns nothing for any serializer used for writes. (**S5**)
- [ ] `grep -rnE "request\.data\.get\(['\"](price|total_amount|discount|is_staff|role|user)" --include=*.py .` returns nothing.
- [ ] Ownership is server-assigned: `grep -rn "serializer.save(user=self.request.user)" --include=views.py .` is present wherever an owned object is created.
- [ ] Idempotency is enforced. Send the same order twice with the same key:
  ```bash
  KEY=$(uuidgen)
  for i in 1 2; do
    curl -s -o /dev/null -w "$i: %{http_code}\n" -X POST "$API/orders/" \
      -H "Authorization: Bearer $USER_TOKEN" -H "Idempotency-Key: $KEY" \
      -H 'Content-Type: application/json' -d '{...valid order...}'
  done
  # expect: 201 then 200 or 409 — and exactly ONE new Order row
  ```
  (**N10**)
- [ ] Order count increased by exactly one after the above: `python manage.py shell -c "from orders.models import Order; print(Order.objects.count())"` before and after. (**N10**)
- [ ] `transaction_id` is `unique=True` on `Order`, and a client-supplied one does not set payment to paid.
- [ ] Stock cannot go negative: place an order for more units than `stock_quantity`. Returns 400; `stock_quantity` unchanged.
- [ ] `/orders/<id>/track/` is not enumerable: `curl -s -o /dev/null -w '%{http_code}\n' "$API/orders/1/track/"` returns 401/403/404, not 200 with another customer's details.

## 6. Throttling (N2)

- [ ] A shared cache is configured — run this **twice, in two separate shells**; the second must print the value, not `None`:
  ```bash
  python manage.py shell -c "
  from django.core.cache import cache
  print(cache.get('probe'), cache.__class__.__name__); cache.set('probe','ok',300)
  "
  ```
  (**N2**)
- [ ] `grep -rn "LocMemCache" daf_backend/` returns nothing outside test settings. (**N2**)
- [ ] OTP verification throttles:
  ```bash
  for i in $(seq 1 12); do
    printf '%s: ' "$i"
    curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/auth/verify-otp/" \
      -H 'Content-Type: application/json' \
      -d '{"email":"probe@example.com","otp":"000000"}'
  done
  # expect: at least one 429 before the 12th request
  ```
  (**N2**)
- [ ] The 429 response carries a `Retry-After` header.
- [ ] Rotating the source IP does not reset the budget for one email — repeat the loop with varying `X-Forwarded-For` and confirm 429 still appears. (**N2**)
- [ ] Login throttles: same loop against `/auth/login/` with a wrong password produces a 429. (**N2**)
- [ ] Registration throttles: repeated POSTs to `/auth/registration/` produce a 429. (**N2**)
- [ ] Order creation throttles: more than 30 orders in an hour from one account produces a 429.
- [ ] OTP hardening in code: `grep -n "secrets\|compare_digest\|otp_sent_at\|otp_attempts" daf_backend/api/views.py daf_backend/api/serializers.py` shows a CSPRNG, a constant-time compare, an expiry and an attempt counter. (**N2**)
- [ ] `grep -rn "random.randint" daf_backend/api/` returns nothing. (**N2**)
- [ ] `NUM_PROXIES` matches the real proxy count in front of the app.
- [ ] No throttle rate uses a period other than `second`/`minute`/`hour`/`day`.

## 7. Uploads (N5)

- [ ] A renamed PHP file is rejected:
  ```bash
  printf '<?php system($_GET["c"]); ?>' > /tmp/shell.jpg
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/product-images/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F 'image=@/tmp/shell.jpg;type=image/jpeg'
  # expect: 400
  ```
  (**N5**)
- [ ] A polyglot is rejected:
  ```bash
  printf 'GIF89a' > /tmp/poly.gif && printf '<?php system($_GET["c"]); ?>' >> /tmp/poly.gif
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/product-images/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -F 'image=@/tmp/poly.gif;type=image/gif'
  # expect: 400
  ```
  (**N5**)
- [ ] An SVG is rejected. (**N5**)
- [ ] A 20 MB file is rejected with 400 or 413. (**N5**)
- [ ] A traversal filename is neutralised — upload a valid PNG named `../../evil.png` and confirm the stored path contains neither `..` nor `evil`. (**N5**)
- [ ] `git grep -n "upload_to=" -- '*models.py' | grep -v safe_upload_to` returns nothing. (**N5**)
- [ ] `git grep -n "ImageField\|FileField" -- '*models.py' | grep -v validators` returns nothing. (**N5**)
- [ ] EXIF is stripped: upload a photo with GPS tags, download the stored file, and confirm `exiftool` or `Image.getexif()` shows no GPS block. (**N5**)
- [ ] Media does not execute: request an uploaded file's URL and confirm the response is the raw bytes with `X-Content-Type-Options: nosniff`, not executed output.
- [ ] `curl -sI "$API/media/<some-upload>" | grep -iE 'content-disposition|x-content-type-options'` shows the expected headers for non-image types.
- [ ] `MEDIA_ROOT` is outside any directory the web server executes, or media is served from Cloudinary. (**N5**)
- [ ] No Cloudinary unsigned upload preset exists in the console. (**N5**)
- [ ] The invoice PDF renderer refuses remote and local-file URIs:
  ```bash
  python manage.py shell -c "
  from orders.utils import safe_link_callback
  print(repr(safe_link_callback('file:///etc/passwd', None)))
  print(repr(safe_link_callback('http://169.254.169.254/', None)))
  print(repr(safe_link_callback('/static/../../settings.py', None)))
  "
  # expect: '' three times
  ```
  (**N5**)
- [ ] Place an order with `street_address` set to `<img src="file:///etc/passwd">`, generate the invoice, and confirm the PDF contains no file contents. (**N5**)

## 8. Data exposure

- [ ] `buying_price` does not appear in any public response: `curl -s "$API/products/" | grep -c buying_price` returns `0`.
- [ ] `otp` does not appear in any response: `curl -s "$API/auth/me/" -H "Authorization: Bearer $USER_TOKEN" | grep -c '"otp"'` returns `0`.
- [ ] No password hash appears in any response: `curl -s "$API/users/" -H "Authorization: Bearer $ADMIN_TOKEN" | grep -c "pbkdf2\|argon2"` returns `0`.
- [ ] Unknown-email and wrong-OTP produce the **same** status and body shape, so the endpoint is not an enumeration oracle:
  ```bash
  curl -s -X POST "$API/auth/verify-otp/" -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","otp":"000000"}'
  curl -s -X POST "$API/auth/verify-otp/" -H 'Content-Type: application/json' -d '{"email":"real@example.com","otp":"000000"}'
  # expect: identical status and message
  ```
- [ ] `/auth/check-username/` has a throttle attached.
- [ ] List endpoints are paginated: `curl -s "$API/products/" | python -c "import sys,json; d=json.load(sys.stdin); print(type(d), len(d) if isinstance(d,list) else d.get('count'))"` — a bare list of every row is a finding.
- [ ] The production 500 page shows no traceback. Trigger one deliberately in staging if you cannot in production. (**S4**)

## 9. Audit logging (N9)

- [ ] An `AuditLog` model exists and has rows. (**N9**)
- [ ] A role change writes an entry with actor, action, target, before, after, IP and timestamp:
  ```bash
  python manage.py shell -c "
  from api.models import AuditLog
  e = AuditLog.objects.filter(action='user.role_changed').latest('created_at')
  print(e.actor_email, e.action, e.target_id, e.before, e.after, e.ip, e.created_at)
  "
  ```
  (**N9**)
- [ ] Price changes, order status changes and stock adjustments each produce an entry. (**N9**)
- [ ] The log is append-only: `AuditLog.objects.latest('id').save()` raises, and `.delete()` raises. (**N9**)
- [ ] The Django admin for `AuditLog` has add, change and delete all disabled. (**N9**)
- [ ] Failed authorizations, 429s and payment-verification failures are recorded, not only successes. (**N9**)
- [ ] No audit entry contains a password, OTP or token in `before`/`after`. (**S3**, **N9**)

## 10. Post-deploy smoke

- [ ] The storefront loads over HTTPS with no mixed-content warnings in the console.
- [ ] A customer can register, receive an OTP email, verify, and log in.
- [ ] A customer can place a COD order and the stored `total_amount` matches the catalogue price in ৳.
- [ ] The invoice email arrives with a correctly rendered PDF, timestamps in `Asia/Dhaka`.
- [ ] An admin can log in, add a product with an image, and see it on the storefront.
- [ ] An inventory manager can record a godown receive and cannot reach the sales report.
- [ ] `stderr.log` contains no new tracebacks after the smoke run and no credential-shaped strings.
- [ ] Rotate any token you created for this checklist, and delete the probe products, categories and brands.

---

## These lines are the test suite

Every box above is a statement about behaviour with a defined pass condition, which means every one of them can be an automated test. That is the point of writing them this way.

**This file is the source of truth for the `testing-harness` skill.** The mapping is direct:

| Section | Test form |
| --- | --- |
| 1. Configuration | `SimpleTestCase` asserting settings values; `check --deploy` as a CI step |
| 2. Secrets | `gitleaks` in CI; a test asserting no literal credentials in tracked source |
| 3. Permissions | `APITestCase` per resource: anonymous 401, customer 403, admin 201 |
| 4. Frontend guard | Playwright/Cypress: tamper `localStorage`, assert redirect and assert every API call returns 403 |
| 5. Server authority | `APITestCase` posting a tampered price, asserting the stored value is the catalogue value |
| 6. Throttling | `APITestCase` with `override_settings` on the rates and `cache.clear()` in `setUp` |
| 7. Uploads | `APITestCase` with `SimpleUploadedFile` for each rejected payload |
| 8. Data exposure | Response-shape assertions on serializer output |
| 9. Audit logging | Assert an `AuditLog` row exists with the right fields after each privileged action |

Rules for that port:

- **A curl command becomes an `APITestCase` method, not a shell script.** Same three actors, same expected status codes.
- **The audit ID goes in the test docstring.** `"""Regression test for S2."""` tells the next person why the test exists, so they fix the code instead of deleting the test.
- **When a new vulnerability is found, a line is added here first,** then the test. This file stays the human-readable index of what the suite guarantees.
- **Manual-only lines stay manual.** Section 4's browser tampering and the Cloudinary console check have no automated form; they belong in a release runbook and must not be quietly dropped because they cannot be scripted.

## Related

- `../references/01-permissions.md` — section 3
- `../references/02-throttling.md` — section 6
- `../references/03-settings-hardening.md` — section 1
- `../references/04-secrets.md` — section 2
- `../references/05-uploads.md` — section 7
- `../references/06-server-authority.md` — section 5
- `../references/07-threat-model.md` — the review that feeds this gate, and section 9
