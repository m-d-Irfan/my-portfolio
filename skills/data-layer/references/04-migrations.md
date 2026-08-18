# Migrations

Changing a schema that already holds real customer orders.

## The rules

1. **Never edit an applied migration.** Anyone who has run it already has the
   old version recorded. Write a new one.
2. **Never `--fake` past a failure** unless you have verified by hand that the
   database already matches. Otherwise Django believes a change exists that does
   not, and every later migration builds on a lie.
3. **Review the generated SQL before applying to production.**
   `python manage.py sqlmigrate app 0012`
4. **One logical change per migration.** A failed multi-change migration leaves
   the schema half-applied.
5. **Commit migrations with the model change.** A model change without its
   migration is a broken deploy for everyone else.

## Safe vs unsafe on MySQL

Assume the table is large and in use.

| Operation | Safety |
|---|---|
| Add a nullable column | Safe |
| Add a column with a default | Safe on MySQL 8 (instant), rewrites on 5.7 |
| Add an index | Safe-ish — MySQL 8 does it online; still costs I/O |
| Rename a column | **Unsafe** — old code writing to the old name breaks |
| Drop a column | **Unsafe** — old code selecting it breaks |
| Add `NOT NULL` to an existing column | **Unsafe** — fails if any row is NULL |
| Add a `CHECK`/`UNIQUE` constraint | **Unsafe** — fails if any row violates it |
| Change a column type | **Unsafe** — full rewrite, table locked |

"Unsafe" means it breaks if code and schema are not deployed at the same
instant. On a single-server cPanel deploy where the app restarts with the
migration, most of these are fine. They stop being fine the moment there are two
app servers, a rolling deploy, or a background worker.

## Three-step column removal

```
1. Deploy code that no longer reads or writes the column.
2. Deploy the migration that drops it.
3. (Renames only) deploy code that uses the new name.
```

Never drop in the same deploy as the code change. If the deploy is rolled back,
the old code returns and the column is gone.

## Making a column NOT NULL

The one-step version fails on the first NULL row:

```python
# WRONG
migrations.AlterField("order", "phone", models.CharField(max_length=20))
```

Three migrations, or one migration with three ordered operations:

```python
# 0012 — add nullable
migrations.AddField("order", "phone",
    models.CharField(max_length=20, null=True, blank=True))

# 0013 — backfill
def backfill_phone(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Order.objects.filter(phone__isnull=True).update(phone="")

# 0014 — tighten
migrations.AlterField("order", "phone", models.CharField(max_length=20, default=""))
```

Same shape for adding a constraint: fix the violating rows in a data migration
first, then add the constraint. Check what you are up against before writing it:

```python
>>> OrderItem.objects.filter(quantity__lte=0).count()
3
```

## Data migrations

```python
from django.db import migrations


def set_business_dates(apps, schema_editor):
    # apps.get_model, NOT a direct import. This returns the model as it existed
    # at THIS migration, not as it exists in today's models.py. A direct import
    # breaks the moment a later migration changes the model — and it breaks
    # when re-running migrations from zero, not when you write it.
    Order = apps.get_model("orders", "Order")

    for order in Order.objects.filter(business_date__isnull=True).iterator(chunk_size=2000):
        order.business_date = timezone.localtime(order.created_at).date()
        order.save(update_fields=["business_date"])


def noop(apps, schema_editor):
    """Reverse. Leaving data in place is correct — dropping the column in the
    schema migration removes it anyway, and a destructive reverse makes the
    rollback worse than the problem."""


class Migration(migrations.Migration):
    dependencies = [("orders", "0013_add_business_date")]
    operations = [migrations.RunPython(set_business_dates, noop)]
```

Historical models have fields and managers but **no custom methods and no
signals**. Anything relying on `save()` overrides or a custom manager will not
behave as it does today.

For a large table, batch. A single `.update()` over a million rows holds a lock
long enough to time out the site.

## Merge conflicts

Two branches each adding `0014_` produces two migrations with the same
dependency. Do not renumber by hand.

```bash
python manage.py makemigrations --merge
```

This creates `0015_merge_…` depending on both. Review it; it is usually correct.

## Squashing

Hundreds of migrations slow test setup and CI.

```bash
python manage.py squashmigrations orders 0001 0087
```

Deploy the squash, confirm every environment has applied through `0087`, *then*
delete the originals in a later release. Deleting them immediately breaks any
environment still mid-way.

`RunPython` operations cannot always be squashed automatically — check the
output.

## Before applying to production

```bash
python manage.py sqlmigrate orders 0014        # read the actual SQL
python manage.py migrate --plan                # confirm the order
# take a backup
python manage.py migrate
```

The backup is not optional for anything in the unsafe table above. `migrate`
has no undo for a dropped column.

## Verification

```bash
python manage.py makemigrations --check --dry-run
# PASS: "No changes detected" — a model change without a migration is a
#       broken deploy for every other developer

python manage.py migrate --plan
# PASS: only the migrations you expect
```

```bash
# Migrations run cleanly from zero. Catches data migrations that import models
# directly, and dependencies that only work because your local DB is already
# in the right state.
python manage.py migrate --run-syncdb --database=test_fresh
```

CI must run migrations from an empty database on every build. A migration chain
that only works incrementally from your laptop is not a migration chain.

## Common mistakes

- Editing an applied migration
- `--fake` to get past a failure
- Direct model import in a data migration instead of `apps.get_model`
- Dropping a column in the same deploy as the code change
- `NOT NULL` or a constraint without backfilling first
- Renumbering conflicting migrations by hand instead of `--merge`
- Deleting squashed originals before every environment has caught up
- No backup before an unsafe operation
- Never testing migrations from zero
