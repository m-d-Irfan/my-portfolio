"""Base HTTP client for third-party APIs.

Copy to `common/integrations/client.py`. Subclass per provider — see
`references/02-integrations.md` for the Steadfast and bKash subclasses.

What this enforces, and why each one is here:

  - A timeout on every call. Without one, `requests` inherits the socket
    default, which is effectively forever: one unresponsive provider holds a
    gunicorn worker until the process is killed.
  - Fail-loud configuration. C1: the Steadfast credentials were read as
    os.environ.get('<the literal key>'), so both were None and the truthiness
    check in OrderViewSet.track silently skipped every dispatch. Nothing logged,
    nothing alerted, courier dead for months. This client refuses to construct
    without its credentials.
  - Retry with backoff on transient failures only. A 400 fails identically
    forever; retrying it is a busy loop.
  - A circuit breaker, so a provider outage fails fast instead of adding its
    timeout to every request.
  - Request/response logging with credentials redacted.
"""

import logging
import random
import time

import requests
from django.core.exceptions import ImproperlyConfigured

log = logging.getLogger("integrations")

# Retried. Transient by nature.
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})

# Never logged, in a header or a body.
SENSITIVE_KEYS = frozenset({
    "authorization", "api-key", "secret-key", "x-api-key", "password",
    "app_secret", "appsecret", "token", "id_token", "cookie", "set-cookie",
})


class IntegrationError(Exception):
    """Base. Carries the status so callers can branch without parsing strings."""

    def __init__(self, message, status=None, body=None, retryable=False):
        super().__init__(message)
        self.status = status
        self.body = body
        self.retryable = retryable


class IntegrationTimeout(IntegrationError):
    def __init__(self, message):
        super().__init__(message, retryable=True)


class CircuitOpen(IntegrationError):
    """The provider is failing; calls are being refused without attempting."""


