# Static and media

Two different problems that get conflated. **Static** files ship with the code
and are known at build time. **Media** is user-uploaded, arrives at runtime, and
is not in git.

| | Static | Media |
|---|---|---|
| Origin | Your repo | Users |
| Known at deploy | Yes | No |
| In git | Yes | Never |
| Backed up | Not needed — it is in git | **Yes**, separately |
| Served by | WhiteNoise or nginx | Cloudinary, or nginx |
| Cache | 1 year, immutable, hashed names | 30 days |

Conflating them produces the two classic outages: a deploy that wipes user
uploads, and a backup that restores a database referencing files that no longer
exist.

## Static

```python
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'    # collectstatic writes here
STATICFILES_DIRS = [BASE_DIR / 'static']  # your source files

STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
```

`CompressedManifestStaticFilesStorage` does two things: gzip/brotli-compresses
each file at collect time, and appends a content hash to the filename so it can
be cached for a year and still update instantly on change.

WhiteNoise, so Django can serve static files without nginx in front:

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # immediately after security
    ...
]
```

Order matters — WhiteNoise must be second so a static request short-circuits
before session, auth and CSRF middleware run on it.

**`collectstatic` runs on every deploy**, after `migrate`, before the restart.
`--noinput` or it hangs waiting for a prompt nobody sees.

Two failures worth naming:

- **`Missing staticfiles manifest entry for 'x.png'`** — a template references
  a file that was not collected. With the manifest storage this is a hard 500,
  not a broken image. It is a correct error: it means the file is genuinely
  absent in production.
- **`DEBUG = True` serves static files for you.** So does `runserver`. Neither
  does in production, which is why "the CSS is missing" appears only after the
  first real deploy. Test with `DEBUG=False` locally before shipping.

## Media

This project uses **Cloudinary**, which is the right choice on cPanel: a local
`/media/` directory on shared hosting is not backed up with the database, does
not survive a rebuild, and cannot be shared between two app instances.

```python
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': env('CLOUDINARY_CLOUD_NAME'),
    'API_KEY':    env('CLOUDINARY_API_KEY'),
    'API_SECRET': env('CLOUDINARY_API_SECRET'),
}
STORAGES = {
    'default': {'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
```

Rules:

- **Uploads are signed server-side.** The API secret never reaches the browser.
  An unsigned upload preset lets anyone upload anything to your account, at your
  cost — `security-hardening/05-uploads.md` owns validation.
- **Never render a raw Cloudinary URL.** Without transformations it serves the
  original — the 6.6 MB PNG problem (**P3**) moved to a CDN. Always
  `f_auto,q_auto,w_<n>`, through one helper.
- **The database is the index of the media.** A database restore without the
  corresponding media leaves every `ImageField` pointing at nothing. Note the
  Cloudinary state alongside each backup.

If media is local instead (VPS), it lives **outside** the deploy directory —
`/srv/media/`, not `/srv/daf/media/` — so a deploy that recreates the app
directory cannot delete it. Serve via nginx `alias`, never through Django.

## CORS and CSRF hosts

The most common local/production difference after `DEBUG`, and the one that
produces the least helpful error.

```python
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')
CORS_ALLOW_CREDENTIALS = True     # required if refresh lives in an httpOnly cookie
```

- Both need the **scheme**: `https://www.example.com`, not `www.example.com`.
- `www` and apex are **different origins**. List both, or redirect one to the
  other at the web-server level.
- `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOW_CREDENTIALS = True` is
  rejected by browsers and is a security hole regardless. Never in production.
- Vite's dev server is `http://localhost:5173`; add it to the dev `.env` only.

Symptom: a request works in curl and fails in the browser with a CORS message.
Cause is almost always a missing scheme or a `www` mismatch.

## The frontend build

```bash
cd "daf front/daf frontend"
npm ci                      # ci, not install — respects the lockfile exactly
npm run build               # dist/
bash scripts/check_budget.sh
```

`npm ci` in CI and on deploy. `npm install` can silently resolve a different
version than the lockfile pins, which is how a build that passed locally fails
in production.

`VITE_API_URL` is baked in **at build time**. Changing it later requires a
rebuild — there is no runtime config in a Vite bundle. A deploy that copies an
old `dist/` after changing the API host will point at the old host with no
error.

```bash
# Confirm what got baked in.
grep -o "https://[a-z.]*" dist/assets/index-*.js | sort -u
```

Serving `dist/`: any static host. The one requirement is a **SPA fallback** —
every unmatched path rewrites to `index.html`, or a refresh on `/admin/products`
is a 404.

```nginx
location / {
    root /srv/daf/frontend/dist;
    try_files $uri $uri/ /index.html;
}
```

cPanel equivalent, in `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Cache `index.html` for **zero seconds** and the hashed assets for a year. The
reverse — a cached `index.html` pointing at deleted asset hashes — is a blank
white page for every returning visitor until their cache expires, and it is the
single worst deploy outcome in this list.

```nginx
location = /index.html { add_header Cache-Control "no-cache, must-revalidate"; }
location /assets/      { expires 1y; add_header Cache-Control "public, immutable"; }
```

## Verification

```bash
# 1. Static files are served and hashed.
curl -sI https://api.example.com/static/admin/css/base.css | head -1
# PASS: 200

# 2. Static is cached long.
curl -sI https://api.example.com/static/... | grep -i cache-control
# PASS: max-age=31536000, immutable

# 3. index.html is NOT cached.
curl -sI https://www.example.com/ | grep -i cache-control
# PASS: no-cache

# 4. SPA fallback works.
curl -s -o /dev/null -w '%{http_code}\n' https://www.example.com/admin/products
# PASS: 200

# 5. The bundle points at the right API.
grep -o "https://[a-z.]*" dist/assets/index-*.js | sort -u
# PASS: the production API host only

# 6. No secret in the bundle.
grep -rnE "SECRET|APP_SECRET|PASSWORD|API_KEY" dist/assets/*.js
# PASS: no output

# 7. Media is transformed, not raw.
grep -rn "res.cloudinary.com" src/ | grep -v "f_auto"
# PASS: no output

# 8. CORS from the real origin.
curl -sI -H "Origin: https://www.example.com" https://api.example.com/api/products/ \
  | grep -i access-control-allow-origin
# PASS: the origin echoed back
```
