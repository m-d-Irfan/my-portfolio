"""Shared pytest fixtures.

Copy to `tests/conftest.py`.

Fixtures are the reason a test suite stays readable. Without them every test
opens with fifteen lines of setup, and when the User model changes you edit
fifty files instead of one.

Requires: pytest, pytest-django, djangorestframework.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """Unauthenticated API client. The anonymous attacker."""
    return APIClient()


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email="customer@example.com",
        password="test-pass-123",
        is_staff=False,
        is_superuser=False,
    )


@pytest.fixture
def other_customer(db):
    """A second customer, for testing that one cannot read the other's data."""
    return User.objects.create_user(
        email="other@example.com",
        password="test-pass-123",
        is_staff=False,
    )


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        email="staff@example.com", password="test-pass-123", is_staff=True
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email="admin@example.com", password="test-pass-123"
    )


@pytest.fixture
def customer_client(customer):
    """Authenticated as an ordinary customer.

    `force_authenticate` skips the token round-trip. That is correct for
    permission tests, which are about what a *role* may do — but it means these
    tests do not exercise the auth backend. Test that separately in
    test_auth_flows.py, or a broken JWT setup passes every permission test.
    """
    api = APIClient()
    api.force_authenticate(user=customer)
    return api


@pytest.fixture
def staff_client(staff):
    api = APIClient()
    api.force_authenticate(user=staff)
    return api


@pytest.fixture
def admin_client(superuser):
    api = APIClient()
    api.force_authenticate(user=superuser)
    return api


@pytest.fixture
def customer_token(customer, client):
    """A real JWT, for tests that must exercise the full auth path."""
    response = client.post(
        "/api/auth/login/",
        {"email": customer.email, "password": "test-pass-123"},
        format="json",
    )
    return response.json()["access"]


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------


@pytest.fixture
def category(db):
    from category.models import Category

    return Category.objects.create(name="Doors", slug="doors")


@pytest.fixture
def brand(db):
    from brand.models import Brand

    return Brand.objects.create(name="DAF", slug="daf")


@pytest.fixture
def product(db, category, brand):
    """A product with a deliberately large price.

    45000 is not arbitrary — it makes the S5 regression obvious. A test that
    prices things at 10.00 hides a units bug; one that expects 45000.00 and
    gets 1.00 names the finding on sight.
    """
    from product.models import Product

    return Product.objects.create(
        title="Teak Door 900mm",
        slug="teak-door-900mm",
        category=category,
        brand=brand,
        price=Decimal("45000.00"),
        stock_quantity=10,
        is_active=True,
    )


@pytest.fixture
def seeded_catalogue(db, category, brand):
    """Twenty products, for pagination and query-count tests.

    Query-count assertions need more than one row or an N+1 looks identical to
    a single query.
    """
    from product.models import Product

    return [
        Product.objects.create(
            title=f"Product {i}",
            slug=f"product-{i}",
            category=category,
            brand=brand,
            price=Decimal("1000.00") + i,
            stock_quantity=5,
            is_active=True,
        )
        for i in range(20)
    ]


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


@pytest.fixture
def customer_order(db, customer, product):
    from order.models import Order, OrderItem

    order = Order.objects.create(
        user=customer, shipping_address="Test address", total_amount=Decimal("45000.00")
    )
    OrderItem.objects.create(
        order=order, product=product, quantity=1, unit_price=product.price
    )
    return order


@pytest.fixture
def other_customer_order(db, other_customer, product):
    """Someone else's order. Used to assert 404 rather than 403 — a 403
    confirms the row exists, which turns sequential ids into a customer list."""
    from order.models import Order, OrderItem

    order = Order.objects.create(
        user=other_customer,
        shipping_address="Other address",
        total_amount=Decimal("45000.00"),
    )
    OrderItem.objects.create(
        order=order, product=product, quantity=1, unit_price=product.price
    )
    return order


# ---------------------------------------------------------------------------
# Isolation
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_cache():
    """Throttle counters live in the cache and leak between tests.

    Without this, a test that exhausts a rate limit makes the next test fail
    with 429 — and the failure lands on whichever test happens to run next, so
    it looks unrelated and moves around when you reorder the file.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def use_fast_password_hashing(settings):
    """PBKDF2 is deliberately slow. Across a few hundred fixtures that is
    minutes of pure hashing per run."""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def block_real_network(monkeypatch, request):
    """Fail loudly on an unmocked outbound request.

    Without this a test hits the real bKash sandbox or Steadfast API — slow,
    flaky, and occasionally it creates real records. Mark a test with
    `@pytest.mark.allow_network` when it genuinely needs the socket.
    """
    if "allow_network" in request.keywords:
        return

    import socket

    def guard(*args, **kwargs):
        raise RuntimeError(
            "Unmocked network call in a test. Mock the client, or mark the test "
            "with @pytest.mark.allow_network."
        )

    monkeypatch.setattr(socket.socket, "connect", guard)


@pytest.fixture
def mailoutbox_clear():
    from django.core import mail

    mail.outbox.clear()
    yield mail.outbox
    mail.outbox.clear()
