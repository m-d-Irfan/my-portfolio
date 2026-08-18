---
name: data-layer
description: Django models, migrations, constraints, indexes, query optimisation, transactions and timezone handling. Use when adding or changing a model, writing a migration, fixing an N+1 or slow query, handling a race condition on stock or checkout, or deciding between database constraints and application validation.
---

# Data layer

The database is the last line of defence. Application code is not — a
management command, `bulk_create`, a shell session, or a second service writing
to the same MySQL instance all bypass every `clean()` you wrote.

## Route by task

| Task | Read |
|---|---|
| Adding or changing a model, choosing field types, `on_delete`, slugs | [01-modeling.md](references/01-modeling.md) |
| `CheckConstraint`, `UniqueConstraint`, indexes, `IntegrityError` → 409 | [02-constraints-and-indexes.md](references/02-constraints-and-indexes.md) |
| N+1, slow list endpoint, `select_related`/`prefetch_related`, aggregation, pagination | [03-queries.md](references/03-queries.md) |
| Writing a migration, backfilling, dropping a column, merge conflicts, squashing | [04-migrations.md](references/04-migrations.md) |
| `atomic`, `on_commit`, stock races, `select_for_update`, `F()`, idempotency, timezone | [05-transactions-and-time.md](references/05-transactions-and-time.md) |

Copy [`assets/models_base.py`](assets/models_base.py) to `common/models.py`
before writing your first model. It provides `TimeStampedModel`,
`SluggedModel`, `SoftDeleteModel`, `BaseDomainItem` and `unique_slug` — each one
fixing a defect this codebase has actually shipped.

## The five rules

1. **Constraints in the database, validation in the serializer.** The constraint
   is the guarantee; the serializer is the error message. You need both, and
   they are not substitutes.
2. **`on_delete=PROTECT` by default.** `CASCADE` only for rows meaningless
   without their parent. One admin click should not be able to destroy the
   catalogue.
3. **Every nested serializer needs a matching prefetch.** A `many=True`
   serializer over a queryset with no `prefetch_related` is finding **P4** —
   201 queries for 50 products.
4. **Multi-row writes are `@transaction.atomic`; side effects are
   `on_commit`.** Email inside a transaction means an invoice for an order that
   rolled back.
5. **`timezone.localdate()`, never `date.today()`.** And store `business_date`
   explicitly rather than deriving it from a timestamp.

## Decisions

**Constraint or serializer validation?** Both. Write the `CheckConstraint` for
correctness and the serializer rule for the message. If you only have budget for
one, write the constraint — a 500 is better than corrupt data.

**`select_related` or `prefetch_related`?** Forward `ForeignKey`/`OneToOne` →
`select_related` (a JOIN). Reverse FK or `ManyToMany` → `prefetch_related` (a
second query). `select_related` on a reverse relation raises.

**`select_for_update` or `F()`?** For a single-row counter, `F()` with the
condition in the `WHERE` clause — cheaper, no lock. For multi-row invariants
that must be read and then decided on, `select_for_update` inside `atomic()`.

**Hard or soft delete?** Soft delete anything with a financial or legal trail:
orders, invoices, stock movements. Hard delete is fine for a draft or a cache
row. Soft delete plus `unique=True` needs a conditional constraint — see
[02](references/02-constraints-and-indexes.md).

**Denormalise?** Only where the copy *is* the correctness. `OrderItem` must
store `unit_price` and `product_name` as sold — reading them through the FK lets
tomorrow's price change rewrite last month's invoices.

## Workflow

1. Copy `assets/models_base.py` to `common/models.py` if it is not there.
2. Write the model. Field types per [01](references/01-modeling.md); `PROTECT`
   unless the child is meaningless alone.
3. Add `constraints` and `indexes` in `Meta`, each with an explicit `name=` so
   they can be matched in an exception handler and migrated cleanly.
4. `makemigrations`, then **read** `sqlmigrate` output before applying.
5. If the change is unsafe on existing data (`NOT NULL`, new constraint, drop,
   rename), split it per [04](references/04-migrations.md).
6. Add `select_related`/`prefetch_related` to the viewset queryset in the same
   commit as any nested serializer.
7. Wrap multi-row writes in `atomic()`; move side effects to `on_commit`.
8. Run [checklists/data-layer-acceptance.md](checklists/data-layer-acceptance.md).

## What this skill does not own

| Concern | Owner |
|---|---|
| Permission classes, throttling, server-authoritative pricing | `security-hardening` |
| Serializer shape, error envelope, versioning, drift | `api-contract` |
| Viewsets, routers, project layout | `django-backend-builder` |
| Email outbox, courier dispatch, retries | `jobs-and-integrations` |
| Frontend caching, lazy routes, image pipeline | `performance-budget` |
| Writing the tests these checks imply | `testing-harness` |

Server-authoritative pricing lives in `security-hardening` because **S5** is a
security finding, not a modelling one. This skill only insists that
`OrderItem.unit_price` exists as a column so the server has somewhere to write
the truth.

## Verification

Non-negotiable before merge:

```bash
python manage.py makemigrations --check --dry-run   # PASS: no changes
python manage.py migrate                            # against an EMPTY database
grep -rn "FloatField" --include=models.py .         # PASS: no money fields
```

```python
with self.assertNumQueries(4):                      # pinned, not a range
    self.client.get("/api/products/")
```

Full list: [checklists/data-layer-acceptance.md](checklists/data-layer-acceptance.md).

## Audit findings this skill closes

| ID | Finding | Where |
|---|---|---|
| **C2** | `TIME_ZONE = 'UTC'` split the business day at 06:00 local | [05](references/05-transactions-and-time.md) |
| **C6** | `stock_quantity` negatives — intentional, now documented | [01](references/01-modeling.md) |
| **P4** | `fields = '__all__'` + four nested serializers, no prefetch | [03](references/03-queries.md) |
| — | `.name` on a model whose field is `title` | [01](references/01-modeling.md) |
| — | `BaseDomainItem` missing `abstract = True` | [01](references/01-modeling.md) |
| — | `slugify` into a unique column with no collision suffix | [01](references/01-modeling.md) |
| — | `date_joined` redeclared, shadowing `AbstractUser` | [01](references/01-modeling.md) |
