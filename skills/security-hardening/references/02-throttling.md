# Throttling

This file owns the rate limits on every endpoint that an attacker can call in a loop.

## The finding

**N2**: this project had zero DRF throttling anywhere, while authentication rested on a 6-digit numeric OTP. The `REST_FRAMEWORK` dict in `settings.py` declared `DEFAULT_PERMISSION_CLASSES`, `DEFAULT_AUTHENTICATION_CLASSES` and `DEFAULT_FILTER_BACKENDS`, and nothing else. No `DEFAULT_THROTTLE_CLASSES`, no `DEFAULT_THROTTLE_RATES`, and no `CACHES` block for throttle counters to live in.

Permissions decide *who* may call an endpoint. Throttling decides *how often*. On `/auth/verify-otp/` the permission answer must be `AllowAny` — the caller has no credentials yet, that is the entire point of the endpoint — so throttling is the only control left. This is why an unthrottled OTP endpoint is not a hardening gap; it is an open door with a sign on it.

## The arithmetic that makes this urgent

The real implementation:

```python
# api/serializers.py
user.otp = str(random.randint(100000, 999999))

# api/models.py
otp = models.CharField(max_length=6, blank=True)

# api/views.py
if user.otp == otp:
    user.is_active = True
```

A 6-digit code is 10^6 = **1,000,000** possible values. The keyspace is small, and every wrong guess in the original code was free: no counter, no expiry, no lockout, no delay.

| Attempts per second | Time to exhaust 1,000,000 | Expected time to hit (50%) |
| --- | --- | --- |
| 10 | 27.8 hours | 13.9 hours |
| 100 | 2.8 hours | 1.4 hours |
| 500 | 33 minutes | 17 minutes |
| 2,000 (20 parallel clients) | 8.3 minutes | 4.2 minutes |

500 requests/second against a single endpoint is not an advanced capability; it is one machine with `xargs -P`. And the attacker does not need to be first — they need to be running while any user registers.

Two further multipliers made the original worse than the table suggests. The code never expired, so the window was not "the ninety seconds while the victim reads their email", it was *forever* — a stale `otp` value sat on the row until someone used it. And `user.otp == otp` compares in Python with an early-exit string comparison, which is not constant-time.

With `otp_verify` at 10/hour, exhausting the keyspace takes roughly 11,400 years. The control is not subtle; it is just absent or present.

## Rates for this project

These are the values in `assets/settings_security.py`. They are deliberately tight — every one of them is above the p99 of legitimate use.

| Scope | Rate | Applies to | Why this number |
| --- | --- | --- | --- |
| `anon` | 60/hour | Every unauthenticated request (global default) | A shopper browsing the catalog is served from the page, not one request per second. 60/hour is generous for a human and hostile to a scraper. |
| `user` | 1000/hour | Every authenticated request (global default) | An admin working through the panel bursts hard — bulk product edits, image uploads. 1000/hour clears real work and still caps a stolen token. |
| `otp_issue` | 5/hour | `/auth/registration/`, resend-OTP | Five emails per hour per address. Also protects your Gmail sending reputation — an attacker looping registration turns your SMTP into a spam cannon aimed at a third party. |
| `otp_verify` | 10/hour | `/auth/verify-otp/` | The control from the table above. A real user needs 1-2 attempts; 10 covers fat fingers. |
| `login` | 10/hour | `/auth/login/` | Credential stuffing needs volume. 10/hour per IP and per email makes a password spray uneconomic. |
| `password_reset` | 3/hour | Password reset request | Reset mails are a harassment vector as much as an attack one — three per hour per address. |
| `order_create` | 30/hour | `/place_order/`, `POST /orders/` | Nobody places 30 orders an hour. This is the abuse bound for COD order-flooding, which costs real money in courier bookings. |
| `contact` | 5/hour | Contact / callback forms | Standard spam bound. |

Note `otp_issue` and `otp_verify` are separate scopes. Issuing and verifying are different attacks with different economics — issuing costs you money and reputation, verifying costs you an account — so they get separate budgets. Sharing one scope means an attacker who burns the issue budget also locks the victim out of verifying.

## How DRF throttling actually works

Wire it up by merging the asset's fragment in `settings.py`:

```python
# settings.py, at the bottom
from .settings_security import *          # noqa: F401,F403

REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)
```

That produces:

