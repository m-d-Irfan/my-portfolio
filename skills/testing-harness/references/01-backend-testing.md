# Backend testing

pytest-django setup, what to test, and what not to.

## Setup

```bash
pip install pytest pytest-django pytest-cov
```

```ini
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
addopts = --reuse-db --strict-markers -q
markers =
    allow_network: permit real outbound requests in this test
```

`--reuse-db` skips recreating the schema on every run — the single biggest
speed win. Drop it with `--create-db` after a migration.

Copy [`assets/conftest.py`](../assets/conftest.py) to `tests/conftest.py` first.
Everything below assumes those fixtures.

## What to test

In priority order. If you only write tests in one category, write the first.

| Priority | What | Why |
|---|---|---|
| 1 | Permissions per role | Every finding S1, S2, S6, S7 was a permission bug |
| 2 | Server-authoritative values | S5 — price, total, status, ownership |
| 3 | Business logic with money or stock | Wrong here means wrong invoices |
| 4 | Constraint enforcement | Proves the DB, not just the serializer, holds the line |
| 5 | Query counts on list endpoints | P4 — N+1 |
| 6 | Auth flows end to end | Login, refresh, OTP, expiry |

Do **not** test: Django's ORM, DRF's serialization, third-party libraries, or
getters that only return a field.

## The permission matrix

The single highest-value pattern in this suite. Parametrise, do not repeat.

```python
import pytest

WRITE = ["post", "put", "patch", "delete"]
STAFF_ONLY = ["/api/products/", "/api/categories/", "/api/brands/"]


@pytest.mark.django_db
@pytest.mark.parametrize("path", STAFF_ONLY)
@pytest.mark.parametrize("method", WRITE)
def test_anonymous_cannot_write(client, path, method):
    response = getattr(client, method)(path, {"title": "x"}, format="json")
    assert response.status_code in (401, 403, 405)


@pytest.mark.django_db
@pytest.mark.parametrize("path", STAFF_ONLY)
@pytest.mark.parametrize("method", WRITE)
def test_customer_cannot_write(customer_client, path, method):
    response = getattr(customer_client, method)(path, {"title": "x"}, format="json")
    assert response.status_code in (403, 405)
```

Twelve assertions from two functions. Adding an endpoint to `STAFF_ONLY` tests
it against every actor and method automatically.

**401 vs 403 matters.** 401 means no credentials and triggers the frontend's
token refresh; 403 means authenticated but not permitted and must not. Returning
401 for a permission denial causes a refresh loop.

## Server-authoritative values

```python
@pytest.mark.django_db
def test_server_recomputes_order_total(customer_client, product):
    """S5: the client sent unit_price and the server stored it."""
    response = customer_client.post(
        "/api/orders/",
        {
            "items": [{"product": product.id, "quantity": 1, "unit_price": "1.00"}],
            "total_amount": "1.00",
        },
        format="json",
    )
    assert response.status_code == 201
    order = Order.objects.get(pk=response.json()["id"])
    assert order.total_amount == Decimal("45000.00")
```

Assert on the **database**, not the response. A response can be correct while
the stored row is wrong.

Pair it with a structural test that catches the same class before a request is
ever made:

```python
def test_no_writable_price_fields():
    writable = {n for n, f in OrderSerializer().get_fields().items() if not f.read_only}
    assert not writable & {"total_amount", "unit_price", "status", "user"}
```

## Query counts

```python
@pytest.mark.django_db
def test_product_list_query_count(client, seeded_catalogue, django_assert_num_queries):
    with django_assert_num_queries(4):
        client.get("/api/products/")
```

Pin the exact number. A range hides the regression the test exists to catch.

The number will change legitimately — when it does, verify the new count is
*bounded*, then update it:

```python
@pytest.mark.django_db
def test_query_count_does_not_grow_with_rows(client, category, brand, django_assert_num_queries):
    make_products(5, category, brand)
    with django_assert_num_queries(4):
        client.get("/api/products/")
    make_products(50, category, brand)
    with django_assert_num_queries(4):   # same number
        client.get("/api/products/")
```

Constant query count under a 10× row increase is what "no N+1" actually means.

## Constraints

```python
@pytest.mark.django_db
def test_zero_quantity_rejected_by_database(customer_order, product):
    with pytest.raises(IntegrityError):
        OrderItem.objects.create(
            order=customer_order, product=product, quantity=0, unit_price=10
        )
```

`objects.create` skips `full_clean()`, so this proves the **database** enforces
it, not the serializer. That is the whole point — a management command or a
`bulk_create` bypasses every serializer you wrote.

Wrap it in `transaction.atomic` if the test continues afterwards; a raised
`IntegrityError` marks the transaction broken.

## Transactions and races

```python
from django.test import TransactionTestCase


class StockRaceTests(TransactionTestCase):
    """TransactionTestCase, not pytest.mark.django_db — the default wraps each
    test in a transaction that never commits, so threads cannot see each
    other's writes and every race test passes vacuously."""

    def test_last_unit_sells_once(self):
        attr = ProductAttribute.objects.create(stock_quantity=1, ...)
        with ThreadPoolExecutor(max_workers=2) as ex:
            results = [ex.submit(try_order, attr.pk).result() for _ in range(2)]
        assert sum(1 for r in results if r) == 1
```

Needs a real database. SQLite in-memory does not model row locking.

## Time

```python
from freezegun import freeze_time


@freeze_time("2026-08-08 23:30:00")   # 05:30 next day in Asia/Dhaka
def test_business_date_uses_local_time(customer_order):
    assert customer_order.business_date == date(2026, 8, 9)
```

Pick a time that straddles the UTC boundary. A test at 12:00 passes under both
`UTC` and `Asia/Dhaka` and proves nothing — which is exactly why C2 survived.

## Email

```python
@pytest.mark.django_db
def test_no_email_when_order_fails(customer_client, product, mailoutbox):
    with pytest.raises(ValidationError):
        place_order(...)
    assert len(mailoutbox) == 0
```

Asserts that side effects are in `on_commit`, not inline. An invoice for an
order that rolled back is worse than no invoice.

## Speed

| Technique | Effect |
|---|---|
| `--reuse-db` | Skip schema creation |
| MD5 password hasher (in `conftest.py`) | PBKDF2 is deliberately slow |
| `pytest -x` while developing | Stop at the first failure |
| `pytest -k pattern` | Run one area |
| `pytest -n auto` (pytest-xdist) | Parallel — needs test isolation |

The `clear_cache` fixture in `conftest.py` is `autouse` for a reason: throttle
counters leak between tests, and the failure lands on whichever test runs next.
It looks unrelated and moves when you reorder the file.

## Verification

```bash
pytest -q                                    # PASS: all green
pytest --cov=. --cov-report=term-missing     # inspect gaps, do not chase a number
pytest tests/test_security_regressions.py -v # PASS: every audit finding covered
```

Coverage is a map of what is untested, not a score. 100% coverage of getters
and 0% of permissions is worse than the reverse.

## Common mistakes

- Testing the framework instead of your code
- Asserting on the response when the database is the thing that matters
- `assertNumQueries` with a range
- Race tests under `django_db` instead of `TransactionTestCase`
- Time tests at a moment that does not straddle the timezone boundary
- No `cache.clear()`, so throttle state leaks between tests
- `force_authenticate` everywhere, so the real auth path is never exercised
- Unmocked outbound calls to bKash or Steadfast
