# Release

Getting a change onto the server, and getting it off again when it is wrong.

## The order is fixed

```
backup → pull → deps → check → migrate → collectstatic → restart → verify
```

Each step depends on the one before it. The two that get reordered, and what
happens:

- **`check --deploy` after `migrate`**: a config error is discovered after the
  schema has already changed, so the rollback is now a schema rollback.
- **`restart` before `collectstatic`**: the new code runs against old static
  files, so the manifest lookup raises `Missing staticfiles manifest entry` on
  every page.

```bash
#!/usr/bin/env bash
set -euo pipefail          # -e: stop on first failure. This is the whole safety.

cd ~/daf_backend

bash ~/scripts/backup_db.sh

git pull --ff-only origin main
source ~/virtualenv/daf_backend/3.11/bin/activate
pip install -r requirements.txt

python manage.py check --deploy
python manage.py migrate --noinput
python manage.py collectstatic --noinput

touch tmp/restart.txt
sleep 3

curl -sf https://api.delhialuminium.com/health/ || {
  echo "HEALTH CHECK FAILED — see references/04-release.md rollback"; exit 1
}
echo "Deployed $(git rev-parse --short HEAD)"
```

`set -euo pipefail` is what makes this a deploy script rather than a list of
hopeful commands. Without `-e`, a failed `migrate` is followed cheerfully by a
restart onto a half-migrated database.

`git pull --ff-only` refuses to merge. A merge commit created on the server
means the server's history has diverged from origin, and the next deploy
conflicts.

## Migrations

**Additive migrations run automatically.** Adding a nullable column, a new
table, a new index — safe, reversible, no data loss.

**Destructive migrations run by hand**, after a backup, in a window:

| Operation | Why not automatic |
|---|---|
| `RemoveField` | Old code still running mid-deploy will `SELECT` the column |
| `RenameField` | Old code breaks the instant it applies |
| `AlterField` narrowing a type | Silent truncation, or a failure halfway through |
| Adding `NOT NULL` without a default | Fails on any existing row |
| Adding `UNIQUE` | Fails if duplicates exist, after locking the table |
| A data migration over a large table | Locks; can exceed the request timeout |

`data-layer/04-migrations.md` owns the safe patterns — the short version is
that every one of these splits into an additive deploy, a backfill, and a
cleanup deploy, with the code that stops using the old shape shipping in
between.

```bash
# Read the SQL before applying it. Always, for anything not obviously additive.
python manage.py sqlmigrate orders 0012

# Confirm no model change is unmigrated.
python manage.py makemigrations --check --dry-run
# PASS: "No changes detected"
```

The second command belongs in CI. A model changed without a migration is a
deploy that works locally (SQLite recreated from models) and fails in
production.

## Backup

Before every deploy, and nightly.

```bash
#!/usr/bin/env bash
# scripts/backup_db.sh
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
DEST=~/backups
mkdir -p "$DEST"

# --single-transaction: consistent snapshot without locking the tables.
# Credentials come from ~/.my.cnf (chmod 600), never on the command line —
# a password in argv is visible to every user via `ps`.
mysqldump --defaults-file=~/.my.cnf --single-transaction --quick \
  --routines --triggers "$DB_NAME" | gzip > "$DEST/db-$STAMP.sql.gz"

# 14 daily, and keep the 1st of each month.
find "$DEST" -name 'db-*.sql.gz' -mtime +14 ! -name 'db-*01-*.sql.gz' -delete

echo "Backed up to $DEST/db-$STAMP.sql.gz ($(du -h "$DEST/db-$STAMP.sql.gz" | cut -f1))"
```

**A backup that has never been restored is not a backup.** Restore into a
scratch database monthly and confirm the row counts:

```bash
gunzip -c ~/backups/db-20260801-021500.sql.gz | mysql scratch_db
mysql scratch_db -e "SELECT COUNT(*) FROM orders_order;"
```

Off-site matters. A backup on the same server is gone with the server. `rclone`
to object storage, or download nightly.

Media is separate. Cloudinary keeps its own copy, but a database restore to
last Tuesday with today's Cloudinary state leaves recently-deleted references
dangling. Note the pairing when you restore.

## Release order across the stack

When a change spans both sides, **deploy the backend first** — but only if the
change is additive.

```
1. Backend: add the new field, keep the old one, populate both.   ← deploy
2. Frontend: read the new field.                                   ← deploy
3. Backend: remove the old field.                                  ← deploy, later
```

Backend-first works because an additive API change cannot break the existing
frontend. Frontend-first means the new UI calls an endpoint that does not exist
yet, and every user in that window gets an error.

For a genuinely breaking change, the sequence is not two deploys — it is the
expand/contract cycle in `api-contract/03-versioning.md`, with a period where
both shapes are served.

## Rollback

**Decide before deploying what "rolled back" means.** The answer differs by
what shipped:

| Shipped | Rollback |
|---|---|
| Code only | `git checkout <prev-sha>`, reinstall deps, restart |
| Code + additive migration | Roll back the code. Leave the migration — an unused column is harmless |
| Code + destructive migration | Restore the database backup. This is why destructive migrations are manual and windowed |
| Frontend only | Redeploy the previous `dist/`. Keep the last two builds on disk |

```bash
# Code rollback.
cd ~/daf_backend
git log --oneline -5
git checkout <previous-sha>
pip install -r requirements.txt
python manage.py collectstatic --noinput
touch tmp/restart.txt
curl -sf https://api.delhialuminium.com/health/
```

Note what is *not* here: `migrate <app> <previous_migration>`. Reverse
migrations are frequently lossy and sometimes impossible — a `RemoveField`
reversed gives you the column back, empty. For anything destructive the backup
is the rollback.

**Tag every release** so a rollback target is unambiguous under pressure:

```bash
git tag -a v1.4.0 -m "Order idempotency keys, list serializer split"
git push origin v1.4.0
```

Deploy from `main` through CI; roll back to a tag.

## Health check

```bash
curl -sf https://api.delhialuminium.com/health/
```

It must actually check the database, not just return 200 from Django — a
process that boots with an unreachable database will happily serve a static OK.
`jobs-and-integrations` owns the endpoint's contents.

Point an uptime monitor at it, alerting after two consecutive failures. One
failure is a blip; two is an outage.

## After every deploy

1. Health check green.
2. Log in as a real user.
3. Place one test order end to end — the flow that touches the most code.
4. Check the error log for anything new.
5. Confirm the outbox drained (`tail ~/logs/outbox.log`).

Five minutes. It catches the class of failure that a health check cannot: the
app is up and one path through it is broken.

## Verification

```bash
# 1. No unmigrated model change.
python manage.py makemigrations --check --dry-run
# PASS: "No changes detected"

# 2. Deployment checks clean.
python manage.py check --deploy
# PASS: zero issues

# 3. Backup is recent and non-trivial.
ls -lh ~/backups/ | tail -3
# PASS: today's file, and not a few hundred bytes

# 4. The backup restores.
gunzip -c ~/backups/db-latest.sql.gz | mysql scratch_db && \
  mysql scratch_db -e "SELECT COUNT(*) FROM orders_order;"
# PASS: a plausible count

# 5. Deployed SHA matches origin/main.
git rev-parse HEAD && git rev-parse origin/main
# PASS: identical

# 6. Health check.
curl -sf https://api.delhialuminium.com/health/ | python -m json.tool
# PASS: status ok, database ok

# 7. Rollback target exists.
git tag --sort=-creatordate | head -3
# PASS: the current release is tagged
```
