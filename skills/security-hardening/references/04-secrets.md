# Secrets

This file owns every credential the project uses: where it lives, how it gets into the process, and what to do the moment one leaks.

## The principle

**A secret committed once is compromised forever.**

Deleting the line in a later commit does nothing. The blob remains in history and is reachable by any of:

- every existing clone, on every laptop that ever pulled
- every fork, which is not rewritten when you rewrite your own history
- GitHub's dangling-object storage, where a commit stays fetchable by SHA after a force-push
- CI runner caches and build artifacts
- any mirror, backup, or `git bundle`
- the GitHub API, which serves blobs by SHA regardless of branch reachability

Therefore the order of operations is fixed and non-negotiable:

1. **Rotate first.** This invalidates the credential immediately and stops the bleeding.
2. **Scrub history second.** This stops future discovery.

Doing it the other way round leaves a window — often hours, while you coordinate a force-push — during which the credential is still live and now flagged as interesting by your own commit activity. Public repositories are scanned by bots within seconds of a push; a leaked AWS key is typically used within minutes. Assume the same for anything else.

Say it plainly to whoever is nervous about the rotation downtime: **removal from history is a cleanup, not a fix.** If you only scrub, you have not remediated anything.

## The S3 post-mortem

A git-tracked `daf_backend/daf_backend/settings.py` contains, right now, in plaintext:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': '<db name>',
        'USER': '<db user>',
        'PASSWORD': '<LIVE PASSWORD — see settings.py:99>',
        'HOST': 'localhost',
        'PORT': '3306',
    }
}

EMAIL_HOST_USER = '<the factory gmail account>'
EMAIL_HOST_PASSWORD = '<LIVE GOOGLE APP PASSWORD — see settings.py:238>'
```

**Both credentials are compromised and must be rotated.** The real values are
deliberately *not* reproduced here — this file is tracked in git, and copying a
leaked secret into a second tracked file widens the leak instead of documenting
it. Read the values from `settings.py` when you rotate, then scrub them from
history using the procedure below. Do not treat the presence of this
documentation as remediation.

The same file also contains a subtler variant of the same mistake:

```python
# The literal secret was pasted in as the variable NAME.
STEADFAST_API_KEY = os.environ.get('<the api key itself>')
STEADFAST_SECRET_KEY = os.environ.get('<the secret itself>')
FRONTEND_URL = os.environ.get('https://www.delhialuminium.com/')
```

The author pasted the literal secret in as the **variable name**. This is doubly bad:

- The secret is still committed. Wrapping it in `os.environ.get()` did not hide it; it is a string literal in the source either way.
- No such environment variable exists, so each setting silently evaluates to `None`. The courier integration then fails open with no error anywhere — `getattr(settings, 'STEADFAST_API_KEY', '')` in `OrderViewSet.track` yields `None`, the truthiness check skips the API call, and tracking silently stops working. Nobody gets an alert.

Note also there is a real `.env` file and a `.gitignore` in `daf_backend/`. The mechanism was in place. The secrets were in `settings.py` anyway, which is the normal shape of this failure: it is not that the team did not know about `.env`, it is that `settings.py` is where you are already typing when you need a value to work *right now*.

### Blast radius

| Credential | What an attacker does with it |
| --- | --- |
| MySQL password | Read every customer name, phone, address, order and `transaction_id`; write arbitrary rows; drop tables. Bound only by whether the host allows remote MySQL — on cPanel this is often reachable if the Remote MySQL allowlist was ever widened |
| Gmail app password | Send mail **as** the factory's real address. Phish your own customers from your genuine address, with your genuine branding. Read the mailbox via IMAP, including every OTP the system has ever sent |
| `SECRET_KEY`, if ever committed | Forge session cookies and JWTs for any user, including a superuser. See `03-settings-hardening.md` |

The Gmail one is the worst here. An app password bypasses 2FA by design, and a phishing mail from your genuine address to your genuine customer list is unblockable by any technical control on their side.

## The mechanism: .env + python-dotenv

`python-dotenv` is already installed and already called. The top of `settings.py` is correct:

```python
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
```

What was missing is a reader that refuses to guess.

WRONG:

```python
STEADFAST_API_KEY = os.environ.get('STEADFAST_API_KEY')   # None if unset; fails open, silently
DB_PASSWORD = os.environ.get('DB_PASSWORD', '<the real password>')  # a default IS a committed secret
```

RIGHT:

```python
import os

