# Report format

The output shape. It is the format of `problems and solutions.md`, because that
document worked: it was read, agreed with, and acted on.

## Structure

```markdown
# <Project> — Security, Correctness & Performance Audit
**Date** · **Scope** (what was read) · **Not covered** (what was not)

## Summary            — three sentences and a count by severity
## Findings           — one table per category: S / C / P
## Execution order    — a dependency-ordered fix sequence
## Verification plan  — one runnable check per finding
## Not covered        — the honest gap list
```

## The finding table

Four columns. Not five, not eight.

```markdown
| # | Defect | Evidence | Fix |
|---|---|---|---|
| S1 | **Anonymous write to the whole catalog** | `product/views.py:22` — `permission_classes = [permissions.AllowAny]` on `ProductViewSet` (a `ModelViewSet`). Same on `ProductImageViewSet`, `ProductAttributeViewSet`, `ProductColorViewSet` | `IsAdminOrReadOnly` for unsafe methods; keep reads public |
```

What makes each column work:

- **`#`** — a stable id (`S1`, `C3`, `P4`). It survives into commit messages,
  test names (`test_s1_anonymous_cannot_write`) and conversation. This is the
  single highest-leverage part of the format: a finding with an id gets
  referred to; a finding without one gets re-described and re-argued.
- **Defect** — bolded, and phrased as *what an attacker or user can do*, not as
  what the code looks like. "Anonymous write to the whole catalog", not
  "missing permission_classes".
- **Evidence** — `file:line`, with the actual code. Every sibling location, not
  just the first. Without a location a finding is an opinion.
- **Fix** — specific enough to implement. "`IsAdminOrReadOnly` for unsafe
  methods" is a fix; "improve permissions" is a wish.

Never put the secret in the Evidence column. `settings.py:99` — the report gets
committed, pasted into chat and screenshotted.

## Worked example

```markdown
| S5 | **Order totals trusted from the client** | `orders/views.py:166,197` — `total_amount` and per-item `price` are taken from the request body and saved unchanged. A crafted POST buys anything for ৳1 | Recompute server-side from `ProductAttribute`; treat client values as advisory. Rule: `security-hardening/06`. Test: `test_s5_server_recomputes_order_total` |
```

Note the fix names both the rule and the test. That is the triangle: the rule
stops it being written, the check finds it, the test stops it returning. A fix
with no test is a fix with a return date.

## Severity ordering

Order within each table by exploitability × blast radius:

1. Exploitable by anyone, right now, with real loss
2. Exploitable with a valid account
3. Needs a precondition, or degrades under load
4. Correct today, fragile tomorrow

Grade a **silent** failure one level higher than the same failure that raises.
C1 returned `None` and disabled courier dispatch for months with no error
anywhere — the invisibility is what made it expensive.

## Execution order

Not the same as severity order. Some fixes depend on others, and some are
cheap enough to fold in.

```
S8 (localStorage tampering) ← FIRST, actively exploitable
  ↓
S1/S2 (API permissions)     ← the real boundary; S8's fix is incomplete without it
  ↓
S5 (price recompute)        ← needs S1/S2 in place to be meaningful
S6 (permission rewrite)
  ↓
C2 (timezone)               ← config, minutes
C3 (async email)
  ↓
P1/P4 (serializer split)    ← touches both sides; do together
P2 (lazy routes)
P3 (image compression)
```

The reasoning in the arrows matters more than the boxes. "S5 needs S1/S2 first"
tells a reader why they cannot reorder it.

## Verification plan

One runnable check per finding, in the same table shape.

```markdown
| Check | How |
|---|---|
| **S1/S2** | `curl -X POST /api/products/` without auth → 401. With a shopper token → 403. With an admin token → 201. Repeat for `/categories/` and `/brands/` |
| **S5** | POST `place_order` with `price: 1` → the DB row shows the real `ProductAttribute.discountedPrice` |
| **S8** | Set `is_staff: true` in localStorage, reload `/admin` → spinner, then redirect home |
| **C2** | `settings.TIME_ZONE == 'Asia/Dhaka'` |
| **P4** | `assertNumQueries(5)` on `/api/products/`, constant at 10 and 1000 rows |
```

Every check must be **runnable by someone who did not write it** and produce an
unambiguous yes or no. "Verify permissions work" is not a check.

## Deferred findings

A finding the owner decides not to fix is recorded, not deleted:

```markdown
| C6 | **`stock_quantity` allows negatives** | `product/models.py:76` — plain `IntegerField` | **Intentional.** Ops track oversold items via admin flags. Documented in the model with a comment; a `CheckConstraint` would break the workflow. Decided by Ifti, 2026-08-08 |
```

Named decision, dated, with the reason. A finding that vanishes between audits
looks like an oversight the next time, and gets re-litigated.

## The "not covered" section

Required. An audit that implies full coverage is worse than one that names its
gaps, because the reader stops looking.

```markdown
## Not covered

- **Concurrency.** No load testing. Two simultaneous checkouts on the last
  unit, and two payment callbacks arriving together, are untested.
- **Business logic.** Whether the discount rules match intent is not inferable
  from the code.
- **Third-party behaviour.** bKash sandbox was not exercised against live.
- **Test honesty.** The suite is green; whether each test asserts anything
  meaningful was not reviewed.
- **Frontend accessibility.** Out of scope this pass — see `ui-design-system/06`.
```

## Tone

Findings are about code, not about people. "The order total is taken from the
request body" — not "the developer forgot to validate".

Two reasons, and the second is the real one: it is more accurate (this is a
systemic gap, which is why the suite encodes rules rather than reminders), and a
report that reads as blame gets argued with instead of fixed.

State severity plainly without inflating it. Everything is not critical. If
everything is critical, the reader picks their own order and the ranking was
wasted.

## Length

Proportional to findings, not to effort. Eighteen findings fit on four pages in
this format. A twenty-page audit does not get read, and an audit that is not
read has no effect at all.
