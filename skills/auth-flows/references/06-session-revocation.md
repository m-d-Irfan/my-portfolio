# Session revocation

Getting access back after you have granted it. Owns logout, logout-everywhere,
and the stale-claims problem.

## The problem (N4)

A JWT is a signed assertion, not a database lookup. Once issued, it is valid
until it expires — the server does not consult anything to accept it.

So when an admin is demoted:

```python
user.is_staff = False
user.save()
```

…they keep their admin access. Their access token still says `is_staff: true`,
it is still correctly signed, and every request presenting it is still accepted.
With the original `ACCESS_TOKEN_LIFETIME` of 60 minutes, that is an hour of
admin access after the moment of revocation.

The same applies to a compromised account: changing the password does not
invalidate tokens already in the attacker's hands.

## What `BLACKLIST_AFTER_ROTATION` does not do

```python
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

This is widely assumed to solve revocation. It does not.

| Setting | Effect |
|---|---|
| `ROTATE_REFRESH_TOKENS` | Each refresh issues a **new** refresh token |
| `BLACKLIST_AFTER_ROTATION` | The **old refresh** token is recorded in `token_blacklist` and rejected thereafter |

Both operate on **refresh** tokens only. Access tokens are never checked against
the blacklist — that is the entire point of a stateless access token, and
checking would mean a database read per request.

So blacklisting bounds how long a stolen *refresh* token is useful. It does
nothing about the access token in flight.

## Three mitigations

| Approach | Revocation delay | Cost | Use when |
|---|---|---|---|
| Short access lifetime | Up to the lifetime | None | Always. Baseline |
| `token_version` claim | Immediate | One integer column, one comparison per request | Recommended default |
| Per-request deny-list | Immediate | A cache read per request | High-security, or when you need per-token revocation |

### 1. Short access lifetime — do this regardless

```python
"ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
```

15 minutes, not 60. This is the window everything else is measured against, and
shortening it is free — the refresh flow already exists and the frontend already
handles 401 transparently.

### 2. `token_version` — the recommended default

One integer on the user. Bump it, and every token issued before the bump stops
being accepted.

```python
# api/models.py
class CustomUser(AbstractUser):
    # Incremented on password change, role change, or forced logout. Any token
    # carrying an older value is rejected.
    token_version = models.PositiveIntegerField(default=0)

    def revoke_all_sessions(self):
        type(self).objects.filter(pk=self.pk).update(token_version=F("token_version") + 1)
```

Put it in the token:

```python
# api/serializers.py
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["tv"] = user.token_version
        # NOTE: is_staff is deliberately NOT a claim. A claim is a snapshot at
        # issue time; putting a role in it invites the client to decode and
        # trust it, and guarantees the value is stale after any change.
        # Roles come from GET /auth/me/. See 02-server-verified-roles.md.
        return token
```

Check it on every request:

```python
# api/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class VersionedJWTAuthentication(JWTAuthentication):
    """JWTAuthentication that rejects tokens issued before the last revocation."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if validated_token.get("tv", 0) != user.token_version:
            raise InvalidToken("This session has been revoked. Please sign in again.")
        return user
```

```python
# settings.py
"DEFAULT_AUTHENTICATION_CLASSES": ("api.authentication.VersionedJWTAuthentication",),
```

The cost is one comparison against a user row the request was already going to
load. Revocation becomes immediate and global for that user.

### 3. Per-request deny-list

Store revoked `jti` values in Redis with a TTL matching the access lifetime, and
check on every request. Use this when you need to revoke **one** session (a
single stolen device) without logging the user out everywhere. Otherwise
`token_version` is simpler and cheaper.

## When to revoke

| Event | Action |
|---|---|
| Logout (this device) | Blacklist the presented refresh token |
| Logout everywhere | Bump `token_version` |
| Password changed | Bump `token_version` — **not optional**. The point of a password change is often that the old one is compromised |
| Password reset completed | Bump `token_version` |
| Role or `is_staff` changed | Bump `token_version` |
| Account deactivated | Bump `token_version`; `/auth/me/` also returns 403 on `is_active=False` |
| Email changed | Bump `token_version` |
| Suspected compromise | Bump `token_version` |

Wire it once so it cannot be forgotten:

```python
@receiver(pre_save, sender=CustomUser)
def revoke_on_privilege_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    old = sender.objects.filter(pk=instance.pk).only(
        "password", "is_staff", "is_superuser", "role", "is_active"
    ).first()
    if not old:
        return
    if (
        old.password != instance.password
        or old.is_staff != instance.is_staff
        or old.is_superuser != instance.is_superuser
        or old.role != instance.role
        or old.is_active != instance.is_active
    ):
        instance.token_version = old.token_version + 1
```

This is one of the few places a signal is the right tool: it is genuinely
cross-cutting, and the failure mode of forgetting it at one call site is severe.

## Logout

```python
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data["refresh"]).blacklist()
        except (KeyError, TokenError):
            # Already expired, already blacklisted, or absent. The client's
            # intent is unambiguous — do not fail a logout.
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.revoke_all_sessions()
        return Response(status=status.HTTP_205_RESET_CONTENT)
```

A logout must never return an error. If the token is already gone, the desired
state has been reached.

In cookie mode, also clear the refresh cookie with the **same** path, domain and
samesite attributes it was set with — a mismatch leaves the cookie in place and
the "logout" is cosmetic.

## Blacklist maintenance

`token_blacklist_outstandingtoken` grows by one row per issued refresh token and
is never pruned automatically. On a busy site it reaches millions of rows and
the join on every refresh becomes the slowest query in the application.

```bash
python manage.py flushexpiredtokens     # daily cron
```

## Verification

```bash
# Password change invalidates existing tokens.
OLD=$(curl -s -X POST localhost:8000/api/token/ -H 'Content-Type: application/json' \
  -d '{"email":"u@example.com","password":"old-password"}' | python -c "import sys,json;print(json.load(sys.stdin)['access'])")
# ... change the password ...
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/auth/me/ -H "Authorization: Bearer $OLD"
# expect: 401

# Demotion takes effect immediately (with token_version).
# 1. obtain an admin token
# 2. python manage.py shell -c "u=User.objects.get(email='a@x.com'); u.is_staff=False; u.save()"
# 3. curl /auth/me/ with the SAME token
# expect: 401 with token_version, or is_staff:false within 15 min without it

# Logout is idempotent.
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/auth/logout/ \
  -H "Authorization: Bearer $T" -d '{"refresh":"already-used"}' -H 'Content-Type: application/json'
# expect: 205, not 400
```

## Common mistakes

- Assuming `BLACKLIST_AFTER_ROTATION` revokes access tokens. It does not.
- A 60-minute access lifetime. That is the revocation delay.
- Putting `is_staff` in the token and reading it client-side. Stale by
  construction, and it teaches the frontend to trust a decoded claim. *(N4)*
- Not bumping `token_version` on password change.
- Returning 400 from logout when the token is already invalid.
- Never running `flushexpiredtokens`.
- Clearing a refresh cookie with different attributes than it was set with.
