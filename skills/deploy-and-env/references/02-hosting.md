# Hosting

Two paths. This project is on cPanel with Passenger; the VPS path is documented
because it is where a growing project goes next, and because the differences
explain several constraints elsewhere in this suite.

## cPanel + Passenger

What you get: a managed Python app, an Apache front end, and a process that
Passenger starts and stops for you.

What you do **not** get, and it shapes the architecture:

- **No long-lived worker process.** Passenger kills idle processes. A Celery
  worker or a `threading.Thread` started in a request does not survive — which
  is exactly why `jobs-and-integrations` uses a cron-drained outbox table
  rather than a queue worker. **C3** is a direct consequence.
- **No systemd, no supervisor.** Cron is the only scheduler.
- **Restart is a file touch**, not a command.
- **Shared MySQL**, often with a remote-access allowlist that someone widened
  once and never narrowed.

### passenger_wsgi.py

Lives at the app root. Passenger imports it and looks for `application`.

```python
import os
import sys

# The app root, one level up from this file if the Django project is nested.
BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'daf_backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'daf_backend.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
```

Three things go wrong here reliably:

1. **The wrong interpreter.** cPanel's "Setup Python App" creates a virtualenv
   and writes a shebang line into `passenger_wsgi.py`. If you overwrite the
   file you lose it, and Passenger falls back to the system Python with none of
   your packages. Keep whatever shebang cPanel generated at the top.
2. **`sys.path` ordering.** If the project directory is not on the path before
   `DJANGO_SETTINGS_MODULE` resolves, you get
   `ModuleNotFoundError: No module named 'daf_backend'` with no other detail.
3. **`.env` not found.** `load_dotenv()` looks in the current working directory,
   which under Passenger is not necessarily the app root. Be explicit:

```python
from dotenv import load_dotenv
load_dotenv(os.path.join(BASE, '.env'))
```

That third one produces the confusing failure mode where every setting is
missing at once on the server and fine locally.

### Restart

```bash
mkdir -p ~/daf_backend/tmp
touch ~/daf_backend/tmp/restart.txt
```

Passenger checks the mtime of `tmp/restart.txt` and recycles workers. It is
graceful — in-flight requests finish.

**Code changes need a restart.** `.env` changes need a restart. A deploy that
does not touch that file is a deploy that did not happen, and it is the most
common "I deployed but nothing changed".

### Logs

```bash
tail -f ~/logs/<domain>.error.log        # Apache / Passenger
tail -f ~/daf_backend/stderr.log         # whatever the app writes
```

Passenger startup errors land in the Apache error log, not the app's. When the
app will not boot at all, that is the file to read.

**`stderr.log` must be gitignored and untracked.** This repository tracked a
1.3 MB one containing Django tracebacks — and with `DEBUG=True`, a traceback
carries local variables, which means request bodies, which means OTP codes and
passwords in cleartext. `security-hardening/04-secrets.md` covers the cleanup.

### Cron

cPanel → Cron Jobs. Absolute paths, always — cron's `PATH` is minimal and does
not include the virtualenv.

```bash
# Drain the email outbox every five minutes.
*/5 * * * * cd /home/user/daf_backend && /home/user/virtualenv/daf_backend/3.11/bin/python manage.py drain_outbox >> /home/user/logs/outbox.log 2>&1

# Nightly database backup, 02:15 Asia/Dhaka.
15 2 * * * /home/user/scripts/backup_db.sh >> /home/user/logs/backup.log 2>&1
```

Redirect both streams to a log. A cron job that fails silently is indistinguishable
from one that never ran, and email delivery stopping is not the kind of thing
you want to discover from a customer.

Confirm the server's timezone before trusting a cron schedule — cPanel usually
runs UTC, so `15 2 * * *` is 08:15 in Dhaka, not 02:15. Related: **C2**.

## VPS: gunicorn + nginx

