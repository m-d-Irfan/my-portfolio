---
name: fullstack-orchestrator
description: Entry point for full-stack feature work on a Django + React codebase. Routes a request to the right skills in the right order, sequences work across the backend/frontend boundary so the contract cannot drift, and enforces the definition of done. Use when a request spans both sides, when it is unclear which skill applies, when starting a feature, or when a change needs the whole vertical slice. Trigger on "add a feature", "build X end to end", "full stack", "where do I start", "which skill", "implement", "new page with an API", "wire up the frontend", "vertical slice", or any request naming both a model and a UI.
---

# Full-stack orchestrator

The map. Twelve skills own narrow things well; this one decides which apply and
in what order.

## When to use

- A request touches both Django and React
- It is unclear which skill owns the work
- Starting a feature, or a vertical slice through an existing one
- A change needs sequencing so nothing ships half-wired

Do **not** use it for work that sits inside one skill. "Add a permission class"
is `security-hardening`. "This animation is too slow" is
`transitions-polish`. Going through this skill first adds a hop and no
information.

## The suite

| Skill | Owns |
|---|---|
`django-backend-builder` | Django app structure, viewsets, serializers, URLs
`api-contract` | The wire format, error envelope, versioning, drift detection
`data-layer` | Models, migrations, transactions, money, time, idempotency
`auth-flows` | Registration, login, OTP, tokens, lockout, revocation
`security-hardening` | Permissions, throttling, settings, secrets, uploads, server authority
`react-vite-frontend-builder` | React state ownership, fetching, cache, optimistic updates
`forms-and-validation` | Form state, client and server validation, error mapping
`ui-design-system` | Tokens, type, spacing, colour, states, accessibility
`admin-panel-builder` | Console layout, tables, filters, bulk actions
`transitions-dev` / `transitions-polish` | Motion: which transitions, and their values
`performance-budget` | Query counts, payload size, bundle size, assets
`deploy-and-env` | Env contract, hosting, static/media, release, CI
`jobs-and-integrations` | Outbox, third-party clients, payments, courier, PDF, observability
`testing-harness` | What to test, fixtures, regression suite
`audit-and-review` | Auditing a codebase at rest against known failure classes

## Before you start — what to ask the user for

**Run this before writing code, not after.** Two things cannot come from the
repository, and both silently produce broken software if guessed.

**1. Values only the user has.** API keys, secrets, credentials, merchant ids,
sandbox vs live URLs, SMTP details, domains, webhook secrets, database names.

Never invent one. A realistic-looking placeholder that reaches a config file is
worse than a missing value — it fails at runtime, in production, pointing at the
wrong thing. That is **C1**: a key that resolved to `None` and silently disabled
courier dispatch for months, with no error anywhere.

**2. Actions only the user can perform.** Rotating a leaked credential, creating
a Gmail app password, enabling 2FA, registering an OAuth redirect URI,
whitelisting a domain in a provider console, pointing DNS, running a destructive
migration, buying a plan.

Ask for both in **one batch, at the start**:

```markdown
## Before I start — what I need from you

Cannot be obtained from the code:
1. `BKASH_APP_SECRET` — merchant portal. Sandbox or live for this environment?
2. `STEADFAST_API_KEY` / `STEADFAST_SECRET_KEY` — separate per environment.

Needs doing by you first, because I cannot:
3. Rotate the MySQL password — it is in git history, so it is compromised.
4. Add `https://app.example.com/auth/callback` to the Google console.