```python
'DEFAULT_THROTTLE_CLASSES': [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle',
],
'DEFAULT_THROTTLE_RATES': {
    'anon': '60/hour',
    'user': '1000/hour',
    'otp_issue': '5/hour',
    'otp_verify': '10/hour',
    'login': '10/hour',
    'password_reset': '3/hour',
    'order_create': '30/hour',
    'contact': '5/hour',
},
```

Mechanics worth knowing, because each one is a place people get a false sense of protection:

- **Rate string parsing.** `'60/hour'` is split on `/` and only the **first character** of the period is read. `second`, `minute`, `hour`, `day` map to `s`/`m`/`h`/`d`. So `'60/h'`, `'60/hour'` and `'60/horse'` are all identical. There is no `/week` — `'1/week'` silently becomes 1 per **second**, wide open. Use `day` as the longest period.
- **The window is a sliding log, not a fixed bucket.** `SimpleRateThrottle` stores a list of request timestamps in the cache and drops entries older than the period. There is no reset-on-the-hour edge that lets an attacker double up across a boundary.
- **`AnonRateThrottle` keys on IP; `UserRateThrottle` keys on user pk.** The IP comes from `REMOTE_ADDR` unless `NUM_PROXIES` is configured — behind nginx or cPanel that is the proxy's address, meaning **every anonymous user shares one bucket**. Get this wrong and 60/hour applies to your entire anonymous traffic. See the proxy section below.
- **The two default classes both apply.** An authenticated request is checked by `UserRateThrottle`; `AnonRateThrottle` returns `None` (skip) for it. They do not stack against each other.
- **A throttle returning `None` from `get_cache_key` means "do not throttle this request".** That is the correct way to opt a request out, and also the most common accidental bypass.

## api/throttles.py

Create this file. It is the whole custom surface.

```python
"""Scoped throttles. See references/02-throttling.md (audit N2)."""

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class OTPIssueThrottle(ScopedRateThrottle):
    scope = 'otp_issue'


class OTPVerifyThrottle(ScopedRateThrottle):
    scope = 'otp_verify'


class LoginRateThrottle(ScopedRateThrottle):
    scope = 'login'


class PasswordResetRateThrottle(ScopedRateThrottle):
    scope = 'password_reset'


class OrderCreateRateThrottle(ScopedRateThrottle):
    scope = 'order_create'


class EmailScopedThrottle(SimpleRateThrottle):
    """Throttle keyed on the submitted email address rather than the client IP.

    IP-keyed throttling alone fails against a rotating source: residential proxy
    pools and mobile carrier NAT both hand an attacker a fresh address per
    request, so a per-IP budget of 10 becomes effectively unlimited against one
    victim's account.

    Email-keyed throttling alone fails the other way: one attacker on one IP can
    spend 10 attempts each against 100,000 different addresses and never trip a
    per-email limit. That is credential stuffing and account enumeration.

    Neither is sufficient. Stack both on the OTP and login endpoints — the
    per-IP class bounds breadth, the per-email class bounds depth.
    """

    scope = 'otp_verify'

    def get_cache_key(self, request, view):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            # No email in the body means this request cannot brute-force an
            # account. Returning None skips THIS throttle only; the IP-keyed
            # class in the same list still applies.
            return None
        return self.cache_format % {'scope': self.scope, 'ident': email}


class OTPVerifyEmailThrottle(EmailScopedThrottle):
    scope = 'otp_verify'


class LoginEmailThrottle(EmailScopedThrottle):
    scope = 'login'
```

Normalising the email with `.strip().lower()` matters. Without it, `Victim@Example.com`, `victim@example.com ` and `victim@example.com` are three separate cache keys and three separate budgets — the attacker gets a free multiplier from case alone.

## Attaching them

### The critical endpoint

`VerifyOTPView` gets both throttle classes. This is the N2 fix.

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .throttles import OTPVerifyThrottle, OTPVerifyEmailThrottle


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPVerifyThrottle, OTPVerifyEmailThrottle]
    throttle_scope = 'otp_verify'          # read by the ScopedRateThrottle
```

`ScopedRateThrottle` reads `view.throttle_scope`, not the class's own `scope`, so a view using it **must** set `throttle_scope` or the throttle silently skips. `SimpleRateThrottle` subclasses like `EmailScopedThrottle` use their class attribute instead. Setting both, as above, is correct and covers either mechanism.

### Login and registration

```python
from dj_rest_auth.views import LoginView
from .throttles import LoginRateThrottle, LoginEmailThrottle, OTPIssueThrottle


