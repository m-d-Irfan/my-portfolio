# Regression discipline

Turning a bug you fixed into a bug that cannot return.

## The rule

> **Every finding gets a test named after it, before the fix is merged.**

Write the test first and watch it fail. A regression test that has never failed
is a test you have no reason to trust — it may be asserting nothing.

```
1. Reproduce.               A failing test.
2. Confirm it fails         for the reason you think.
3. Fix.
4. Confirm it passes.
5. Revert the fix locally.  It must fail again.
6. Restore. Merge both.
```

Step 5 is the one people skip and the one that catches a test asserting
something incidental.

## Name the finding in the test

```python
def test_s2_customer_cannot_write(customer_client, path, method):
    """S2: any logged-in customer could create and edit catalogue objects."""
```

Three benefits: CI names the finding directly, the docstring explains why an
odd-looking assertion exists, and nobody deletes it during a cleanup because it
looks redundant.

Use the audit ids — `S1`–`S8`, `C1`–`C6`, `P1`–`P4`, `N2`, `N5`. They are the
shared vocabulary between `problems and solutions.md`, the skills, and the suite.

## Structural tests over instance tests

An instance test catches one occurrence. A structural test catches the class.

```python
# Instance — catches this endpoint
def test_products_requires_staff(customer_client):
    assert customer_client.post("/api/products/", {}).status_code == 403


# Structural — catches every endpoint, including ones not written yet
def test_every_viewset_declares_permissions():
    missing = [
        cls.__name__
        for pattern in get_resolver().url_patterns
        if (cls := getattr(getattr(pattern, "callback", None), "cls", None))
        and "permission_classes" not in vars(cls)
    ]
    assert not missing
```

The second one fails on a viewset added six months from now by someone who never
read the audit. That is the difference between fixing a bug and closing a class
of bug.

Write both where you can. The structural test prevents; the instance test
documents.

## Both halves of a two-sided finding

S7 and S8 were client-side-only authorisation. The fix has two halves:

| Half | Test | Location |
|---|---|---|
| Server refuses | `test_s8_staff_flag_is_not_client_assertable` | `test_security_regressions.py` |
| UI does not render | `it("ignores a tampered localStorage role")` | `AdminRoute.test.jsx` |

**Neither alone closes the finding.** Hiding a link on a UI whose endpoint
answers is theatre; a secure endpoint behind a UI that leaks staff-only
affordances is a confusing product.

When a finding spans both sides, write both tests and cross-reference them in
the docstrings.

## Assert the stored value, not the response

```python
# Weak — the response can be right while the row is wrong
assert response.json()["total_amount"] == "45000.00"

# Strong
order = Order.objects.get(pk=response.json()["id"])
assert order.total_amount == Decimal("45000.00")
```

For anything about money, permissions, or ownership, the database is the
subject.

## Make the failure message name the fix

```python
assert not found, (
    f"S3 REGRESSION: credential literals in settings.py: {found}. "
    f"Move to environment variables and rotate every exposed value — a secret "
    f"that reached git is compromised even after deletion."
)
```

The person hitting this in CI at 6pm has not read the audit. A bare
`assert not found` sends them digging; this one tells them what to do.

## Choose values that make the bug obvious

```python
product.price = Decimal("45000.00")   # not 10.00
```

A test priced at `10.00` that returns `1.00` looks like a rounding or units
problem. One that expects `45000.00` and gets `1.00` names the finding on
sight — the client-supplied price was accepted.

Same for time:

```python
@freeze_time("2026-08-08 23:30:00")   # 05:30 next day in Asia/Dhaka
```

A test at noon passes under both `UTC` and `Asia/Dhaka`. That is exactly why C2
survived — pick a moment that straddles the boundary.

## Never weaken a regression test

When one starts failing, the options are: the code broke, or the requirement
changed. Only the second justifies editing the test — and then it needs a note
saying what changed and who decided.

Broadening an assertion to make CI green re-opens the finding while leaving a
test that claims it is closed. That is worse than no test.

```python
# Was:
assert response.status_code == 403
# Became, to "fix" a failure:
assert response.status_code in (200, 403)   # now asserts nothing
```

## Keep the suite honest

```bash
pytest tests/test_security_regressions.py -v
```

Every audit finding should appear in that output. When a new finding is
discovered, it lands here before the fix ships.

Run the security suite on every push, not nightly. A regression found three days
later has already been built on.

## Verification

```bash
# Every audit id has a test.
pytest tests/test_security_regressions.py --collect-only -q | grep -oE "test_(s|c|p|n)[0-9]+" | sort -u
# PASS: S1-S8, C2, C3, P4, N2, N5 all present

# No skips hiding in the security suite.
pytest tests/test_security_regressions.py -rs
# PASS: no unexplained skip — a skipped security test is an open finding
```

## Common mistakes

- Writing the test after the fix, so it has never failed
- An instance test where a structural one was possible
- Testing only one half of a client/server finding
- Asserting on the response when the database is the subject
- A failure message that does not name the fix
- Test values that hide the bug
- Weakening an assertion to clear CI
- Security tests skipped in CI without a stated reason
