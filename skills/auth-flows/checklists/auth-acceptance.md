# Auth acceptance checklist

Every line is a command or a scripted browser action with a stated pass
condition. Nothing here is "review the code and think about it."

`testing-harness` converts each section into an automated test. This file is the
source of truth for what those tests assert.

Set up once:

```bash
BASE=http://localhost:8000/api
CUST=$(curl -s -X POST $BASE/token/ -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"..."}' | jq -r .access)
STAFF=$(curl -s -X POST $BASE/token/ -H 'Content-Type: application/json' \
  -d '{"email":"staff@example.com","password":"..."}' | jq -r .access)
```

---

## 1. Server-verified identity

```bash
# /auth/me/ exists and requires a token.
curl -s -o /dev/null -w '%{http_code}\n' $BASE/auth/me/
# PASS: 401

curl -s $BASE/auth/me/ -H "Authorization: Bearer $CUST" | jq '{email,role,is_staff,is_email_verified}'
# PASS: real values, is_staff false

# The frontend never derives a role from a token or from storage.
grep -rn "jwt-decode\|jwtDecode\|atob(" ../daf\ front/src/ --include=*.jsx --include=*.js
# PASS: no output, or matches only in code that does not gate access

# No storage read feeds an access decision.
grep -rn "localStorage" ../daf\ front/src/ | grep -iE "is_staff|isAdmin|role"
# PASS: no output
```

Browser, the S8 regression test:

1. Sign in as a normal customer.
2. Console: `const u=JSON.parse(localStorage.getItem('user')); u.is_staff=true; u.role='admin'; localStorage.setItem('user',JSON.stringify(u));`
3. Navigate to `/admin`.

**PASS:** redirected away. **FAIL (S8):** the admin shell renders.

4. From that tampered session: `fetch('/api/products/',{method:'POST',headers:{'Authorization':'Bearer '+localStorage.getItem('access_token'),'Content-Type':'application/json'},body:'{"title":"x"}'}).then(r=>console.log(r.status))`

**PASS:** 403.

---

## 2. Token lifetimes and rotation

```bash
grep -A12 "SIMPLE_JWT" ../daf_backend/*/settings.py
# PASS: ACCESS_TOKEN_LIFETIME <= 15 min
#       ROTATE_REFRESH_TOKENS True
#       BLACKLIST_AFTER_ROTATION True
#       'rest_framework_simplejwt.token_blacklist' in INSTALLED_APPS

# Refresh returns a NEW refresh token.
NEW=$(curl -s -X POST $BASE/token/refresh/ -H 'Content-Type: application/json' \
  -d "{\"refresh\":\"$REFRESH\"}")
echo "$NEW" | jq 'has("refresh")'
# PASS: true

# The old one is dead.
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/token/refresh/ \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$REFRESH\"}"
# PASS: 401
```

Browser: one expired-token page load must produce **one** `/token/refresh/`
call in the network tab, not one per in-flight request.

---

## 3. Role revocation takes effect

```bash
# Promote, then demote while the token is still live.
python manage.py shell -c "
from django.contrib.auth import get_user_model
u=get_user_model().objects.get(email='staff@example.com'); u.is_staff=False; u.save()"

curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/products/ \
  -H "Authorization: Bearer $STAFF" -H 'Content-Type: application/json' -d '{"title":"x"}'
# PASS: 403 immediately — NOT after the access token expires
```

This fails if any permission reads `is_staff` from the token payload rather than
from `request.user`.

---

## 4. OTP

```bash
# Issue is throttled.
for i in $(seq 1 7); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE/auth/otp/request/ \
    -H 'Content-Type: application/json' -d '{"email":"customer@example.com"}'
done; echo
# PASS: ends in 429

# Verify is throttled independently of issue.
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE/auth/otp/verify/ \
    -H 'Content-Type: application/json' -d '{"email":"customer@example.com","code":"000000"}'
done; echo
# PASS: ends in 429

# Codes are not stored in cleartext.
python manage.py shell -c "
from api.otp import OTPCode
print([t.code_hash[:12] for t in OTPCode.objects.all()[:3]])"
# PASS: 64-char hex prefixes. FAIL: six digits

# No plaintext code field survives on the user model.
grep -n "otp" ../daf_backend/api/models.py | grep -i "charfield(max_length=6"
# PASS: no output
```

Also assert, in code or by inspection:

- Expiry ≤ 10 minutes, checked on verify.
- `attempts` incremented on failure, capped at 5.
- Consumed codes rejected on replay.
- Comparison via `hmac.compare_digest`.
- Codes from `secrets`, never `random`.
- A wrong code and an unknown email return the same body and status.

---

## 5. Password reset