from django.core.exceptions import ImproperlyConfigured

_UNSET = object()


def env(key, default=_UNSET, cast=str):
    """Read an env var. Raise at boot if a required one is missing."""
    value = os.environ.get(key, _UNSET)
    if value is _UNSET:
        if default is _UNSET:
            raise ImproperlyConfigured(
                f'Required environment variable {key} is not set. See .env.example.'
            )
        return default
    if cast is bool:
        return value == 'True'
    if cast is int:
        return int(value)
    if cast is list:
        return [item.strip() for item in value.split(',') if item.strip()]
    return value


def env_bool(key, default='False'):
    return env(key, default, cast=bool)


def env_int(key, default=None):
    return env(key, default, cast=int) if default is not None else env(key, cast=int)


def env_list(key, default=''):
    return env(key, default, cast=list)
```

The error message names the **key**, never the value. That is a rule, not a detail — see the logging section below.

Fail-fast is the whole point. A missing `DB_PASSWORD` should crash the process at boot with a clear message, not surface three weeks later as a `None` inside a payment call. The Steadfast bug is the case study: silence is the worst possible failure mode for a credential.

## .env.example, the tracked contract

`.env` is ignored. `.env.example` is committed. It lists every key with a blank or obviously-fake value. It is simultaneously your onboarding doc and — critically — **your rotation checklist after a leak**. If a key is not in `.env.example`, nobody will remember to rotate it.

```bash
# .env.example — committed. Copy to .env and fill in. Never commit .env.

# Core
SECRET_KEY=generate-with-get_random_secret_key-50-chars-minimum
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
BEHIND_TLS_PROXY=False

# Database (MySQL in production, SQLite locally)
DB_ENGINE=django.db.backends.mysql
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=3306

# Email — Gmail App Password, NOT the account password. Requires 2FA enabled.
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USE_SSL=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=

# Cloudinary — media storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Steadfast courier
STEADFAST_API_KEY=
STEADFAST_SECRET_KEY=

# bKash — SERVER SIDE ONLY. Never expose app secret to the browser.
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta

# URLs
FRONTEND_URL=https://www.delhialuminium.com
BACKEND_URL=https://api.delhialuminium.com

# Cache — required for throttling to work across gunicorn workers.
# See references/02-throttling.md (N2).
REDIS_URL=redis://127.0.0.1:6379/1
```

Generate a `SECRET_KEY` properly:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Keep `BKASH_BASE_URL` pointed at sandbox in the example. A copy-paste that accidentally hits live payments is a bad first day.

## .gitignore

```gitignore
# Secrets
.env
.env.*
!.env.example
*.pem
*.key
*.p12
credentials.json

# Local data — contains real customer rows and password hashes
db.sqlite3
*.sqlite3

# User uploads
/media/

