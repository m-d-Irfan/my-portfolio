# Project layout

Where files go, and why the boundaries fall where they do.

```text
backend_root/
├── .env                       # never tracked
├── .env.example               # tracked. the contract
├── .gitignore
├── manage.py
├── requirements.txt
├── passenger_wsgi.py          # cPanel only
├── project_core/
│   ├── settings.py
│   ├── settings_security.py   # from the security-hardening skill
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── common/                    # cross-app utilities, no models of its own
│   ├── models.py              # abstract bases (data-layer skill)
│   ├── validators.py          # upload validators (security-hardening skill)
│   └── pagination.py
├── api/                       # auth, users, permissions
│   ├── models.py              # CustomUser
│   ├── permissions.py         # from the security-hardening skill
│   ├── otp.py                 # from the auth-flows skill
│   ├── views_me.py            # from the auth-flows skill
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── core_domain/               # the business domain
└── transactions/              # orders, payments, ledger
```

## App boundaries

Split an app out when it owns **models that other apps reference but do not
own**. Not by layer, not by feature, and not because a file got long.

The project this skill is derived from has: `api` (identity), `category`,
`brand`, `product`, `inventory`, `orders`. That is a good split — each owns a
table cluster with a clear boundary. `category` and `brand` are separate from
`product` because both are referenced by things outside the catalog (reports,
navigation, inventory) and have independent lifecycles.

Signs the split is wrong:

- Two apps import each other's models. Circular ownership; merge them, or extract
  the shared model into a third.
- An app has no models. It is a module, not an app. Put it in `common/`.
- A model is referenced by string (`"category.Category"`) in three apps and by
  import in a fourth. Pick one — always use the string form for cross-app FKs,
  which avoids import cycles at load time.

## `common/` is not `utils/`

`common/` holds things with a defined contract: abstract model bases, validators,
pagination classes, the error envelope. A `utils.py` that accumulates unrelated
helpers becomes a dependency magnet that every app imports and nobody owns.

## Settings

One `settings.py`, environment-driven. Not `settings/base.py` +
`settings/production.py` + `settings/local.py`.

The split-settings pattern looks tidy and reliably produces a production file
nobody reads and a local file that drifts. A single file where every difference
is an env var means the deployed configuration is the one in front of you. See
[02-settings-assembly.md](./02-settings-assembly.md).

The one exception is `settings_security.py`, which is split for the opposite
reason: it is identical everywhere and should be auditable in isolation.

## `AUTH_USER_MODEL` before the first migration

```python
AUTH_USER_MODEL = "api.CustomUser"
```

Set this before running the first `migrate`. Changing it afterwards means
dropping the database or hand-writing a migration that reassigns every foreign
key to `auth.User`. There is no comfortable path back.

Even if the project has no plans for a custom user model, create one anyway. An
empty `class CustomUser(AbstractUser): pass` costs nothing today and buys the
ability to add a field later.

## Media and static

`MEDIA_ROOT` must not sit inside a directory the web server will execute. On
shared hosting the default `public_html/media/` is exactly that: upload a `.php`
file the validators missed and it runs.

Serve user uploads from a separate domain or a storage service (this project
uses Cloudinary), or from a path the server is configured to serve as static
bytes only. See
[security-hardening/05-uploads.md](../../security-hardening/references/05-uploads.md).

## `.gitignore`

```gitignore
.env
*.sqlite3
media/
staticfiles/
__pycache__/
*.py[cod]
.venv/
venv/
```

`.env` first. Everything else is recoverable.
