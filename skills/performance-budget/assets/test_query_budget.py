"""Query-count budgets. Copy to tests/test_query_budget.py.

These pin the number of database queries each hot endpoint makes. A pinned
count is the only thing that stops an N+1 from returning silently: a nested
serializer added six months from now will fail this file rather than the
production database.

Counts are EXACT, not ranges. `< 20` hides the regression from 5 to 19, which
is the regression this file exists to catch. When a count legitimately changes,
first confirm it is still CONSTANT as row count grows (that is what
`test_p4_product_list_query_count_is_constant` checks), then update the number
here in the same commit.

Requires: pytest, pytest-django. Fixtures come from tests/conftest.py
(testing-harness/assets/conftest.py).
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

pytestmark = pytest.mark.django_db


# --- Budgets ----------------------------------------------------------------
# Update deliberately, never to make a test pass.

QUERY_BUDGET = {
    "/api/products/": 5,
    "/api/categories/": 2,
    "/api/brands/": 2,
}

MAX_QUERIES_ANY_REQUEST = 10
MAX_LIST_RESPONSE_BYTES = 100 * 1024


def count_queries(client, url):
    """Return (query_count, captured) for a GET, asserting it succeeded.

    A 404 with 1 query would otherwise pass every budget in this file.
    """
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(url)
    assert response.status_code == 200, f"{url} returned {response.status_code}"
    return len(ctx.captured_queries), ctx.captured_queries


def _describe(captured):
    """Readable failure output — the SQL, truncated, in execution order."""
    return "\n".join(f"  {i + 1}. {q['sql'][:140]}" for i, q in enumerate(captured))


# --- P4: N+1 across the catalogue -------------------------------------------

@pytest.mark.parametrize("url,budget", sorted(QUERY_BUDGET.items()))
def test_list_endpoint_query_budget(client, url, budget, catalogue_50):
    """Each list endpoint stays inside its pinned query count.

    P4: ProductSerializer used fields='__all__' with four nested read-only
    serializers and no select_related/prefetch_related on the viewset queryset,
    producing 1 + 50x4 = 201 queries for 50 products.
    """
    count, captured = count_queries(client, url)
    assert count == budget, (
        f"{url} made {count} queries, budget is {budget}.\n"
        f"Add select_related/prefetch_related, or update the budget "
        f"deliberately if the change is intended.\n{_describe(captured)}"
    )


def test_p4_product_list_query_count_is_constant(client, catalogue_5, catalogue_50):
    """The count must not grow with row count.

    This is the real N+1 test. An endpoint at exactly 5 queries for 5 rows and
    50 for 50 passes a fixed-count check only if the fixture size never
    changes — so compare two sizes directly.
    """
    small, _ = count_queries(client, "/api/products/?page_size=5")
    large, captured = count_queries(client, "/api/products/?page_size=50")
    assert small == large, (
        f"Query count grew with row count: {small} for 5 rows, {large} for 50. "
        f"That is an N+1.\n{_describe(captured)}"
    )


def test_product_detail_query_budget(client, product):
    """Detail views load more relations than lists, and still have a ceiling."""
    count, captured = count_queries(client, f"/api/products/{product.id}/")
    assert count <= MAX_QUERIES_ANY_REQUEST, (
        f"Detail made {count} queries, ceiling is {MAX_QUERIES_ANY_REQUEST}.\n"
        f"{_describe(captured)}"
    )


# --- P1: payload size --------------------------------------------------------

def test_p1_product_list_response_size(client, catalogue_50):
    """A list response stays under 100 KB.

    P1: the frontend fetched the entire catalogue on mount and filtered it in
    JavaScript. A list serializer plus pagination is what keeps this bounded;
    if this fails, one of the two is missing.
    """
    response = client.get("/api/products/")
    assert response.status_code == 200
    size = len(response.content)
    assert size <= MAX_LIST_RESPONSE_BYTES, (
        f"List response is {size / 1024:.0f} KB, budget is "
        f"{MAX_LIST_RESPONSE_BYTES / 1024:.0f} KB. Use a list-specific "
        f"serializer and check PAGE_SIZE."
    )


def test_p1_list_endpoints_are_paginated(client, catalogue_50):
    """A list response carries pagination metadata rather than every row."""
    response = client.get("/api/products/")
    body = response.json()
    assert isinstance(body, dict) and "results" in body, (
        "List returned a bare array — no pagination. Set "
        "DEFAULT_PAGINATION_CLASS, or a growing table becomes a growing "
        "response with no ceiling."
    )
    assert len(body["results"]) < 50, (
        f"Page returned {len(body['results'])} of 50 rows; PAGE_SIZE is not "
        f"in effect."
    )


def test_page_size_param_is_capped(client, catalogue_50):
    """?page_size cannot be used to request everything.

    An uncapped page_size_query_param is a free denial of service: one request
    for page_size=100000 does the full table scan and serialises all of it.
    """
    response = client.get("/api/products/?page_size=100000")
    assert response.status_code == 200
    results = response.json().get("results", [])
    assert len(results) <= 100, (
        f"page_size=100000 returned {len(results)} rows. Set max_page_size on "
        f"the pagination class."
    )


# --- Structural: catches endpoints not written yet ---------------------------

def test_no_serializer_uses_all_fields():
    """fields='__all__' publishes every future column automatically.

    Performance: it pulls large text and JSON columns into list responses.
    Security: it publishes buying_price the moment that column is added.
    """
    import pathlib

    offenders = [
        f"{path}:{i}"
        for path in pathlib.Path(".").rglob("serializers.py")
        if ".venv" not in str(path) and "site-packages" not in str(path)
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
        if "'__all__'" in line or '"__all__"' in line
    ]
    assert not offenders, "fields='__all__' at:\n  " + "\n  ".join(offenders)


def test_no_third_party_call_in_order_placement(client, customer_token, attribute):
    """C3: the invoice email was sent synchronously inside place_order.

    conftest.py blocks outbound sockets during tests, so a synchronous SMTP or
    courier call raises here rather than merely being slow. The correct shape is
    a row written to the outbox and drained after commit — see
    jobs-and-integrations.
    """
    response = client.post(
        "/api/orders/place_order/",
        {"items": [{"attribute": attribute.id, "quantity": 1}]},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {customer_token}",
    )
    assert response.status_code in (200, 201), (
        f"Order placement returned {response.status_code}. If this is a "
        f"blocked-socket error, a third-party call is happening inside the "
        f"request path."
    )