class CustomLoginView(LoginView):
    throttle_classes = [LoginRateThrottle, LoginEmailThrottle]
    throttle_scope = 'login'


class CustomRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CustomRegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [OTPIssueThrottle]
    throttle_scope = 'otp_issue'
```

`/auth/check-username/` needs `AnonRateThrottle` at minimum — it is an enumeration oracle by design, and an unthrottled one lets an attacker harvest the full username list.

### Per-action on a ViewSet

`OrderViewSet` should only throttle creation; reading your own order history is cheap and legitimate.

```python
from rest_framework import viewsets
from rest_framework.throttling import UserRateThrottle

from api.permissions import IsStaffOrOwner
from .throttles import OrderCreateRateThrottle


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrOwner]
    throttle_scope = 'order_create'

    def get_throttles(self):
        if self.action == 'create':
            return [OrderCreateRateThrottle()]
        return [UserRateThrottle()]
```

`get_throttles` returns **instances**, `throttle_classes` holds **classes**. Same trap as `get_permissions`.

### The function-based view

`place_order` is `@api_view(['POST'])` with `@permission_classes([AllowAny])` — guest checkout. It is the highest-value unauthenticated write in the system, so it must be throttled:

```python
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny

from .throttles import OrderCreateRateThrottle


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OrderCreateRateThrottle])
def place_order(request):
    ...
```

`ScopedRateThrottle` on a function view has no `throttle_scope` attribute to read, because there is no view class — the `@api_view` wrapper does expose `throttle_scope` if you set it on the function, but the reliable pattern for FBVs is a `SimpleRateThrottle` subclass with a hardcoded `scope`. If you keep `ScopedRateThrottle`, set `place_order.throttle_scope = 'order_create'` after the definition and assert it in a test.

## The OTP endpoint needs more than throttling

Throttling bounds the rate. It does not fix the other three defects in the original flow. Ship all four together.

WRONG — the real `VerifyOTPView` as it stands:

```python
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")
        user = User.objects.get(email=email)
        if user.otp == otp:              # never expires, no attempt count, not constant-time
            user.is_active = True
            user.otp = ""
            user.save()
```

Four defects: unlimited attempts, no expiry, non-constant-time compare, and a 404-vs-400 split that confirms whether an email is registered.

RIGHT:

```python
import hmac
import secrets

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .throttles import OTPVerifyThrottle, OTPVerifyEmailThrottle

User = get_user_model()

