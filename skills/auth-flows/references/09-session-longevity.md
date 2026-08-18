# Why users get logged out, and what to actually change

The most common bug report in a Django + React JWT app is "it logs me out after
a while." It has eight distinct causes. Seven of them are frontend or config
bugs. **Raising the token lifetimes fixes none of them** — it only makes the
symptom rarer and the breach worse.

Read the symptom table, find your cause, fix that. Do not start by changing
`ACCESS_TOKEN_LIFETIME`.

## The wrong fix, stated plainly

Setting both lifetimes to 30 days is the reflex. Here is what it buys and costs:

```python
# WRONG
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),   # <- the real damage
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}
```

**A 30-day access token means you cannot log anyone out for 30 days.** This is
not a tuning preference, it is the loss of a capability:

- `/auth/logout/` blacklists the *refresh* token. The access token is
  stateless — it is verified by signature, not by a database lookup. Nothing
  consults a table. A logged-out user's access token keeps working until it
  expires.
- Firing a staff member does not revoke their admin access. Deactivating the
  account (`is_active = False`) does not either — `is_active` is read at login,
  not on every request.
- A token stolen through XSS is valid for a month, from any machine, with no
  signal to you or the user.
- A password change does not invalidate it.
- A role downgrade does not apply. `is_staff` is baked into the claims at issue
  time; the token keeps asserting the old role.

The access token's lifetime **is** your revocation window. 15 minutes means a
worst case of 15 minutes. 30 days means 30 days. That is the entire trade, and
it buys you nothing a correct refresh loop does not already give you.

The refresh lifetime is a different question and 30 days there is defensible —
see "How long should a session actually last" below.

## Symptom → cause

| What the user sees | Actual cause | Fix |
|---|---|---|
| Logged out at random, minutes to hours apart, more on mobile | **Refresh failed on the network and the client cleared the session.** A 15s timeout on a phone in a lift is treated as an invalid token | Clear the session only on `401`/`403` from the refresh endpoint. `assets/frontend/api.js` → `isCredentialRejection()` |
| Logged out when two tabs are open | **Rotation race across tabs.** `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`: tab A rotates, blacklists the token tab B holds, tab B's next refresh 401s | Cookie mode (one shared cookie jar), or the `storage` event listener in `api.js` |
| Logged out on the first page load after a while | Access token was never persisted (cookie mode, correct) but the boot sequence is missing, so the app reads `null` and redirects before the refresh completes | Add the `booting` state — [01](./01-token-strategy.md) |
| Logged out exactly N days after login, never sooner | Refresh token genuinely expired. Working as designed | Raise `REFRESH_TOKEN_LIFETIME` only. Never the access lifetime |
| Logged out after leaving a tab open overnight | Same as above; the tab was idle so nothing rotated the refresh token | Sliding window (below) |
| Six requests on mount, then logged out | **No single-flight lock.** Six 401s launch six refreshes; the first rotation kills the other five | The `isRefreshing` / `waiters` queue in `api.js` |
| Logged out after mistyping a password on a second tab | 401 on `/auth/login/` treated as an expired session, triggering a refresh and a session wipe | Exclude the auth endpoints from the refresh interceptor |
| Logged out only in production | Cookie never set: `Secure` requires HTTPS, and `SameSite=None` is required cross-origin. With `DEBUG=True` in prod, `Secure` is often `False` and the cookie is dropped | `deploy-and-env/01`, and fix `DEBUG` first |

Note how many of these produce an identical bug report. That is why the answer
is never "raise the lifetime" — it hides all eight without fixing any.

## The correct configuration

```python
from datetime import timedelta

SIMPLE_JWT = {
    # The revocation window. Keep it short — this is the whole point.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),

    # How long a user may be completely absent before re-authenticating.
    # Rotation makes this a SLIDING window for active users, so a large value
    # here does not mean a 30-day-old credential stays valid — see below.
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),

    'ROTATE_REFRESH_TOKENS': True,      # each refresh issues a new one
    'BLACKLIST_AFTER_ROTATION': True,   # and kills the old one
    'UPDATE_LAST_LOGIN': False,         # a DB write on every refresh, skip it

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,          # rotating SECRET_KEY logs everyone out
    'AUTH_HEADER_TYPES': ('Bearer',),
    'LEEWAY': 10,                       # seconds of clock-skew tolerance
}
```

`LEEWAY` matters more than it looks. Without it, a client clock 30 seconds ahead
of the server rejects a token the server just issued, and the user sees a
logout loop on login. It is a one-line fix for a bug that reads as unexplainable.