```ini
# /etc/systemd/system/daf.service
[Unit]
Description=DAF Django
After=network.target

[Service]
User=daf
Group=www-data
WorkingDirectory=/srv/daf/daf_backend
EnvironmentFile=/srv/daf/.env
ExecStart=/srv/daf/venv/bin/gunicorn \
  --workers 3 \
  --bind unix:/run/daf/gunicorn.sock \
  --access-logfile - --error-logfile - \
  --timeout 30 \
  daf_backend.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Workers: `2 × cores + 1` is the usual starting point. Each is a full process
with its own memory and its own `LocMemCache` — which is why throttling needs
Redis (N2).

`--timeout 30` kills a worker stuck past 30s. If order placement can exceed
that, the fix is the outbox, not a longer timeout.

```nginx
server {
    listen 443 ssl http2;
    server_name api.delhialuminium.com;

    ssl_certificate     /etc/letsencrypt/live/api.delhialuminium.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.delhialuminium.com/privkey.pem;

    client_max_body_size 10M;      # must match the upload validators' limit

    gzip on;
    gzip_types application/json application/javascript text/css image/svg+xml;
    gzip_min_length 1024;

    location /static/ { alias /srv/daf/staticfiles/; expires 1y; add_header Cache-Control "public, immutable"; }
    location /media/  { alias /srv/daf/media/;       expires 30d; }

    location / {
        proxy_pass http://unix:/run/daf/gunicorn.sock;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # required for SECURE_PROXY_SSL_HEADER
    }
}
```

Two lines matter more than they look:

- **`X-Forwarded-Proto`** is what `SECURE_PROXY_SSL_HEADER` reads. Without it
  Django thinks every request is HTTP and `SECURE_SSL_REDIRECT` loops forever.
  With it set but *no* proxy in front, a client can claim HTTPS by sending the
  header — which is why `BEHIND_TLS_PROXY` is a separate env var rather than
  always-on.
- **`gzip on`** with `gzip_types` including `application/json`. Uncompressed
  API responses is the most common production misconfiguration and typically
  costs 60–70% of the transfer (`performance-budget/01`).

```bash
systemctl daemon-reload && systemctl restart daf
journalctl -u daf -f
nginx -t && systemctl reload nginx
```

## Both paths

**HTTPS everywhere.** Let's Encrypt via certbot on a VPS, AutoSSL on cPanel.
Confirm auto-renewal actually runs — an expired certificate is a full outage and
the renewal cron is the thing that silently stops.

**Firewall**: 80, 443, and SSH on a non-default port. **MySQL 3306 must not be
reachable from the internet.** On cPanel check Remote MySQL — an entry of `%`
means the leaked S3 password was directly exploitable from anywhere.

```bash
# From another machine. Must NOT connect.
nc -zv api.delhialuminium.com 3306
```

**Time**: `timedatectl set-timezone Asia/Dhaka` on a VPS, or accept UTC and be
explicit about it in cron schedules. Django's `TIME_ZONE = 'Asia/Dhaka'` handles
the application layer (**C2**); the server clock still governs cron and log
timestamps.

**Health check**: `/health/` returning database status, hit by an uptime monitor
every minute. `jobs-and-integrations` owns the endpoint; deploy owns the
monitor pointing at it.

## Verification

```bash
# 1. The app boots.
curl -sf https://api.delhialuminium.com/health/ | python -m json.tool
# PASS: {"status": "ok", "database": "ok"}

# 2. HTTPS is enforced.
curl -sI http://api.delhialuminium.com/ | head -1
# PASS: 301, with a Location on https

# 3. Static files are served.
curl -sI https://api.delhialuminium.com/static/admin/css/base.css | head -1
# PASS: 200

# 4. Responses are compressed.
curl -sI -H 'Accept-Encoding: gzip' https://api.delhialuminium.com/api/products/ | grep -i content-encoding
# PASS: gzip

# 5. MySQL is not exposed.
nc -zv api.delhialuminium.com 3306
# PASS: connection refused or timeout

# 6. DEBUG is off — a 404 shows the plain page, not the URLconf.
curl -s https://api.delhialuminium.com/nonexistent/ | grep -c "URLconf"
# PASS: 0

# 7. The restart mechanism works.
touch ~/daf_backend/tmp/restart.txt && sleep 3 && curl -sf .../health/
# PASS: 200

# 8. Cron jobs are actually running.
tail -20 ~/logs/outbox.log
# PASS: recent timestamps
```

Check 8 is the one nobody runs until email has been silently broken for a week.
