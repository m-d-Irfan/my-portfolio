---
name: testing-harness
description: Set up and write tests for a Django + React project — pytest-django fixtures, permission matrices, security regression tests, query-count assertions, Vitest and React Testing Library, MSW network mocking. Use when adding tests, setting up a test suite, writing a regression test for a bug, or deciding what is worth testing.
---

# Testing harness

Tests that catch the bugs this project actually had.

## Why this skill exists

`problems and solutions.md` lists eighteen findings. A document enforces
nothing — every one of them could return tomorrow and CI would stay green.

This skill converts findings into tests. That is the mechanism that makes a fix
permanent.

## Route by task

| Task | Read |
|---|---|
| pytest-django setup, permission matrices, query counts, constraints, races, time | [01-backend-testing.md](references/01-backend-testing.md) |
| Vitest, RTL, MSW, role gating, forms, cart, async states | [02-frontend-testing.md](references/02-frontend-testing.md) |
| Writing a regression test for a bug you just fixed | [03-regression-discipline.md](references/03-regression-discipline.md) |

Copy first, then write:

| Asset | To | Purpose |
|---|---|---|
| [`assets/conftest.py`](assets/conftest.py) | `tests/conftest.py` | Fixtures, cache clearing, network blocking |
| [`assets/test_security_regressions.py`](assets/test_security_regressions.py) | `tests/` | One test per audit finding |

## The five rules

1. **Write the failing test before the fix.** A regression test that has never
   failed is one you have no reason to trust. Revert the fix locally and confirm
   it fails again before merging.
2. **Name the finding in the test.** `test_s2_customer_cannot_write` — so CI
   names the finding, and nobody deletes it during a cleanup.
3. **Assert on the database, not the response.** For money, permissions and
   ownership, a correct response over a wrong row is the failure mode.
4. **Prefer structural tests.** `test_every_viewset_declares_permissions` catches
   endpoints not written yet. An instance test catches one.
5. **Both halves of a client/server finding.** S8 needs a backend test *and* a
   frontend test. Neither alone closes it.

## Decisions

**What is worth testing?** In order: permissions per role, server-authoritative
values, money and stock logic, constraint enforcement, query counts, auth flows.
Not: the ORM, DRF serialization, third-party libraries, or getters.

**`django_db` or `TransactionTestCase`?** `django_db` for almost everything.
`TransactionTestCase` whenever threads are involved — `django_db` wraps the test
in a transaction that never commits, so concurrent writes are invisible and
every race test passes vacuously.

**Mock what?** The network, with MSW. Never your own API module — mocking it
skips the interceptors and error normalisation, so the test passes with an error
shape production has never produced.

**`force_authenticate` or a real token?** `force_authenticate` for permission
tests, which are about what a role may do. A real token for auth-flow tests —
otherwise a broken JWT config passes every permission test.

**Exact query count or a range?** Exact. A range hides the regression the test
exists to catch. When the count legitimately changes, verify it is still
*bounded* under more rows, then update the number.

## Workflow

**Setting up**

1. `pip install pytest pytest-django pytest-cov freezegun`
2. Copy `assets/conftest.py` → `tests/conftest.py`
3. Copy `assets/test_security_regressions.py` → `tests/`
4. `pytest -q` — expect failures; each names a finding that is still open
5. Fix them, or record why one is deliberately deferred

**Fixing a bug**

1. Write a failing test named for the finding
2. Confirm it fails for the reason you think
3. Fix
4. Revert the fix locally; confirm it fails again
5. Merge test and fix together

**Adding a feature**

Permission test first — anonymous, customer, staff. Then behaviour. A feature
without a permission test is how S1 and S2 happened.

## What this skill does not own

| Concern | Owner |
|---|---|
| Which permission class an endpoint needs | `security-hardening` |
| The error envelope shape being asserted | `api-contract` |
| Constraints and indexes being tested | `data-layer` |
| Form wiring under test | `forms-and-validation` |
| CI pipeline configuration | `deploy-and-env` |

This skill owns *how to prove* the others are correct.

## Verification

```bash
pytest -q                                     # PASS: green
pytest tests/test_security_regressions.py -v  # PASS: every finding covered
pytest -rs                                    # PASS: no unexplained skips
npm test -- --run                             # PASS: green
```

```bash
# Order independence — a difference means leaking state.
pytest -p no:randomly -q && pytest -q
```

```bash
# No component test mocks the API module.
grep -rn "vi.mock.*api" src/
# PASS: no output
```

Full list: [checklists/testing-acceptance.md](checklists/testing-acceptance.md).

## Audit findings this skill closes

Not by fixing them — by making them unable to return silently.

| Ref | Test |
|---|---|
| **S1** | `test_s1_anonymous_cannot_write` — parametrised over endpoints × methods |
| **S2** | `test_s2_customer_cannot_write` |
| **S3** | `test_s3_no_hardcoded_secrets_in_settings`, `test_s3_no_secret_pasted_as_env_var_name` |
| **S4** | `test_s4_production_security_settings`, `test_s4_debug_defaults_to_false` |
| **S5** | `test_s5_server_recomputes_order_total`, `test_s5_no_writable_price_fields` |
| **S6** | `test_s6_no_permission_class_returns_bare_true`, `test_s6_every_viewset_declares_permissions` |
| **S7/S8** | `test_s8_staff_flag_is_not_client_assertable` + the frontend tampered-localStorage test |
| **N2** | `test_n2_otp_verify_is_throttled`, `_otp_expires`, `_otp_is_not_stored_in_plaintext` |
| **N5** | `test_n5_upload_rejects_a_renamed_executable`, `_oversized_file`, `_discards_client_filename` |
| **P4** | `test_product_list_query_count` — see [01](references/01-backend-testing.md) |
| **C2** | `freeze_time` at a boundary-straddling moment — see [01](references/01-backend-testing.md) |