I'll scaffold everything that doesn't depend on 1–2 meanwhile, and stop before
wiring the integration. 3 and 4 block the auth flow — tell me when they're done.
```

Then: **keep building whatever does not depend on the answers**, and say exactly
where you stopped and why. Do not idle waiting for a value you do not need yet,
and do not quietly proceed past a blocker with a fake value.

Which skill knows what to ask for:

| Work | Ask about | Owner |
|---|---|---|
| Any deploy or new environment | Every key in `.env.example` | `deploy-and-env/01` |
| Payments, courier, email, SMS | Provider credentials, sandbox vs live | `jobs-and-integrations/02` |
| Login, OAuth, email verification | Redirect URIs, SMTP, app passwords | `auth-flows` |
| Anything after a leak | Rotation — **by the user, before code** | `security-hardening/04` |

## Route by request

| Request | Order |
|---|---|
| New model + list/detail API + page | `data-layer` → `api-contract` → `django-backend-builder` → `security-hardening` → `react-vite-frontend-builder` → `ui-design-system` → `testing-harness` |
| New admin console screen | `admin-panel-builder` → `ui-design-system` → `react-vite-frontend-builder` → `security-hardening` |
| New form | `forms-and-validation` → `api-contract` (error envelope) → `ui-design-system` (states) |
| Login / registration / OTP | `auth-flows` → `security-hardening` (throttle) → `forms-and-validation` |
| Payment or courier | `jobs-and-integrations` → `security-hardening/06` → `data-layer` (idempotency) |
| Email, PDF, background work | `jobs-and-integrations/01` |
| "It's slow" | `performance-budget` → measure first, then the owning skill |
| "Is this safe?" | `audit-and-review` → then the skills its findings name |
| Deploying, or a config difference | `deploy-and-env` |
| Motion feels wrong | `transitions-polish` (values) or `transitions-dev` (which transition) |
| Design feels wrong | `impeccable` for judgement; `ui-design-system` for tokens |

## The order that prevents drift

**Contract first, backend second, frontend third, tests throughout.**

```
1. data-layer        the model. Columns, constraints, money as Decimal, time as Asia/Dhaka
2. api-contract      the wire shape, written down before either side is built
3. django-backend    serializer, viewset, URL — matching the contract exactly
4. security          permissions on the viewset. Not later. Never later
5. testing-harness   API tests, including the permission matrix
6. state/fetching    the frontend reads the real endpoint
7. forms / ui        the interface
8. performance       measure the finished slice
```

Steps 1–3 in that order are what stops **§2.5** — the `product.features` field
four frontend files and a serializer agreed on, that had no model or migration
behind it. Nothing errored: `undefined?.map()` is `undefined`, React rendered
nothing, and filters silently returned zero results for months.

Step 4 is placed where it is because it was skipped: **S1** and **S2** left four
write endpoints open to anonymous users and category deletion open to any
shopper. A viewset without `permission_classes` is not finished.

## Vertical slices

A feature ships as one thin slice through every layer, not layer by layer:
model → migration → serializer → viewset → permission → test → fetch → render.
One field, one endpoint, one page.

Not: all the models, then all the serializers, then all the endpoints, then
discover the frontend needed a different shape. A layer built ahead of its
consumer is built against a guess.

## Definition of done

A change is not done until all of it is true. Each line is owned elsewhere; this
is the gate.

**Backend**
- [ ] Migration exists and applies (`data-layer`)
- [ ] `permission_classes` explicit on the viewset (`security-hardening`)
- [ ] Money is `Decimal`; timestamps `Asia/Dhaka`; server-owned fields
      `read_only` (`data-layer`, `api-contract`)
- [ ] Nothing client-supplied is trusted for price, role or status
      (`security-hardening/06`)
- [ ] List endpoint paginated, query count pinned (`performance-budget`)
- [ ] Third-party calls and email in the outbox (`jobs-and-integrations`)

**Frontend**
- [ ] Reads the real endpoint, not a mock
- [ ] Loading, empty and error states all exist (`ui-design-system/05`)
- [ ] Server errors map to fields (`forms-and-validation`)
- [ ] No hardcoded colour or spacing (`ui-design-system`)
- [ ] Admin routes lazy (`performance-budget/02`)

**Both**
- [ ] Every serializer field exists on the model (`api-contract` drift check)
- [ ] Tests cover the happy path and the permission matrix (`testing-harness`)
- [ ] `audit_scan.sh` clean (`audit-and-review`)
- [ ] Env keys documented in `.env.example` (`deploy-and-env`)
- [ ] No invented credential, key or URL anywhere — every external value came
      from the user, and anything still missing is named out loud
- [ ] Any human-only step (rotation, console config, DNS) was asked for and
      confirmed done, not assumed

## Verification

A slice is done when all four pass. Each delegates to the owning skill's own
verification; this is the gate that runs them together.

```bash
# 1. The contract holds — no serializer field without a model field behind it.
pytest tests/test_contract.py                         # PASS: green

# 2. The permission matrix is enforced, not assumed.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/<resource>/     # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/<resource>/ \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"                                               # 403
# PASS: 401 then 403. Anything else means step 4 of the order was skipped.

# 3. Nothing known-bad was reintroduced.
bash .agents/skills/audit-and-review/assets/audit_scan.sh full

# 4. Budgets still met.
pytest tests/test_query_budget.py && npm run build && bash scripts/check_budget.sh
```

Check 2 is the one to run first. S1 and S2 both shipped because a viewset was
written and its permission class was left for later.

## What this skill does not own

Every actual rule. It owns only routing, sequencing and the gate above — see
[02-skill-map.md](references/02-skill-map.md) for the full ownership table,
including which skill wins each rule two could claim.

## Conflict resolution

When two skills disagree, the priority is fixed:

**Security > correctness > performance > polish.**

- Security vs performance → security. A cached response that leaks another
  customer's order is not fast, it is broken.
- Correctness vs polish → correctness. A transition on a value the server never
  sent is animating a bug.
- Performance vs polish → performance, with a named exception. An entry
  animation on the LCP element adds its full duration to LCP; if it stays, that
  is a budget exception with a written reason (`performance-budget`).
- Two skills claiming the same rule → the more specific one owns it, and the
  other links to it.

## Assumptions to state, not guess

Some ambiguity is a judgement call; some changes the work. Ask about the second
kind:

- **Who can do this?** Anonymous, any logged-in user, or staff. It determines
  the permission class, and guessing produced S1 and S2.
- **Is money involved?** Then the server computes every number (S5).
- **Does it touch a third party?** Then it goes in the outbox (C3).
- **Is it a new field on an existing model?** Then there is a migration and a
  backfill decision.
- **Does it need a value or an action from outside the repo?** Then it is not a
  guess at all — ask, in one batch, before writing the dependent code. See
  "Before you start" above.

Everything else — naming, file placement, which of two equivalent patterns —
decide and say what you assumed.

## Reference files

- [01-feature-workflow.md](references/01-feature-workflow.md) — the full
  end-to-end sequence, worked
- [02-skill-map.md](references/02-skill-map.md) — every skill, its boundaries,
  and who owns each disputed rule

## Common mistakes

- **Building the frontend against a guessed shape.** The contract comes first.
- **Adding permissions last.** They are part of the endpoint, not a follow-up.
- **Layer-by-layer instead of slice-by-slice.**
- **Routing single-skill work through here.** It adds a hop and no information.
- **Skipping the drift check** because both sides "look right". They looked
  right for months in §2.5.
- **Treating the checklist as advisory.** Every line on it is there because it
  was skipped once.
