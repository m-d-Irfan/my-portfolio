# Skill map

Every skill's boundary, and the owner of each rule that more than one could
claim. When two skills say something about a topic, one owns it and the other
links — this file is where that is recorded.

## Tier 1 — the spine

| Skill | Owns | Does not own |
|---|---|---|
`security-hardening` | Permission classes, throttling, `SECURE_*` settings, secrets policy, upload validation, server authority | Identity flows (`auth-flows`), where secrets are stored operationally (`deploy-and-env`), the tests (`testing-harness`) |
`auth-flows` | Registration, login, OTP, password reset, tokens, lockout, revocation, roles | What a role is *allowed to do* (`security-hardening`), form UI (`forms-and-validation`) |
`data-layer` | Models, fields, constraints, indexes, migrations, transactions, money, time, idempotency columns | Serializer shape (`api-contract`), query budgets (`performance-budget`), viewsets (`django-backend-builder`) |

## Tier 2 — build

| Skill | Owns | Does not own |
|---|---|---|
`django-backend-builder` | App layout, settings assembly, viewsets, routers, serializer mechanics | Permissions (`security-hardening`), model design (`data-layer`), wire format (`api-contract`) |
`api-contract` | Response shape, error envelope, versioning, deprecation, drift detection | Which fields are *safe* to accept (`security-hardening`), safe to store (`data-layer`) |
`react-vite-frontend-builder` | Project layout, API client, routing, contexts, state ownership, error boundaries | Tokens and states (`ui-design-system`), form wiring (`forms-and-validation`), budgets (`performance-budget`) |
`forms-and-validation` | Form state machine, dual validation, error mapping, submit and double-submit | The security boundary (`security-hardening`), field appearance (`ui-design-system`), motion (`transitions-dev`) |

## Tier 3 — quality and UI

| Skill | Owns | Does not own |
|---|---|---|
`ui-design-system` | Colour, type, spacing, radius, elevation, component primitives, the five states, accessibility | Judgement (`impeccable`), charts (`dataviz`), motion values (`transitions-*`), console density (`admin-panel-builder`) |
`admin-panel-builder` | Console shell, nav, tables, CRUD, bulk actions, density | Auth guard (`auth-flows`), global tokens (`ui-design-system`), charts (`dataviz`) |
`transitions-dev` | Which transition, and its install | Values (`transitions-polish`), what it animates toward (`ui-design-system`) |
`transitions-polish` | Duration, easing, distance, scale, blur, and when each applies | Which transitions exist (`transitions-dev`) |
`performance-budget` | Query counts, payload size, bundle size, asset budgets, Core Web Vitals, measurement | The techniques' correctness (`data-layer`), art direction (`ui-design-system`) |

## Tier 4 — ship and operate

| Skill | Owns | Does not own |
|---|---|---|
`testing-harness` | What to test, fixtures, permission matrices, regression discipline | Which rule is being tested (the owning skill), CI wiring (`deploy-and-env`) |
`deploy-and-env` | Env contract, startup validation, hosting, static/media, release, backup, CI | Secret rotation (`security-hardening/04`), what the gates check (their owners) |
`jobs-and-integrations` | Outbox, third-party clients, payments, courier, PDF, health, logging, audit log | Credential storage (`security-hardening/04`), idempotency columns (`data-layer`), request budgets (`performance-budget`) |

## Tier 5 — the loop

| Skill | Owns | Does not own |
|---|---|---|
`audit-and-review` | Auditing a codebase at rest, the check catalogue, the report format, the seed corpus | Reviewing a diff (`/code-review`, `/security-review`), fixing findings (the owning skill) |
`fullstack-orchestrator` | Routing, sequencing, the done gate, conflict resolution | Every actual rule |

## Disputed rules, resolved

Recorded here so neither skill half-covers it.

| Rule | Owner | Why |
|---|---|---|
Recompute order totals server-side | `security-hardening/06` | S5 is a security finding. `data-layer` only guarantees `OrderItem.unit_price` exists as a column to write the truth into |
Idempotency keys | `data-layer/05` owns the column and constraint; `jobs-and-integrations/01` owns job-level idempotency; `forms-and-validation` owns generating the key once per form instance | Three layers, three owners, one behaviour |
`prefetch_related` | `data-layer/03` owns the mechanics; `performance-budget/01` owns the pinned query-count budget | Correctness vs. the number |
Error shape | `api-contract/02` owns the envelope; `react-vite-frontend-builder` owns normalising it; `forms-and-validation` owns field display; `ui-design-system/05` owns the error *state* | One shape, four consumers |
Secrets | `security-hardening/04` owns policy, rotation and history scrubbing; `deploy-and-env/01` owns the env contract and startup validation | Incident response vs. day-to-day contract |
`prefers-reduced-motion` | `ui-design-system/06` requires it; `transitions-dev` ships the guard in each snippet | Requirement vs. implementation |
Token storage | `auth-flows/01` | The XSS tradeoff is an identity decision |
Role checks | `auth-flows/02` | `/auth/me/` is the only sanctioned check; every other skill links here |
Upload validation | `security-hardening/05` server-side; `forms-and-validation` mirrors it client-side for UX only | The client version is never the boundary |
Dark mode | `ui-design-system/01` | Tokens own it; `admin-panel-builder` inherits |
Health endpoint | `jobs-and-integrations/05` owns its contents; `deploy-and-env/04` owns the monitor pointing at it | |

## Third-party skills

Installed and not part of this suite. Delegate rather than reimplement.

| Skill | Use for | Not for |
|---|---|---|
`impeccable` | Visual judgement, redesign, "does this look good", live browser iteration | Defining the project's tokens — that is `ui-design-system` |
`dataviz` | Charts, dashboards, stat tiles, chart palettes | General UI colour |
`/code-review` | Reviewing a working diff | Auditing a codebase at rest (`audit-and-review`) |
`/security-review` | Security review of pending changes | The standing checklist (`security-hardening`) |

## Which skill, from a symptom

| Symptom | Start at |
|---|---|
"Anyone can call this endpoint" | `security-hardening/01` |
"The price is wrong" | `security-hardening/06` |
"Login is broken" | `auth-flows` |
"The migration failed" | `data-layer/04` |
"The frontend reads a field the API never sends" | `api-contract/01` |
"The form doesn't show the server error" | `forms-and-validation/02` |
"It looks generic" | `ui-design-system/07`, then `impeccable` |
"The animation feels off" | `transitions-polish` |
"The page is slow" | `performance-budget/04` — measure first |
"The email never arrived" | `jobs-and-integrations/01` |
"It works locally but not in production" | `deploy-and-env/01` |
"Who changed this?" | `jobs-and-integrations/05` |
"Is this production ready?" | `audit-and-review` |

## Reading order for someone new

1. `audit-and-review/references/03-seed-corpus.md` — what has actually gone
   wrong here
2. `security-hardening` SKILL.md — the three rules
3. `fullstack-orchestrator` SKILL.md — the map
4. The skill for whatever they are about to build

An hour, and it covers the defects that have cost this project the most.