```bash
# Enumeration-safe.
curl -s -X POST $BASE/auth/password-reset/ -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com"}'
curl -s -X POST $BASE/auth/password-reset/ -H 'Content-Type: application/json' \
  -d '{"email":"nobody@nowhere.invalid"}'
# PASS: byte-identical bodies and statuses

grep -n "PASSWORD_RESET_TIMEOUT" ../daf_backend/*/settings.py
# PASS: <= 3600
```

- Token is single-use — replay returns 400.
- `validate_password` runs on the reset path.
- All sessions revoked after reset (see §6).
- The account holder is emailed that the password changed.

---

## 6. Session revocation

```bash
curl -s -X POST $BASE/auth/logout/ -H "Authorization: Bearer $CUST" \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$REFRESH\"}"
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/token/refresh/ \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$REFRESH\"}"
# PASS: 401

# Deactivating a user kills their refresh tokens.
python manage.py shell -c "
from django.contrib.auth import get_user_model
u=get_user_model().objects.get(email='customer@example.com')
u.is_active=False; u.save(); u.revoke_all_sessions()"
# PASS: subsequent refresh 401, and access is rejected within one access lifetime
```

- `is_active=False` blocks new logins *and* refreshes.
- Password change revokes every session.
- Blacklisted-token cleanup runs on a schedule.

---

## 7. Email verification

```bash
# Unverified cannot check out.
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/orders/ \
  -H "Authorization: Bearer $UNVERIFIED" -H 'Content-Type: application/json' -d '{"items":[]}'
# PASS: 403

# Verified reaches validation, not the wall.
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/orders/ \
  -H "Authorization: Bearer $VERIFIED" -H 'Content-Type: application/json' -d '{"items":[]}'
# PASS: 400

# Changing the address clears the flag.
curl -s -X PATCH $BASE/auth/me/ -H "Authorization: Bearer $CUST" \
  -H 'Content-Type: application/json' -d '{"email":"changed@example.com"}'
curl -s $BASE/auth/me/ -H "Authorization: Bearer $CUST" | jq .is_email_verified
# PASS: false
```

---

## 8. Roles

```bash
# Role is not writable through the profile endpoint.
curl -s -X PATCH $BASE/auth/me/ -H "Authorization: Bearer $CUST" \
  -H 'Content-Type: application/json' -d '{"role":"admin","is_staff":true}'
curl -s $BASE/auth/me/ -H "Authorization: Bearer $CUST" | jq '{role,is_staff}'
# PASS: unchanged

# Registration cannot self-elevate.
curl -s -X POST $BASE/auth/register/ -H 'Content-Type: application/json' \
  -d '{"email":"esc@example.com","password":"...","is_staff":true,"role":"admin"}'
# PASS: created as customer, or 400 — never staff
```

- Every privileged endpoint declares `permission_classes` explicitly.
- Role changes are written to the audit log with actor, target, before and after.

---

## 9. Social auth

```bash
grep -rn "SOCIALACCOUNT_EMAIL_AUTHENTICATION\|SOCIALACCOUNT_EMAIL_VERIFICATION" \
  ../daf_backend/*/settings.py
# PASS: EMAIL_AUTHENTICATION False, EMAIL_VERIFICATION "mandatory"

python manage.py shell -c "
from allauth.socialaccount.models import SocialAccount
print([a.user.email for a in SocialAccount.objects.select_related('user')
       if a.user.is_staff or a.user.role!='customer'])"
# PASS: []
```

- An unverified provider email never links to an existing account.
- Any `id_token` accepted from the client is signature- and audience-verified.
- The last credential cannot be unlinked.

---

## 10. Transport and storage

```bash
grep -nE "SESSION_COOKIE_SECURE|CSRF_COOKIE_SECURE|SESSION_COOKIE_HTTPONLY|SECURE_SSL_REDIRECT" \
  ../daf_backend/*/settings.py
# PASS: all True under production

grep -rn "CORS_ALLOW_ALL_ORIGINS" ../daf_backend/*/settings.py
# PASS: absent, or False in production
```

Browser: after signing in, DevTools → Application → Local Storage.

**If the httpOnly-cookie mode is in use:** no `refresh_token` key. **PASS.**
**If the localStorage mode is in use:** the tradeoff is documented and accepted —
see [01-token-strategy.md](../references/01-token-strategy.md). Note it, do not
silently pass.

---

## Sign-off

| § | Area | Result |
|---|---|---|
| 1 | Server-verified identity, S8 regression | |
| 2 | Token lifetimes and rotation | |
| 3 | Role revocation is immediate | |
| 4 | OTP hardening | |
| 5 | Password reset | |
| 6 | Session revocation | |
| 7 | Email verification gate | |
| 8 | Roles and escalation | |
| 9 | Social auth linking | |
| 10 | Transport and storage | |

A blank or failing row blocks release. §1 and §3 are the two that were actually
exploitable in production — never sign those off from code reading alone.
