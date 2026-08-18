---
name: django-backend-builder
description: Build or extend a Django + DRF backend — project layout, settings assembly, apps and domain models, serializers, viewsets, URLs and routers. Use when scaffolding a new Django API, adding a resource or app to an existing one, fixing model/serializer/viewset structure, or wiring MySQL, JWT auth, Cloudinary or environment config. Covers money fields, slug generation, abstract bases, list-vs-detail serializers and query efficiency.
---

# Django backend builder

Builds Django 5 + DRF backends that are safe by default and shaped for a real
storefront: MySQL, JWT, Cloudinary, Bangladesh locale.

## Scope

This skill owns **structure** — where code lives, what shape it takes, how the
pieces connect.

It does **not** own security. Permission classes, throttling, `SECURE_*`
settings, secrets, upload validation and server-side price authority all live in
`security-hardening`, which is the single source of truth for them. This skill
tells you *where* to attach them; that skill tells you *what* they contain.

| Need | Skill |
|---|---|
| Permission classes, throttles, hardened settings | `security-hardening` |
| Login, OTP, password reset, token revocation, `/auth/me/` | `auth-flows` |
| Migrations, indexes, DB constraints, `transaction.atomic` | `data-layer` |
| Preventing frontend/backend drift, error envelope, versioning | `api-contract` |
| Query counts, payload size, N+1 | `performance-budget` |
| Celery vs. outbox, email, bKash, Steadfast, PDF | `jobs-and-integrations` |

## Non-negotiables

Six rules. Each one is a bug that reached production in this codebase.

1. **Money is `DecimalField(max_digits=10, decimal_places=2)`.** Never
   `FloatField`. `0.1 + 0.2 != 0.3`, and an invoice total that is off by
   ৳0.01 is a support ticket that cannot be closed.
2. **Every ViewSet declares `permission_classes` in its own class body** — even
   when the global default would be correct. Two resources shipped writable by
   anonymous users because they inherited a default nobody re-read.
3. **Prices and totals are never read from the request.** Re-fetch the product,
   compute server-side, ignore what the client sent. No fallback.
4. **Serializers list their fields explicitly.** `fields = '__all__'` is how
   `is_staff` and `buying_price` become writable.
5. **List and detail get different serializers.** A list route that embeds
   nested collections is the P1/P2 findings.
6. **`AUTH_USER_MODEL` is set before the first migration.** Changing it later
   means dropping the database.

## Decision rules

**Which app does this model belong in?**
Identity and access → `api`. Catalogue and content → `core_domain`. Money and
fulfilment → `transactions`. If it fits none, it is a new app. See
`references/03-apps-and-domains.md`.

**ViewSet or APIView?**
Standard CRUD on a model → `ModelViewSet`. One specific action, or a payload
that is not a model → `APIView`. Never open a `ModelViewSet` to `AllowAny` to
get one public write; write a function view with explicit validation.

**Does this need a new serializer?**
Different fields for different audiences → yes. Same fields, different
permissions → no, use `read_only_fields` and a permission class.

**Abstract base or concrete?**
Shared fields, no shared table → `abstract = True`. Forgetting it creates a real
table and turns every subclass into multi-table inheritance, which silently
doubles every query.

## Files

Read only what the task needs.

| File | Read when |
|---|---|
| `references/01-project-layout.md` | Starting fresh; deciding where a file goes |
| `references/02-settings-assembly.md` | Touching settings, env vars, database, JWT, CORS |
| `references/03-apps-and-domains.md` | Adding a model, app or abstract base |
| `references/04-serializers.md` | Writing or fixing any serializer |
| `references/05-viewsets.md` | Writing or fixing any viewset, filtering, or custom action |
| `references/06-urls-and-routers.md` | Wiring routes; trailing-slash or 302 problems |
| `assets/settings.py` | Copy verbatim as the settings base |
| `assets/.env.example` | Copy verbatim; keep in sync as vars are added |
| `assets/requirements.txt` | Copy verbatim; pinned |
| `checklists/backend-acceptance.md` | Before declaring the backend done |

Assets are **copied, not retyped.** A template that gets re-derived from memory
is a template that drifts.

## Workflow

**New backend**

1. Read `references/01-project-layout.md`, create the tree.
2. Copy `assets/requirements.txt`, `assets/.env.example`, `assets/settings.py`.
3. Set `AUTH_USER_MODEL` and write `CustomUser` **before** the first migration.
4. Apply `security-hardening` — `settings_security.py`, `permissions.py`,
   `throttles.py`, `validators.py`.
5. Migrate. Confirm `manage.py check --deploy` is clean.
6. Build resources one at a time: model → serializer → viewset → URL → curl it.
7. Apply `auth-flows` for the auth surface, including `/auth/me/`.
8. Run `checklists/backend-acceptance.md`.

**Adding a resource to an existing backend**

1. Read the neighbouring model, serializer and viewset first. Match what is
   there — conventions in the file beat conventions in this skill.
2. Model → migration → serializer (list + detail) → viewset with explicit
   `permission_classes` → route with `basename`.
3. Curl it as anonymous, customer, and admin before moving on.

**Fixing an existing backend**

Start with `checklists/backend-acceptance.md`. It finds real defects faster than
reading files, and it tells you which reference to open.

## Verification

Never report a backend change as done without running these.

```bash
python manage.py check --deploy          # zero warnings
python manage.py makemigrations --check --dry-run   # no pending changes
pytest                                    # green
ruff check .

# Access is real, not assumed. Anonymous and customer must both be refused.
curl -s -o /dev/null -w 'anon:%{http_code}\n' -X POST localhost:8000/api/products/ \
  -H 'Content-Type: application/json' -d '{}'
curl -s -o /dev/null -w 'cust:%{http_code}\n' -X POST localhost:8000/api/products/ \
  -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{}'
# expect: anon:401  cust:403
```

If a change touched serializers or permissions, run the full checklist. Those
two areas produced every exploitable finding in the audit.
