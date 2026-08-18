# Error envelope

One error shape for every endpoint, so the frontend parses errors in one place.

## The problem

DRF returns at least four shapes depending on what failed:

```jsonc
// serializer validation
{"email": ["This field is required."], "quantity": ["Ensure this value is >= 1."]}

// permission denied / throttled / not found
{"detail": "You do not have permission to perform this action."}

// cross-field validation
{"non_field_errors": ["Passwords do not match."]}

// unhandled exception with DEBUG=True
"<!DOCTYPE html><html>…traceback…"
```

Every call site parsing all four produces inconsistent error handling, and the
fourth leaks tracebacks and SQL to the browser.

## The shape

```jsonc
{
  "error": {
    "code": "validation_error",
    "message": "Please check the highlighted fields.",
    "fields": {
      "email": "This field is required.",
      "quantity": "Ensure this value is greater than or equal to 1."
    }
  }
}
```

- `code` — stable, machine-readable. The frontend branches on this, never on
  `message`.
- `message` — one human sentence, safe to display.
- `fields` — flat `{name: string}`, drops straight into form state. Absent when
  the error is not field-level.

## The handler

```python
# common/exceptions.py
import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler

logger = logging.getLogger(__name__)

CODES = {
    status.HTTP_400_BAD_REQUEST: "validation_error",
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def _flatten(detail):
    """DRF nests errors; forms need one string per field name."""
    out = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            if isinstance(value, list):
                out[key] = str(value[0])
            elif isinstance(value, dict):
                for sub, sv in _flatten(value).items():
                    out[f"{key}.{sub}"] = sv
            else:
                out[key] = str(value)
    return out


def api_exception_handler(exc, context):
    # Translate framework and database exceptions into DRF ones first, so
    # everything below has a single shape to work with.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()
    elif isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, "message_dict")
                                         else exc.messages)
    elif isinstance(exc, ProtectedError):
        # on_delete=PROTECT fired. A 500 here is wrong — the request was
        # understood and deliberately refused.
        exc = exceptions.ValidationError(
            {"detail": "This record is still referenced and cannot be deleted."}
        )
    elif isinstance(exc, IntegrityError):
        # Match on the constraint NAME, which is why every constraint in
        # data-layer declares one. Message text differs between MySQL versions.
        text = str(exc)
        if "uniq_order_product" in text:
            exc = exceptions.ValidationError({"product": "Already in this order."})
        else:
            logger.exception("Unmapped IntegrityError")
            return Response(
                {"error": {"code": "conflict",
                           "message": "That conflicts with existing data."}},
                status=status.HTTP_409_CONFLICT,
            )

    response = drf_handler(exc, context)

    if response is None:
        # Nothing handled it — a genuine bug. Log the traceback server-side and
        # return nothing useful to the client. With DEBUG=True, DRF would
        # otherwise return an HTML traceback containing SQL and settings.
        logger.exception("Unhandled exception in %s", context.get("view"))
        return Response(
            {"error": {"code": "server_error",
                       "message": "Something went wrong on our end."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    fields = _flatten(detail) if isinstance(detail, dict) else {}
    message = (
        fields.pop("detail", None)
        or fields.pop("non_field_errors", None)
        or ("Please check the highlighted fields." if fields else "Request failed.")
    )

    body = {
        "error": {
            "code": CODES.get(response.status_code, "error"),
            "message": message,
        }
    }
    if fields:
        body["error"]["fields"] = fields

    # Throttling: tell the client how long to wait rather than letting it retry
    # into the limit.
    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        wait = getattr(exc, "wait", None)
        if wait:
            body["error"]["retry_after"] = int(wait)
            response["Retry-After"] = str(int(wait))

    response.data = body
    return response
```

```python
REST_FRAMEWORK["EXCEPTION_HANDLER"] = "common.exceptions.api_exception_handler"
```

## Status codes

| Code | When |
|---|---|
| 400 | Validation failed |
| 401 | No credentials, or expired token |
| 403 | Authenticated, not permitted |
| 404 | Does not exist, **or** exists but is not yours |
| 409 | Conflicts with existing state |
| 422 | Do not use — 400 covers it in DRF |
| 429 | Throttled |
| 500 | Your bug |

401 versus 403 matters to the frontend: 401 triggers a token refresh, 403 must
not. Confusing them causes a refresh loop on every permission denial.

**404 for someone else's record.** Returning 403 confirms the record exists,
which lets an attacker enumerate order ids by walking integers. Scope the
queryset and let `get_object()` raise 404 naturally.

## Never leak the exception

```python
# WRONG
return Response({"error": str(exc)}, status=500)
```

`str(exc)` on a database error contains the query, the column names, and
sometimes values. On a `KeyError` it contains internal structure. Log it, return
a generic message.

## The frontend side

```js
// services/api.js — one place, feeding every call site
const e = error.response?.data?.error;
error.normalized = {
  code: e?.code ?? "network_error",
  message: e?.message ?? "Could not reach the server.",
  fields: e?.fields ?? {},
  retryAfter: e?.retry_after,
};
```

```jsx
catch (err) {
  setFieldErrors(err.normalized.fields);           // straight into the form
  if (err.normalized.code !== "validation_error") {
    toast.error(err.normalized.message);
  }
}
```

Branch on `code`, never on `message` — message text is copy and will change.

## Verification

```bash
# Validation error carries fields.
curl -s -X POST localhost:8000/api/auth/register/ \
  -H 'Content-Type: application/json' -d '{}' | python -m json.tool
# PASS: {"error": {"code": "validation_error", "fields": {...}}}

# Permission denial carries no fields.
curl -s -X POST localhost:8000/api/products/ \
  -H "Authorization: Bearer $CUSTOMER" -d '{}' | python -m json.tool
# PASS: {"error": {"code": "permission_denied", "message": "..."}} — 403

# Someone else's order is 404, not 403.
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/orders/1/ \
  -H "Authorization: Bearer $OTHER_CUSTOMER"
# PASS: 404
```

```python
def test_500_leaks_nothing(self):
    with mock.patch("product.views.ProductViewSet.list", side_effect=RuntimeError("db pw is hunter2")):
        r = self.client.get("/api/products/")
    self.assertEqual(r.status_code, 500)
    self.assertNotIn("hunter2", r.content.decode())
    self.assertEqual(r.json()["error"]["code"], "server_error")
```

## Common mistakes

- Endpoints inventing their own error shapes
- Parsing DRF's four shapes at each call site
- `str(exc)` in a response
- 403 where 404 would avoid confirming existence
- 403 that triggers the frontend's token refresh
- Branching on `message` instead of `code`
- 429 with no `Retry-After`, so the client retries into the limit
- `IntegrityError` reaching the client as a 500
