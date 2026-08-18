# Social OAuth

Google sign-in via django-allauth + dj-rest-auth, without opening an account
takeover path.

## The account takeover risk — read this first

The single dangerous setting in social auth is **automatic account linking on
unverified email**.

The attack:

1. Attacker knows the victim uses `victim@example.com` on your store.
2. Attacker creates an identity at some IdP asserting that address — either a
   provider that does not verify addresses, or one where they control the domain.
3. They "Sign in with X". Your app matches on email, links the social identity to
   the victim's existing account, and logs them in.
4. They now own an account they never knew the password to.

The defence is to link **only** on a provider-verified email, and to require the
local account to be verified too:

```python
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = False
SOCIALACCOUNT_EMAIL_VERIFICATION = "mandatory"
SOCIALACCOUNT_EMAIL_REQUIRED = True
```

Google does verify email and reports it in the `email_verified` claim — but the
claim must actually be checked, not assumed. See the adapter below.

## Settings

```python
INSTALLED_APPS += [
    "allauth", "allauth.account", "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "dj_rest_auth", "dj_rest_auth.registration",
]

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": ["profile", "email"],       # nothing more
        "AUTH_PARAMS": {"access_type": "online"},
        "OAUTH_PKCE_ENABLED": True,
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID", required=True),
            "secret": env("GOOGLE_CLIENT_SECRET", required=True),
            "key": "",
        },
    }
}

SOCIALACCOUNT_ADAPTER = "api.adapters.SecureSocialAccountAdapter"
SOCIALACCOUNT_AUTO_SIGNUP = False       # do not silently create accounts
SOCIALACCOUNT_STORE_TOKENS = False      # no reason to keep Google's tokens
```

Request the minimum scope. `profile` and `email` are enough to create an
account; anything more is data you now have to protect and justify.

`SOCIALACCOUNT_STORE_TOKENS = False` — storing a provider access token means a
database compromise also compromises the user's Google account surface.
Only store them if you actually call Google APIs on the user's behalf.

## The adapter — where the rules are enforced

```python
# api/adapters.py
from allauth.account.models import EmailAddress
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.core.exceptions import PermissionDenied


class SecureSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        # Already linked — nothing to decide.
        if sociallogin.is_existing:
            return

        email = (sociallogin.account.extra_data or {}).get("email")
        verified = (sociallogin.account.extra_data or {}).get("email_verified")

        if not email:
            raise PermissionDenied("This provider did not supply an email address.")

        # THE control. Never link on an unverified provider email.
        if not verified:
            raise PermissionDenied(
                "Your provider has not verified this email address."
            )

        existing = EmailAddress.objects.filter(
            email__iexact=email, verified=True
        ).first()
        if existing:
            # Link only when BOTH sides are verified.
            sociallogin.connect(request, existing.user)

    def is_auto_signup_allowed(self, request, sociallogin):
        # Explicit signup only, so the user consciously creates an account.
        return False

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        # A social login NEVER confers a role. Whatever the provider says about
        # this person, they arrive as a customer.
        user.role = "customer"
        user.is_staff = False
        user.is_superuser = False
        return user
```

That last method is the rule that matters most: **a social login must never
confer staff or any elevated role.** Roles are assigned by a superuser through
the audited path in
[07-roles-and-scopes.md](./07-roles-and-scopes.md), never by an identity
provider.

## Never trust a client-supplied `id_token`

A common SPA shortcut is for the frontend to do the Google flow itself and POST
the resulting `id_token` to the backend, which decodes it and logs the user in.

**Decoding is not verifying.** A JWT decoded without signature verification is
just attacker-supplied JSON. Anyone can craft `{"email": "admin@yourstore.com",
"email_verified": true}` and send it.

If the frontend-initiated flow is used, the backend must verify the token
against Google's public keys and check the audience:

```python
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

def verify_google_id_token(raw_token):
    info = google_id_token.verify_oauth2_token(
        raw_token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,      # audience check — not optional
    )
    if info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise PermissionDenied("Unexpected token issuer.")
    if not info.get("email_verified"):
        raise PermissionDenied("Unverified provider email.")
    return info
```

Without the audience check, a token minted for *any other application* is
accepted — including one the attacker registered themselves.

Prefer the server-side authorization-code flow. It keeps the exchange between
your server and Google, never routes a credential through the browser, and
removes this whole class of mistake.

## Redirect URI allowlist

Register exact URIs in the Google Cloud console. No wildcards, no paths you do
not control.

An open redirect in the callback turns into token theft: the attacker starts the
flow, your app redirects to their URL with the code attached, and they exchange
it. Validate any `next`/`state` return path against an allowlist before
redirecting.

`state` must be present and checked — it is the CSRF defence for the OAuth flow.
allauth handles this; do not bypass it with a custom callback.

## Account linking UI

A user who signs up with a password and later uses Google should be linking, not
creating a second account. Make it explicit:

- Signed in already → "Connect your Google account" links to the current user.
- Not signed in, email matches a verified local account → require them to sign in
  with their password *first*, then link. Do not link on the strength of the
  provider assertion alone.

And always allow unlinking — but never the last credential. A user who unlinks
their only sign-in method is locked out permanently:

```python
    def can_disconnect(self, account):
        user = account.user
        others = user.socialaccount_set.exclude(pk=account.pk).count()
        return bool(user.has_usable_password() or others)
```

## Verification

```bash
# The provider app is configured from env, not committed.
grep -rn "client_id\|secret" --include=settings.py . | grep -v "env("
# expect: no output

# A social account never arrives privileged.
python manage.py shell -c "
from allauth.socialaccount.models import SocialAccount
bad = [a.user.email for a in SocialAccount.objects.select_related('user')
       if a.user.is_staff or a.user.is_superuser or a.user.role != 'customer']
print('privileged social accounts:', bad)"
# expect: [] — unless a superuser deliberately promoted them afterwards
```

Manual, and worth doing once per provider change:

1. Sign in with Google using an address that has **no** local account → a new
   customer account is created, `is_staff` false.
2. Sign in with Google using an address matching a **verified** local account →
   links, does not duplicate.
3. Sign in with Google using an address matching an **unverified** local account
   → does **not** link.
4. POST a hand-crafted `id_token` with `alg: none` to the login endpoint →
   rejected.

## Common mistakes

- Auto-linking on an unverified provider email. Account takeover.
- Decoding an `id_token` client-side or server-side without verifying the
  signature and audience.
- Committing `client_id` / `client_secret`.
- Requesting scopes beyond `profile` and `email`.
- Storing provider tokens with no use for them.
- Wildcard redirect URIs.
- Letting the provider's claims influence role or `is_staff`.
- Allowing the last credential to be unlinked.
