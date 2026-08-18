---
name: deploy-and-env
description: Get a Django + React app onto a server and keep configuration honest — env var contracts with fail-fast startup validation, .env.example generation, cPanel Passenger and VPS gunicorn/nginx paths, static and media strategy, migrations on deploy, backup and restore, CI pipeline, release and rollback. Use when deploying, setting up a server, adding an environment variable, debugging a config difference between local and production, writing CI, or planning a rollback. Trigger on "deploy", "deployment", "production", "server setup", "cPanel", "passenger_wsgi", "gunicorn", "nginx", "environment variable", "env var", ".env", "collectstatic", "CI", "GitHub Actions", "pipeline", "rollback", "backup", "restore", "it works locally but not in production".
---

# Deploy and env

Configuration and deployment. The gap between "works on my machine" and "works
on the server" is almost always a value that differs and nothing that checks.

## When to use

- Deploying, or setting a server up for the first time
- Adding or renaming an environment variable
- A behaviour that differs between local and production
- Writing or fixing CI
- Planning a release, or recovering from one

Do **not** use it for secret *rotation* or git-history scrubbing — that is
`security-hardening/04-secrets.md`, which owns the runbooks and the incident
response. This skill owns the *contract*: which keys exist, that they are
present and well-formed at boot, and how they reach the process.

## The rule

**A missing or malformed config value crashes the process at boot, with a
message naming the key.**

Never `None`, never a silent default, never a failure three weeks later inside a
payment call.

**C1** is the case study. `settings.py` read the courier credentials as:

```python
STEADFAST_API_KEY = os.environ.get('<the literal key value>')
```

The secret was pasted in as the variable *name*. No such variable existed, so
the setting evaluated to `None`, the truthiness check in `OrderViewSet.track`
skipped the API call, and courier dispatch and tracking were **silently dead in
production**. No error, no log line, no alert. A boot-time check would have
caught it on the first deploy.

Copy [`assets/env_config.py`](assets/env_config.py) and route every setting
through it. `env('KEY')` with no default raises `ImproperlyConfigured` at import
time.

## Route by task

| Task | Read |
|---|---|
| Adding a variable, naming, casting, startup validation, `.env.example` | [01-env-contract.md](references/01-env-contract.md) |
| cPanel Passenger, VPS gunicorn + nginx, restart, logs, WSGI paths | [02-hosting.md](references/02-hosting.md) |
| `collectstatic`, WhiteNoise, Cloudinary, the frontend build, CORS/CSRF hosts | [03-static-and-media.md](references/03-static-and-media.md) |
| Migrations on deploy, backup, restore, release order, rollback | [04-release.md](references/04-release.md) |
| Lint, test, security gate, build, deploy — and what must not be skippable | [05-ci.md](references/05-ci.md) |

## Decisions

**Where does config live?** `.env` on the server, read by `python-dotenv`, never
in `settings.py`. On a platform with a config UI (Railway, Render, cPanel
environment variables), use it — it keeps the value off the filesystem
entirely.

**One settings file or several?** One, with values from the environment.
`settings_prod.py` and `settings_dev.py` drift: a security setting added to one
and not the other is invisible until an incident. Where a difference is
genuinely structural, `if not DEBUG:` inside the one file, so both branches are
visible together.

**cPanel or VPS?** cPanel/Passenger is what this project has, and it is fine for
this load. It cannot run a long-lived worker process, so background work is a
cron-drained outbox rather than a Celery worker — see `jobs-and-integrations`.
A VPS gains that flexibility and costs you sysadmin work.

**Migrate automatically on deploy?** Yes for additive migrations, as part of the
deploy script. No for anything destructive — a column drop runs by hand, after
a backup, in a window. [04](references/04-release.md) has the split.

**Which branch deploys?** `main`, always, through CI. A deploy from a laptop
skips every gate and is unreproducible; the first thing you want during an
incident is to know exactly what is running.

## Workflow

**First deploy**

1. Copy `assets/env_config.py` to the settings package; route every setting
   through `env()`.
2. Generate `.env.example` from the code —
   [01](references/01-env-contract.md) has the one-liner. Commit it.
3. Fill `.env` on the server. `SECRET_KEY` freshly generated, `DEBUG=False`.
4. `python manage.py check --deploy` — zero warnings, not "only the ones we
   know about".
5. Wire the host per [02](references/02-hosting.md).
6. `migrate`, then `collectstatic`, then restart.
7. Frontend: `npm run build`, deploy `dist/`, confirm `VITE_API_URL` points at
   the real API.