OTP_TTL = timezone.timedelta(minutes=10)
MAX_OTP_ATTEMPTS = 5


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPVerifyThrottle, OTPVerifyEmailThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        submitted = (request.data.get('otp') or '').strip()

        if not email or not submitted:
            return Response(
                {'error': 'Email and OTP are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # One response shape for every failure below. Do not tell an attacker
        # whether the address exists, whether the code expired, or how many
        # attempts remain — each of those is a free bit of information.
        generic_failure = Response(
            {'error': 'That code is not valid. Request a new one.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

        user = User.objects.filter(email=email).first()
        if user is None or user.is_active or not user.otp:
            return generic_failure

        if user.otp_sent_at is None or timezone.now() - user.otp_sent_at > OTP_TTL:
            user.otp = ''
            user.save(update_fields=['otp'])
            return generic_failure

        if user.otp_attempts >= MAX_OTP_ATTEMPTS:
            user.otp = ''
            user.save(update_fields=['otp'])
            return generic_failure

        # Constant-time compare. `==` on str short-circuits at the first
        # differing byte; the timing difference is small but it is real, and
        # there is no reason to accept it when the fix is one call.
        if not hmac.compare_digest(user.otp, submitted):
            user.otp_attempts += 1
            user.save(update_fields=['otp_attempts'])
            return generic_failure

        user.is_active = True
        user.otp = ''
        user.otp_attempts = 0
        user.save(update_fields=['is_active', 'otp', 'otp_attempts'])
        return Response({'message': 'Account verified.'}, status=status.HTTP_200_OK)
```

The supporting fields on `CustomUser`:

```python
class CustomUser(AbstractUser):
    otp = models.CharField(max_length=6, blank=True)
    otp_sent_at = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.PositiveSmallIntegerField(default=0)
```

And generate the code with `secrets`, not `random`:

```python
import secrets

# WRONG: random is a Mersenne Twister seeded from system time. Observing a
# handful of outputs is enough to reconstruct its internal state and predict
# every subsequent code. An attacker registers three accounts of their own,
# reads their three OTPs from their own inbox, and then predicts the victim's.
user.otp = str(random.randint(100000, 999999))

# RIGHT: cryptographically secure, uniform over 000000-999999.
user.otp = f'{secrets.randbelow(1_000_000):06d}'
user.otp_sent_at = timezone.now()
user.otp_attempts = 0
```

The `:06d` also fixes a real bug in the original: `random.randint(100000, 999999)` never produces a code starting with zero, which throws away 10% of the keyspace for free.

## The cache backend is not optional

Throttle counters live in the Django cache. If the cache is wrong, the throttle is decorative.

WRONG — the current state of this project. There is no `CACHES` block in `settings.py` at all, so Django uses `LocMemCache`:

```python
# settings.py — no CACHES key anywhere
```

`LocMemCache` is a per-process Python dict. Consequences:

- **Per-worker counters.** Running gunicorn with 4 workers gives an attacker 4x the configured rate, because each worker keeps its own dict and requests round-robin between them. `otp_verify` at 10/hour becomes 40/hour. On cPanel with Passenger spawning processes on demand, the multiplier is not even a fixed number.
- **Counters reset on restart.** Every deploy, every Passenger idle-timeout respawn, wipes every throttle. An attacker who can trigger a restart clears their own rate limit.
- **No cross-host coordination.** Two app servers behind a load balancer never see each other's counts.

RIGHT — Redis:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ['REDIS_URL'],       # redis://127.0.0.1:6379/1
        'KEY_PREFIX': 'daf',
    }
}
```

RIGHT — database cache, when the cPanel host has no Redis. Slower, but shared and durable, which is what matters here:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'django_cache_table',
    }
}
```

```bash
python manage.py createcachetable
```

The database cache adds a write per throttled request. At this project's traffic that is irrelevant; correctness beats the microseconds.

Verify the cache is actually shared before trusting any of it:

```bash
python manage.py shell -c "
from django.core.cache import cache
cache.set('probe', 'ok', 30)
print(cache.get('probe'), cache.__class__.__name__)
"
```

Run it twice in separate processes. If the second run prints `None`, you are on LocMemCache and your throttles are per-process.

## Getting the client IP right behind a proxy

This project runs behind nginx/cPanel. `REMOTE_ADDR` is then the proxy, so `AnonRateThrottle` puts every anonymous visitor in one bucket — you will rate-limit your own storefront at 60 requests/hour total while an attacker is unaffected relative to everyone else.

```python
# settings.py
NUM_PROXIES = 1     # number of proxies between the client and Django
```

With `NUM_PROXIES` set, DRF reads `X-Forwarded-For` and takes the address `NUM_PROXIES` from the right — which is the last address the proxy chain actually observed, and therefore not client-spoofable. Setting it too high lets a client inject a fake address by sending its own `X-Forwarded-For` header; setting it too low re-collapses everyone into one bucket. Count your proxies and confirm:

```bash
curl -s -H 'X-Forwarded-For: 1.2.3.4' https://api.delhialuminium.com/auth/check-username/ -o /dev/null -w '%{http_code}\n'
# then check what address appears in the throttle cache key / access log
```

## Handling 429 in the React frontend

DRF returns `429 Too Many Requests` with a `Retry-After` header in seconds.

An axios interceptor in `src/js/api.js` that surfaces it rather than swallowing it:

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = Number(error.response.headers['retry-after']) || 60;
      error.retryAfter = retryAfter;
      error.friendlyMessage =
        retryAfter > 90
          ? `Too many attempts. Please try again in about ${Math.ceil(retryAfter / 60)} minutes.`
          : `Too many attempts. Please try again in ${retryAfter} seconds.`;
    }
    return Promise.reject(error);
  },
);

export default api;
```

**Do not auto-retry a 429 in a loop.** Three reasons: it converts one user's mistake into a sustained attack on your own API, it guarantees the user never escapes the limit because each retry extends the sliding window, and if the 429 came from the OTP throttle the retry burns the victim's remaining budget. Surface it and let the human decide.

A resend-OTP button with a countdown, React 18:

```jsx
import { useCallback, useEffect, useState } from 'react';
import api from '../js/api';

function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  return [remaining, setRemaining];
}

export default function ResendOtpButton({ email }) {
  const [cooldown, setCooldown] = useCountdown();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const resend = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      await api.post('/auth/resend-otp/', { email });
      setMessage('A new code is on its way to your inbox.');
      setCooldown(60);                       // client-side courtesy gate
    } catch (error) {
      if (error.response?.status === 429) {
        setMessage(error.friendlyMessage);
        setCooldown(error.retryAfter);       // server's number wins
      } else {
        setMessage('Could not send the code. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [email, setCooldown]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={resend}
        disabled={busy || cooldown > 0}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
      {message && <p className="text-sm text-slate-600" role="status">{message}</p>}
    </div>
  );
}
```

The client-side cooldown is UX, not a control — it stops an impatient customer double-clicking. The server throttle is the control. Never treat the disabled button as the limit.

## What throttling does not protect against

Be honest about the boundary so you do not over-trust it:

- **Distributed attacks.** A botnet with 10,000 addresses gets 10,000 x the per-IP budget. The per-email throttle is what holds here, which is why both classes are stacked.
- **Credential stuffing with valid credentials.** If the password is correct on the first try, no rate limit fires. Detection is the control: a successful login from a new device/geography is an audit event (**N9**).
- **Slow attacks.** 10 attempts/hour sustained for a month is 7,200 attempts. Against 10^6 that is fine; against a 4-digit PIN it would not be. Pair rate limits with expiry and attempt counters so the code rotates out from under a slow attacker.
- **Application-layer DoS.** A single expensive request — an unpaginated `/products/` with `pagination_class = None`, which this project has — can hurt more than a thousand cheap ones. Throttling counts requests, not cost.

Log every 429 to the `security.audit` logger so a sustained attack is visible rather than merely blocked. See `07-threat-model.md`.

## Testing

Manual, against a running server. The sixth attempt must be rejected:

```bash
for i in $(seq 1 6); do
  printf '%s: ' "$i"
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST https://api.delhialuminium.com/auth/verify-otp/ \
    -H 'Content-Type: application/json' \
    -d '{"email":"probe@example.com","otp":"000000"}'
done
# expect: 400 400 400 400 400 400 ... then 429 once the otp_verify budget is spent
```

Automated. Override the rates so the test does not depend on production numbers, and clear the cache in `setUp` or throttle state leaks between test methods and produces failures that depend on test ordering:

```python
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


THROTTLED = {
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/hour',
        'user': '1000/hour',
        'otp_verify': '3/hour',
        'otp_issue': '5/hour',
        'login': '10/hour',
        'password_reset': '3/hour',
        'order_create': '30/hour',
        'contact': '5/hour',
    },
}


@override_settings(
    REST_FRAMEWORK=THROTTLED,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class OTPThrottleTests(APITestCase):
    """Regression test for N2."""

    def setUp(self):
        cache.clear()          # mandatory: throttle counters outlive a test method

    def tearDown(self):
        cache.clear()

    def test_otp_verify_is_throttled(self):
        url = reverse('verify_otp')
        payload = {'email': 'probe@example.com', 'otp': '000000'}
        for _ in range(3):
            response = self.client.post(url, payload)
            self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Retry-After', response.headers)

    def test_throttle_is_keyed_per_email_not_only_per_ip(self):
        """Rotating the source address must not reset a victim's budget."""
        url = reverse('verify_otp')
        payload = {'email': 'victim@example.com', 'otp': '000000'}
        for i in range(3):
            self.client.post(url, payload, REMOTE_ADDR=f'10.0.0.{i}')

        response = self.client.post(url, payload, REMOTE_ADDR='10.0.0.99')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
```

The second test is the one worth keeping. It encodes the actual design decision — that per-IP throttling alone is not the control — so a future refactor that drops `OTPVerifyEmailThrottle` fails loudly instead of quietly restoring N2.

## Checklist

- [ ] `REST_FRAMEWORK.update(REST_FRAMEWORK_SECURITY)` is present in `settings.py` after `REST_FRAMEWORK` is defined.
- [ ] A real shared cache is configured; the two-process probe above returns a value.
- [ ] `NUM_PROXIES` matches the actual proxy count.
- [ ] `/auth/verify-otp/` carries both the IP-keyed and email-keyed throttles.
- [ ] `/auth/login/`, `/auth/registration/`, `/auth/check-username/`, `/place_order/` all declare throttles.
- [ ] OTP codes are generated with `secrets`, expire in 10 minutes, and are compared with `hmac.compare_digest`.
- [ ] No rate string uses a period other than `second`/`minute`/`hour`/`day`.
- [ ] The frontend surfaces 429 with `Retry-After` and never auto-retries.