def redact(data):
    """Recursively mask credential-shaped values for logging.

    A backstop, not a licence. The control is not logging the value at all —
    this catches the case someone missed.
    """
    if isinstance(data, dict):
        return {
            k: ("***REDACTED***" if k.lower() in SENSITIVE_KEYS else redact(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact(item) for item in data]
    return data


class CircuitBreaker:
    """Open after N consecutive failures; half-open after a cooldown.

    Without this, a provider outage means every request pays the full timeout.
    Ten concurrent checkouts against a dead gateway with a 15s timeout occupies
    every worker for fifteen seconds — the outage becomes yours.

    In-process state, so each gunicorn worker has its own breaker. That is
    acceptable here (each worker independently learns the provider is down) but
    it is NOT acceptable for throttling — see security-hardening/02, N2.
    """

    def __init__(self, threshold=5, cooldown_seconds=60):
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self.failures = 0
        self.opened_at = None

    def before_call(self, name):
        if self.opened_at is None:
            return
        if time.monotonic() - self.opened_at < self.cooldown:
            raise CircuitOpen(
                f"{name} circuit is open after {self.failures} consecutive "
                f"failures; retrying in "
                f"{self.cooldown - (time.monotonic() - self.opened_at):.0f}s"
            )
        # Cooldown elapsed: allow one probe through (half-open).
        self.opened_at = None

    def record_success(self):
        self.failures = 0
        self.opened_at = None

    def record_failure(self, name):
        self.failures += 1
        if self.failures >= self.threshold and self.opened_at is None:
            self.opened_at = time.monotonic()
            log.error(
                "%s circuit opened after %d consecutive failures",
                name, self.failures,
            )


class IntegrationClient:
    """Subclass per provider.

        class SteadfastClient(IntegrationClient):
            name = "steadfast"
            timeout = settings.STEADFAST_TIMEOUT_SECONDS

            def __init__(self):
                super().__init__(
                    base_url=settings.STEADFAST_BASE_URL,
                    credentials={
                        "STEADFAST_API_KEY": settings.STEADFAST_API_KEY,
                        "STEADFAST_SECRET_KEY": settings.STEADFAST_SECRET_KEY,
                    },
                )

            def auth_headers(self):
                return {"Api-Key": ..., "Secret-Key": ...}
    """

    name = "integration"
    timeout = 10
    max_retries = 3
    backoff_base = 0.5

    def __init__(self, base_url, credentials=None):
        if not base_url:
            raise ImproperlyConfigured(f"{self.name}: base_url is not configured.")

        # C1's guard. A credential that is None must stop the client from
        # existing, not quietly disable the feature. The message names the KEY,
        # never the value.
        missing = [k for k, v in (credentials or {}).items() if not v]
        if missing:
            raise ImproperlyConfigured(
                f"{self.name}: missing credentials {', '.join(sorted(missing))}. "
                f"Set them in .env — see .env.example. This is finding C1: an "
                f"unset courier key evaluated to None and dispatch silently "
                f"stopped working."
            )

        self.base_url = base_url.rstrip("/")
        self._breaker = CircuitBreaker()
        self._session = requests.Session()

    # --- Override in the subclass -------------------------------------------

    def auth_headers(self):
        return {}

    def is_permanent_error(self, response):
        """Default: any 4xx except the retryable ones is permanent."""
        return 400 <= response.status_code < 500 and \
            response.status_code not in RETRYABLE_STATUS

    # --- The call ------------------------------------------------------------

    def request(self, method, path, *, json=None, params=None, idempotency_key=None):
        """One call, with retries, backoff, breaker and redacted logging.

        Raises IntegrationError on failure — never returns None on error. A
        None return is how a failure becomes invisible, which is the C1 shape.
        """
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {"Accept": "application/json", **self.auth_headers()}

        # Idempotency at the provider, where supported. Without it, a retry
        # after a timeout can create a second charge or a second consignment —
        # the response was lost, not the action.
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        self._breaker.before_call(self.name)

        last_exc = None
        for attempt in range(1, self.max_retries + 1):
            started = time.monotonic()
            try:
                response = self._session.request(
                    method, url, json=json, params=params,
                    headers=headers, timeout=self.timeout,
                )
            except requests.Timeout as exc:
                last_exc = IntegrationTimeout(
                    f"{self.name} {method} {path} timed out after {self.timeout}s"
                )
            except requests.RequestException as exc:
                last_exc = IntegrationError(
                    f"{self.name} {method} {path} failed: {exc.__class__.__name__}",
                    retryable=True,
                )
            else:
                elapsed = time.monotonic() - started
                log.info(
                    "%s %s %s -> %s in %.2fs (attempt %d)",
                    self.name, method, path, response.status_code, elapsed, attempt,
                    extra={"integration": self.name,
                           "request": redact(json or params or {})},
                )

                if response.ok:
                    self._breaker.record_success()
                    return self._parse(response)

                permanent = self.is_permanent_error(response)
                last_exc = IntegrationError(
                    f"{self.name} {method} {path} returned {response.status_code}",
                    status=response.status_code,
                    body=response.text[:1000],
                    retryable=not permanent,
                )
                if permanent:
                    # Do not count a 400 against the breaker — it is our bug,
                    # not the provider being down, and opening the circuit for
                    # it would refuse healthy calls.
                    log.error(
                        "%s permanent error %s: %s",
                        self.name, response.status_code, response.text[:500],
                    )
                    raise last_exc

            self._breaker.record_failure(self.name)

            if attempt < self.max_retries:
                # Exponential backoff with jitter. Without jitter, every client
                # that failed together retries together and re-DDoSes a
                # recovering provider.
                delay = self.backoff_base * (2 ** (attempt - 1))
                delay += random.uniform(0, delay * 0.3)
                log.warning(
                    "%s attempt %d/%d failed, retrying in %.1fs",
                    self.name, attempt, self.max_retries, delay,
                )
                time.sleep(delay)

        raise last_exc

    def _parse(self, response):
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)
