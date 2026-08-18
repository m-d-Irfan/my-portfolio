# Deploy acceptance

Run before the first deploy to a new environment, and the short version before
every deploy after that.

## 1. Configuration

- [ ] Every setting is read through `env()` — `grep -rn "os.environ" --include=*.py . | grep -v env_config.py` is empty
- [ ] No `os.environ.get('<lowercase or url>')` anywhere (**C1**)
- [ ] `.env.example` lists every key the code reads, and no more
- [ ] `.env` is gitignored and untracked
- [ ] `env -u SECRET_KEY python manage.py check` fails with a message naming the key
- [ ] No secret-shaped default in an `env()` call
- [ ] `SECRET_KEY` is freshly generated for this environment, not copied
- [ ] `DEBUG=False`, read via `env_bool` (**S4**)
- [ ] `ALLOWED_HOSTS` is explicit; no `*`
- [ ] `require_all()` covers each integration's key group
- [ ] Cache is Redis, not `LocMemCache` — throttling is unenforceable otherwise (**N2**)
- [ ] `TIME_ZONE = 'Asia/Dhaka'` (**C2**)

## 2. Security gate

- [ ] `python manage.py check --deploy` — zero warnings
- [ ] `pytest tests/test_security_regressions.py` — green
- [ ] `gitleaks detect --source . -v` — clean, over full history
- [ ] `git ls-files | grep -E '\.sqlite3$|\.log$'` — empty
- [ ] Every credential that ever reached git has been **rotated**, not just deleted (`security-hardening/04-secrets.md`)
- [ ] Full pre-deploy security checklist run: `security-hardening/checklists/pre-deploy-security.md`

## 3. Server

- [ ] App boots — `/health/` returns `status: ok` **and** `database: ok`
- [ ] HTTP redirects to HTTPS
- [ ] Certificate valid, auto-renewal confirmed to run
- [ ] `/static/` serves 200 with a one-year cache header
- [ ] Responses are gzip- or brotli-compressed
- [ ] MySQL 3306 is not reachable from the internet
- [ ] cPanel Remote MySQL allowlist has no `%` entry
- [ ] `passenger_wsgi.py` keeps cPanel's shebang; `load_dotenv` uses an absolute path
- [ ] `touch tmp/restart.txt` recycles workers
- [ ] Server timezone known, and cron schedules written for it
- [ ] `client_max_body_size` / upload limit matches the validators

## 4. Static and media

- [ ] `collectstatic` runs in the deploy script, after `migrate`, before restart
- [ ] `index.html` is served `no-cache`; hashed assets are `immutable`
- [ ] SPA fallback works — a direct load of `/admin/products` returns 200
- [ ] `VITE_API_URL` baked into the bundle points at the production API
- [ ] No secret-shaped string in `dist/assets/*.js`
- [ ] Cloudinary URLs all carry `f_auto,q_auto` transformations
- [ ] Cloudinary uploads are signed server-side; no unsigned preset
- [ ] Local media (if any) lives outside the deploy directory

## 5. CORS and CSRF

- [ ] `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` include the scheme
- [ ] Both `www` and apex listed, or one redirects to the other
- [ ] `CORS_ALLOW_ALL_ORIGINS` is not True
- [ ] `CORS_ALLOW_CREDENTIALS` matches the token strategy in `auth-flows/01`
- [ ] A browser request from the real frontend origin succeeds

## 6. Release process

- [ ] Deploy script uses `set -euo pipefail`
- [ ] Order is: backup → pull → deps → check → migrate → collectstatic → restart → verify
- [ ] `git pull --ff-only`, never a merge on the server
- [ ] Health check runs last and exits non-zero on failure
- [ ] `makemigrations --check --dry-run` passes
- [ ] Destructive migrations are excluded from the automatic path
- [ ] The current release is tagged
- [ ] The rollback target for this release is written down

## 7. Backup

- [ ] Nightly backup runs and produces a plausibly-sized file
- [ ] Pre-deploy backup runs in the deploy script
- [ ] `mysqldump` credentials come from `~/.my.cnf` (chmod 600), not argv
- [ ] Backups are stored off-server
- [ ] **A restore has been performed and verified within the last month**
- [ ] Media backup state is noted alongside each database backup
- [ ] Retention is defined and old backups are pruned

## 8. CI

- [ ] Pipeline runs on every PR: lint → test → security → budget → build
- [ ] `deploy` declares `needs:` on all gate jobs
- [ ] No `continue-on-error` or `|| true` on any gate
- [ ] Security suite, secret scan and `makemigrations --check` are non-skippable
- [ ] Budget checks (`check_budget.sh`, `test_query_budget.py`) run in CI
- [ ] CI uses MySQL and Redis service containers, not SQLite and LocMem
- [ ] Secrets are repository secrets; none appear in the workflow file
- [ ] `npm ci`, not `npm install`
- [ ] Each gate has been observed failing at least once (deliberately)
- [ ] `pre-commit install` run locally by everyone who commits

## 9. Post-deploy smoke test

Five minutes, every deploy. Catches what a health check cannot.

- [ ] `/health/` green
- [ ] Log in as a real user
- [ ] Place one test order end to end
- [ ] Invoice email arrives (confirms the outbox drained)
- [ ] Courier dispatch reaches the provider (**C1** — this is the check that
      would have caught it)
- [ ] Error log has nothing new
- [ ] `tail ~/logs/outbox.log` shows recent activity

## 10. Monitoring

- [ ] Uptime monitor on `/health/`, alerting after two consecutive failures
- [ ] Error tracking receives events; a deliberate test error was seen
- [ ] Cron output is logged, and the log has been read at least once
- [ ] Someone specific is named as the person alerts reach

## Sign-off

Deployment is ready when every box is ticked, or an unticked box has a written
reason and an owner. "We'll set up backups later" is how a restore gets
attempted for the first time during an incident.