## The sliding window — how you get a long session safely

This is the part that makes a short access lifetime painless, and it is what
people are actually reaching for when they set 30 days.

With `ROTATE_REFRESH_TOKENS = True`, **every refresh issues a brand-new refresh
token with a full lifetime**. So for anyone who uses the app at least once
inside the window, the session never ends:

```
day 0   login            → refresh token valid until day 30
day 3   refresh          → NEW token, valid until day 33
day 20  refresh          → NEW token, valid until day 50
day 51  (absent 31 days) → expired. Log in again.
```

The refresh lifetime is therefore **not** "how long the session lasts". It is
"how long a user may be completely absent before being asked to log in again."
Thirty days of that is a reasonable product decision for a storefront.

That is the whole trick: a **15-minute access token** and a **30-day sliding
refresh token** gives you a session that feels permanent to an active user and
a revocation window of 15 minutes. Setting the access token to 30 days gives
you the same feel and no revocation. One of these is free.

## Revocation, which only works if the access token is short

`06-session-revocation.md` owns this. The dependency is worth stating here
because it is the reason for the whole file:

- **Logout / logout-everywhere** blacklists refresh tokens. Access tokens are
  unaffected and remain valid to expiry.
- **A `token_version` claim** compared against the user row on each request
  makes revocation immediate — but it costs a database lookup per request,
  which is precisely what stateless JWT was chosen to avoid.
- **A short access lifetime** gets you bounded revocation for free.

Pick the third by default. Add `token_version` for staff accounts, where the
blast radius justifies the query — a demoted admin should not keep the panel
for even 15 minutes (**N4**).

## Verification

Reproduce the bug before changing anything — the symptom table above is only
useful if you know which row you are in.

```bash
# 1. Which lifetimes are actually in effect.
python manage.py shell -c "
from django.conf import settings
s = settings.SIMPLE_JWT
print('access :', s['ACCESS_TOKEN_LIFETIME'])
print('refresh:', s['REFRESH_TOKEN_LIFETIME'])
print('rotate :', s.get('ROTATE_REFRESH_TOKENS'), '| blacklist:', s.get('BLACKLIST_AFTER_ROTATION'))"
# PASS: access is minutes, not days.

# 2. The refresh endpoint works at all.
curl -s -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$REFRESH\"}" | python -m json.tool
# PASS: a new `access`, and with rotation on, a new `refresh` too.
# FAIL "token_not_valid" on a token you just got → clock skew. Set LEEWAY.

# 3. Rotation actually invalidates the old token.
curl -s -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H 'Content-Type: application/json' -d "{\"refresh\":\"$REFRESH\"}"   # same one again
# PASS: 401. If it succeeds, BLACKLIST_AFTER_ROTATION is not in effect and
# rotation is cosmetic.

# 4. Blacklist table is being written and is not unbounded.
python manage.py shell -c "
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
print('blacklisted:', BlacklistedToken.objects.count())
print('outstanding:', OutstandingToken.objects.count())"
# PASS: growing. If outstanding grows forever, schedule `flushexpiredtokens`
# — see 06-session-revocation.md.
```

In the browser, the four that find the real causes:

1. **Network blip.** Log in, open devtools → Network → Offline, wait for a
   request to fail, go back online. **PASS: still logged in.** A logout here is
   the `isCredentialRejection` bug and it is the most likely cause of your
   symptom.
2. **Two tabs.** Open the app in two tabs, wait past the access lifetime, then
   act in both. **PASS: both stay logged in.** A logout is the rotation race.
3. **Parallel requests.** Load a page firing several requests at once with an
   expired access token. **PASS: one `/token/refresh/` call in the Network tab,
   not six.**
4. **Wrong password on a second tab.** **PASS: the first tab stays logged in.**

## What to change, in order

1. Fix `isCredentialRejection` — clear the session only on 401/403. This alone
   resolves most reports of random logouts.
2. Confirm the single-flight queue exists and works (browser check 3).
3. Add the cross-tab `storage` listener, or move to cookie mode.
4. Add `LEEWAY: 10`.
5. Set `REFRESH_TOKEN_LIFETIME` to 30 days if a month of absence should be
   allowed. **Leave `ACCESS_TOKEN_LIFETIME` at 15 minutes.**
6. Only now, if logouts persist, look further — and reproduce before changing.

Step 5 is the only lifetime change on this list, and it is last.

