# Testing acceptance

What "the tests pass" has to mean before it counts.

## 1. The suite runs

```bash
pytest -q
# PASS: green, no errors

npm test -- --run
# PASS: green
```

```bash
pytest --collect-only -q | tail -1
# PASS: a plausible count. A suite that collects 4 tests is not a suite.
```

## 2. Security regressions are covered

```bash
pytest tests/test_security_regressions.py -v
# PASS: all green
```

```bash
pytest tests/test_security_regressions.py --collect-only -q \
  | grep -oE "test_(s|c|p|n)[0-9]+" | sort -u
# PASS: S1 S2 S3 S4 S5 S6 S7 S8 N2 N5 all present
```

- [ ] Every audit finding has a test named after it
- [ ] S7/S8 have **both** a backend and a frontend test
- [ ] Each failure message names the fix, not just the assertion

## 3. No hidden skips

```bash
pytest -rs
# PASS: no skipped test in the security suite without a stated reason
```

A skipped security test is an open finding wearing a green tick.

## 4. Permissions are tested per role

```bash
pytest -k "permission or cannot_write" -v
# PASS: anonymous, customer, staff, superuser each asserted
```

- [ ] Anonymous write → 401
- [ ] Customer write to staff-only → 403 (**not** 401 — 401 triggers a token
      refresh loop in the frontend)
- [ ] Staff write → 200/201
- [ ] Another customer's record → 404, not 403

## 5. Server-authoritative values

```bash
pytest -k "total or price or recompute" -v
```

- [ ] Client-supplied `unit_price` is ignored; the DB holds the catalogue price
- [ ] Assertions read the **database**, not the response body
- [ ] A structural test asserts no writable `total_amount`/`unit_price`/`status`/`user`

## 6. Query counts are pinned

```bash
pytest -k query_count -v
```

- [ ] `django_assert_num_queries(N)` with an exact N, never a range
- [ ] A test proves the count is constant under 10× rows

## 7. Constraints are proven at the database

- [ ] At least one test uses `objects.create()` (bypassing `full_clean`) and
      expects `IntegrityError`

Without this, the test proves the serializer works and says nothing about a
management command or a `bulk_create`.

## 8. Races use TransactionTestCase

```bash
grep -rn "ThreadPoolExecutor" tests/
# PASS: every hit is inside a TransactionTestCase, not django_db
```

`django_db` wraps each test in a transaction that never commits, so threads
cannot see each other's writes and every race test passes vacuously.

## 9. Time tests straddle the boundary

```bash
grep -rn "freeze_time" tests/
# PASS: at least one frozen time falls in the 18:00-23:59 UTC window,
#       which is the next day in Asia/Dhaka
```

A test frozen at noon passes under both `UTC` and `Asia/Dhaka` and proves
nothing. That is how C2 survived.

## 10. Isolation

```bash
pytest -p no:randomly -q && pytest -q
# PASS: same result. Order-dependent tests mean leaking state.
```

- [ ] `cache.clear()` is autouse — throttle counters leak between tests and the
      failure lands on whichever test runs next
- [ ] Unmocked outbound network calls fail loudly
- [ ] `mail.outbox` is cleared between tests

## 11. Frontend tests the user's view

```bash
grep -rn "querySelector\|\.instance()" src/**/*.test.jsx
# PASS: no output — use getByRole / getByLabelText
```

```bash
grep -rn "vi.mock.*api" src/
# PASS: no output — mock the network with MSW, so interceptors and error
#       normalisation actually run
```

- [ ] `onUnhandledRequest: "error"` is set in the MSW server
- [ ] Async content uses `findBy*`, not `getBy*`
- [ ] No assertions on inline styles or transforms

## 12. The known-bug tests exist

Each of these caught a real defect. All should be present:

- [ ] Cart increment does not mutate the original array
- [ ] Submit button re-enables after a failed submit
- [ ] Failed submit preserves entered values
- [ ] Server field error lands on the right input with `aria-invalid`
- [ ] Focus moves to the first invalid field
- [ ] Tampered `localStorage` role does not render admin UI

## 13. CI runs it

- [ ] Security suite runs on **every push**, not nightly
- [ ] Migrations run from an empty database in CI
- [ ] A failing security test blocks the merge

## Sign-off

| § | Area | Result |
|---|---|---|
| 1–3 | Suite runs, regressions covered, no hidden skips | |
| 4–5 | Permissions and server authority | |
| 6–7 | Query counts and constraints | |
| 8–9 | Races and time | |
| 10 | Isolation | |
| 11–12 | Frontend | |
| 13 | CI | |

§2 and §4 are the ones that map to exploitable findings. A green suite that
skips those is a green suite that proves nothing.