8. Run [checklists/deploy-acceptance.md](checklists/deploy-acceptance.md).

**Adding an environment variable**

1. `env('NEW_KEY')` in settings — required, or with an explicit safe default.
2. Add it to `.env.example` in the same commit.
3. Set it on the server **before** deploying the code that reads it.

Steps 2 and 3 are the ones that get skipped, and skipping 3 means the deploy
itself is the outage.

**Every deploy**

```bash
git pull --ff-only
pip install -r requirements.txt
python manage.py check --deploy          # STOP on any warning
python manage.py migrate --noinput
python manage.py collectstatic --noinput
touch tmp/restart.txt                    # Passenger; or systemctl reload
curl -sf https://api.example.com/health/ # STOP if this fails
```

## What this skill does not own

| Concern | Owner |
|---|---|
| Secret rotation, git-history scrubbing, incident response | `security-hardening/04-secrets.md` |
| The `SECURE_*` settings block and what each does | `security-hardening/03-settings-hardening.md` |
| Outbox draining, cron jobs, third-party clients, `/health/` internals | `jobs-and-integrations` |
| Which tests exist and what they assert | `testing-harness` |
| Bundle and payload budgets the CI gate enforces | `performance-budget` |
| Safe vs unsafe migration operations | `data-layer/04-migrations.md` |

This skill runs the gates. The other skills define what they check.

## Before you start — what to ask the user for

Every value in `.env.example` that is blank must come **from the user**. None of
it can be derived, and none of it may be invented.

Ask in one batch before writing any config:

- `SECRET_KEY` — or confirm you may generate one (you may; it is the only one).
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` — from the hosting panel.
- `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` — a Gmail **app password**, which
  requires 2FA on the account. The user must create it; you cannot.
- `CLOUDINARY_*`, `STEADFAST_*`, `BKASH_*` — provider consoles. **Ask sandbox or
  live for this environment**, and never default to live.
- `ALLOWED_HOSTS`, `FRONTEND_URL`, `BACKEND_URL`, CORS/CSRF origins — the real
  domains, with scheme.

Human-only actions to confirm are done **before** you proceed:

- Rotating any credential that has been in git — it is compromised, and
  deploying new config around a live leaked password accomplishes nothing.
- Creating the app password / enabling 2FA.
- Adding the deploy SSH key, and setting repository secrets in CI.
- Pointing DNS, and confirming the TLS certificate issued.

A placeholder that looks real is worse than a blank. `<from-bkash-portal>` is
obviously unset; `sk_live_4eC39H...` gets shipped. And a value guessed into
`os.environ.get()` is **C1** — the courier keys resolved to `None` and dispatch
was silently dead for months.

## Verification

```bash
# 1. Every env key the code reads is documented.
diff <(grep -rhoE "env\(['\"][A-Z_]+" --include=*.py . | grep -oE "[A-Z_]{2,}" | sort -u) \
     <(grep -oE "^[A-Z_]+" .env.example | sort -u)          # PASS: no output

# 2. Boot fails loudly on a missing required var (C1).
env -u SECRET_KEY python manage.py check
# PASS: ImproperlyConfigured naming SECRET_KEY. FAIL: it starts.

# 3. Deployment checks are clean, and DEBUG is off (S4).
python manage.py check --deploy                             # PASS: zero issues
python manage.py shell -c "from django.conf import settings; print(settings.DEBUG)"

# 4. No secret in the bundle; health reports its dependencies.
npm run build && grep -rnE "SECRET|PASSWORD|API_KEY" dist/assets/*.js   # no output
curl -sf https://api.example.com/health/ | python -m json.tool
```

Full list: [checklists/deploy-acceptance.md](checklists/deploy-acceptance.md).

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| **C1** | `os.environ.get('<literal key>')` — value passed as the variable name, silently `None`, courier dead | [01](references/01-env-contract.md) |
| **S4** | `DEBUG = True` hardcoded, cascading to three `SECURE_*` settings being off | [01](references/01-env-contract.md), gate in [05](references/05-ci.md) |
| **S3** (partly) | Secrets in tracked source; no `.env.example`, no scan gate. Rotation is `security-hardening/04` | [01](references/01-env-contract.md), [05](references/05-ci.md) |
| **P3** | No asset budget in the pipeline — a 6.6 MB PNG shipped unnoticed | [05](references/05-ci.md) |