# Logs — routinely contain tokens, OTP codes and PII
*.log
stderr.log
```

Two entries here are not hypothetical. The repository currently tracks:

- **`db.sqlite3`** (about 600 KB) — real `CustomUser` rows including email addresses, phone numbers, `otp` values and Django password hashes, plus every `Order` with customer names, addresses and `transaction_id`s. A tracked SQLite file is a full customer-data breach in a form nobody thinks to look for.
- **`stderr.log`** (about 1.3 MB) — Django tracebacks. With `DEBUG = True`, a traceback carries local variables, which means request bodies, and request bodies on `/auth/verify-otp/` carry OTP codes while `/auth/login/` carries passwords.

Adding these to `.gitignore` does **not** untrack them. Do that explicitly, and then treat everything in them as leaked:

```bash
git rm --cached db.sqlite3 stderr.log
git commit -m "chore: untrack local database and log file"
```

The data already in history still needs the history scrub below, and every password hash in that file should be treated as offline-crackable.

## The frontend is public

Vite inlines any `VITE_`-prefixed variable into the client bundle at build time. It is not configuration; it is **published source**.

```bash
# .env for the React app — every one of these is public
VITE_API_URL=https://api.delhialuminium.com
```

Prove it to yourself before arguing:

```bash
npm run build
grep -r "VITE_" dist/assets/*.js | head
```

The rule: **if it reaches the React bundle, it is published.** For bKash that means the app secret, username and password are server-side only. The browser may receive a checkout script URL and a short-lived, server-generated payment token — never anything that can be replayed to create a payment. Same for Cloudinary: the API secret signs uploads server-side; the browser gets a signature scoped to one upload. See `05-uploads.md`.

A variable without the `VITE_` prefix is not exposed to the client, but do not rely on the prefix as a security boundary — it is one typo from being one. Keep secrets out of the frontend `.env` entirely.

## Rotation runbooks

### MySQL password

```sql
-- Via cPanel > MySQL Databases > Current Users > Change Password,
-- or directly if you have shell access:
ALTER USER 'asshippi_iftidaf'@'localhost' IDENTIFIED BY '<new-strong-password>';
FLUSH PRIVILEGES;
```

Then:

```bash
# 1. Update .env on the server (never in settings.py)
#    DB_PASSWORD=<new-strong-password>

# 2. Restart the app so the new value is read. Passenger:
touch ~/daf_backend/tmp/restart.txt

# 3. Verify
python manage.py check --database default
python manage.py shell -c "from django.db import connection; connection.ensure_connection(); print('db ok')"
```

Two gotchas. Connections already established keep working until they are recycled — with `CONN_MAX_AGE` above 0, a worker can hold a live connection authenticated under the old password, so the app appears fine while a fresh process fails. Always verify from a new process. And if `'localhost'` was ever also granted as `'%'`, rotate both grants; check with `SELECT user, host FROM mysql.user WHERE user = 'asshippi_iftidaf';`.

### Gmail App Password

1. Google Account → Security → 2-Step Verification → App passwords.
2. **Revoke** the existing entry first — the one currently in `settings.py:238`. Revocation is immediate; any client using it starts failing at once, which is the point — you want the old one dead before the new one exists.
3. Generate a new app password. Google shows it once.
4. Put it in `.env` as `EMAIL_HOST_PASSWORD`, restart, verify:

```bash
python manage.py shell -c "
from django.core.mail import send_mail
send_mail('DAF SMTP rotation check', 'ok', None, ['you@example.com'], fail_silently=False)
print('sent')
"
```

If the account does **not** have 2-Step Verification enabled, app passwords do not exist — which means the value that leaked was the account password itself. In that case: change the Google account password, enable 2FA, sign out all sessions (Security → Your devices → Sign out), review Security → Recent activity and the account's filters and forwarding rules. An attacker with mailbox access commonly installs a forwarding rule and leaves; rotating the password alone does not remove it.

### Django SECRET_KEY

Rotating invalidates sessions, password-reset links, signed cookies and every SimpleJWT token, so all users are logged out. Schedule it. For a graceful roll on Django 4.1+:

```python
SECRET_KEY = env('SECRET_KEY')
SECRET_KEY_FALLBACKS = env_list('SECRET_KEY_FALLBACKS')
```

Deploy the new key with the old one in `SECRET_KEY_FALLBACKS`, wait out `REFRESH_TOKEN_LIFETIME` (7 days here), then remove the fallback. Signing always uses `SECRET_KEY`; verification falls back, so old tokens keep working while new ones use the new key.

### Cloudinary, Steadfast, bKash

Regenerate in each provider console. Notes that matter:

- **Cloudinary**: rotating the API secret invalidates existing signed upload signatures and any signed delivery URLs. Unsigned upload presets keep working — which is a reason not to have any (`05-uploads.md`).
- **Steadfast**: sandbox and live credentials are separate. Confirm which pair leaked; rotating sandbox while live is exposed accomplishes nothing.
- **bKash**: `APP_SECRET` and the `USERNAME`/`PASSWORD` pair are separate credentials and both need rotating. bKash issues short-lived grant tokens from these — existing tokens remain valid until expiry, so rotation is not instant containment.

### Summary

| Credential | Where to rotate | Downtime | Verify with |
| --- | --- | --- | --- |
| MySQL password | cPanel MySQL Databases / `ALTER USER` | Seconds, at restart | `manage.py check --database default` from a fresh process |
| Gmail app password | Google Account → App passwords | None if revoke-then-create is quick | `send_mail` from `manage.py shell` |
| `SECRET_KEY` | Generate locally, set in `.env` | All users logged out unless fallbacks used | Log in, confirm a new JWT is issued |
| Cloudinary API secret | Cloudinary console → Settings → Security | Uploads fail until deployed | Upload a product image through the admin |
| Steadfast keys | Steadfast portal | Tracking fails until deployed | `GET /orders/<id>/track/` on a shipped order |
| bKash app secret | bKash merchant portal | Payments fail until deployed | Sandbox payment end-to-end |

## Scrubbing history

Use **git-filter-repo**. `git filter-branch` is deprecated, dangerously slow and easy to get subtly wrong; the BFG is fine but less flexible. git-filter-repo is the tool the Git project itself recommends.

```bash
pip install git-filter-repo
```

It requires a **fresh clone** and removes the `origin` remote afterwards by design — that is a safety feature preventing an accidental push of a half-rewritten history.

```bash
cd /tmp
git clone --mirror https://github.com/<org>/<repo>.git repo-scrub
cd repo-scrub
```

Replace the secret strings everywhere they appear, preserving the rest of history.

Build the replacements file **locally, from the live values, and do not commit
it** — `/tmp` is the right home for it. Writing the real secrets into a tracked
file to clean up a tracked secret is the mistake you are here to fix.

```bash
# Copy each live value out of settings.py into this file, one per line.
cat > /tmp/replacements.txt <<'EOF'
<mysql password from settings.py:99>==>REDACTED-ROTATED-CREDENTIAL
<gmail app password from settings.py:238>==>REDACTED-ROTATED-CREDENTIAL
<steadfast api key from settings.py:245>==>REDACTED-ROTATED-CREDENTIAL
<steadfast secret from settings.py:246>==>REDACTED-ROTATED-CREDENTIAL
EOF

git filter-repo --replace-text /tmp/replacements.txt
shred -u /tmp/replacements.txt     # or: rm -P  /  Remove-Item on Windows
```

To purge a file entirely — the option for `db.sqlite3` and `stderr.log`, where the whole blob is the problem:

```bash
git filter-repo --path db.sqlite3 --path stderr.log --invert-paths
```

The nuclear option, if `settings.py` is beyond salvage:

```bash
git filter-repo --path daf_backend/daf_backend/settings.py --invert-paths
```

Verify before pushing:

```bash
# Substitute each real value; both must return nothing.
git log --all -S '<mysql password>'     --oneline
git log --all -S '<gmail app password>' --oneline
```

Then re-add the remote and force-push:

```bash
git remote add origin https://github.com/<org>/<repo>.git
git push --force --mirror origin
```

### Coordination — do not skip this

Rewriting history changes **every commit SHA from the first rewritten commit onward**. Consequences, all of which cause real disruption:

- Every collaborator must **re-clone**. Not pull, not rebase, not `reset --hard` — re-clone. A `git pull` after a force-push merges the old history straight back in, and you will find the secret restored in a merge commit.
- Open pull requests break and must be recreated from fresh branches.
- Tags move. Anything pinned to a SHA — deploy scripts, submodules, CI configs, release notes — breaks.
- **Forks are not rewritten.** If the repo has forks, the secret persists in each one and you cannot rewrite someone else's fork.
- GitHub retains dangling commits reachable by SHA. Open a GitHub Support request to purge them; until they do, anyone with an old SHA can still fetch the blob.

Announcement template:

```
Subject: ACTION REQUIRED — force-push to <repo> at <time Asia/Dhaka>

We are rewriting git history to remove committed credentials.

Before <time>:  push or back up any unpushed work. Note your branch names.
At <time>:      history is rewritten and force-pushed.
After <time>:   DELETE your local clone and re-clone. Do not pull.
                Re-create any open PR from a fresh branch off the new main.

The credentials involved have ALREADY been rotated, so the exposure is closed.
This step removes them from history. Questions to <owner>.
```

Send it, wait for acknowledgements, then push. A force-push to shared history without confirmation from everyone with a clone reliably produces someone re-introducing the old history within a day.

## Pre-commit scanning

Prevention beats remediation. `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.28.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
        args: ['--maxkb=1024']
      - id: check-merge-conflict
      - id: end-of-file-fixer
```

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files      # scan the current tree once
```

`check-added-large-files` is not incidental — it is what stops the next `db.sqlite3`.

A custom gitleaks rule for the exact shape that leaked here. A Google App Password is sixteen lowercase letters in four space-separated groups:

```toml
# .gitleaks.toml
[extend]
useDefault = true

[[rules]]
id = "google-app-password"
description = "Google App Password (four groups of four lowercase letters)"
regex = '''\b[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}\b'''
tags = ["gmail", "smtp", "S3"]

[[rules]]
id = "django-db-password-literal"
description = "Literal PASSWORD in a Django DATABASES block"
regex = '''['"]PASSWORD['"]\s*:\s*['"][^'"]{4,}['"]'''
path = '''settings.*\.py'''
tags = ["django", "S3"]
```

The first rule will occasionally match four short English words in prose. That is the correct trade — a false positive costs one `# gitleaks:allow` comment; a false negative costs a rotation weekend.

CI, scanning the whole tree rather than just the diff:

```yaml
- name: Scan for secrets
  run: |
    docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest \
      detect --source /repo --no-git -v --exit-code 1
```

`--no-git` scans working-tree files including untracked ones, catching a secret staged but not yet committed. Run `gitleaks detect --source /repo -v` too (without `--no-git`) to scan history — useful as a standing check that a scrub has not regressed.

`detect-secrets` is the alternative if you prefer a baseline workflow: `detect-secrets scan > .secrets.baseline`, commit the baseline, and the hook fails only on findings not already in it. Better for a repo with many pre-existing false positives; worse in that an accepted baseline entry is easy to forget about.

## Never log a secret

Rules, in order of how often they are violated:

1. **Never log a secret value.** Not at DEBUG, not "temporarily", not in a branch you intend to delete.
2. **Never interpolate a secret into an exception message or a DRF error response.** `raise ImproperlyConfigured(f'Bad DB password: {password}')` puts it in the traceback, in `stderr.log`, and — with `DEBUG = True` — on the 500 page of whoever triggered it.
3. **Never `print()` a settings value** to check a deploy. `stderr.log` is forever, and it was tracked in git here.
4. **Reference secrets by key name, never by value.** `'EMAIL_HOST_PASSWORD is not set'`, never the value.
5. **Scrub `Authorization` and `Cookie` headers** from any error reporter before it leaves your server.
6. **`DEBUG = True` in production is a secrets leak,** not just an information leak. Django's technical 500 page renders the whole settings dict. With the S3 literals in `settings.py`, one uncaught exception publishes the MySQL and Gmail passwords to whoever caused it. This is the direct link between S4 and S3.

Django masks settings whose *name* matches `API`, `TOKEN`, `KEY`, `SECRET`, `PASS` or `SIGNATURE` in tracebacks, via `SafeExceptionReporterFilter.HIDDEN_SETTINGS`. Two limits: it applies to **settings**, not to local variables in a frame, and it matches on name — a secret in a setting called `MERCHANT_CREDENTIAL` is displayed in full. For local variables you must opt in per function:

```python
from django.views.decorators.debug import sensitive_variables, sensitive_post_parameters


@sensitive_variables('password', 'otp', 'token')
def verify_otp(email, otp):
    ...


@sensitive_post_parameters('password', 'otp')
def login_view(request):
    ...
```

A logging filter that redacts, wired into the config from `assets/settings_security.py`:

```python
import logging
import re

REDACTION_PATTERNS = [
    re.compile(r'(?i)(password|passwd|secret|token|api[_-]?key|authorization|otp)'
               r'(["\']?\s*[:=]\s*["\']?)([^"\'\s,}]+)'),
    re.compile(r'(?i)(Bearer\s+)([A-Za-z0-9._\-]+)'),
]


class RedactSecretsFilter(logging.Filter):
    """Redact credential-shaped substrings from log records.

    A backstop, not a licence. The control is not logging the value at all;
    this exists to catch the case someone missed.
    """

    def filter(self, record):
        try:
            message = record.getMessage()
        except Exception:
            return True
        redacted = message
        for pattern in REDACTION_PATTERNS:
            redacted = pattern.sub(lambda m: f'{m.group(1)}{m.group(2)}***REDACTED***'
                                   if m.lastindex == 3 else f'{m.group(1)}***REDACTED***',
                                   redacted)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'redact_secrets': {'()': 'daf_backend.logging_filters.RedactSecretsFilter'},
    },
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {name} {process:d} {message}', 'style': '{'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['redact_secrets'],
        },
    },
    'loggers': {
        'django.security': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'security.audit': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}
```

Never log request bodies wholesale. `/auth/login/` bodies contain passwords and `/auth/verify-otp/` bodies contain OTP codes — logging "the request for debugging" writes both to disk in cleartext.

## Incident response

| # | Step | Action | Done when |
| --- | --- | --- | --- |
| 1 | Scope | List every credential in the exposed file or commit. Use `.env.example` as the checklist | Every key is on the list with an owner |
| 2 | Rotate | Work the runbooks above, highest blast radius first (DB, then mail, then integrations) | Old credential is confirmed rejected by the provider |
| 3 | Deploy | New values in `.env` on the server; restart (`touch tmp/restart.txt`) | App healthy from a **fresh** process |
| 4 | Assess | MySQL slow/general log, Gmail Recent activity and forwarding rules, provider audit logs, Django `stderr.log` | You can state whether the credential was used, and by whom |
| 5 | Contain | Remove attacker persistence: mail forwarding rules, extra DB grants, unexpected `is_staff` users, unknown API keys | `SELECT id, email, is_staff, is_superuser, role FROM api_customuser WHERE is_staff = 1;` matches the known-staff list |
| 6 | Scrub | git-filter-repo, verify with `git log -S`, coordinate the force-push | `git log --all -S '<secret>'` is empty on origin |
| 7 | Purge | GitHub Support request for dangling commits; notify fork owners | Support confirms |
| 8 | Prevent | `.gitignore` updated, `.env.example` complete, pre-commit installed, CI scan green | `pre-commit run --all-files` passes |
| 9 | Notify | If customer data was reachable (the MySQL case), decide on disclosure | Decision recorded with a date and a named owner |
| 10 | Verify | `../checklists/pre-deploy-security.md` end to end | Every box ticked |

Step 5 is the one teams skip and the one that matters most. Rotating a credential an attacker already used does not remove what they left behind.

## Related

- `references/03-settings-hardening.md` — `DEBUG` (S4) and the full production settings block
- `references/07-threat-model.md` — the secrets-and-config section of the pre-ship review
- `checklists/pre-deploy-security.md` — the verifiable gate
- `assets/settings_security.py` — the hardening constants, including the `LOGGING` config
