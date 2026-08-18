# File uploads

This file owns every byte a user can put on your server or your CDN: what is accepted, what it is renamed to, and where it is served from.

## The finding

**N5**: every `ImageField` in this project accepts uploads with no content-type check, no size limit, no extension allowlist and no path-traversal guard.

The surface:

```python
# product/models.py
class ProductImage(models.Model):
    image = models.ImageField(upload_to='product_images/')

# category/models.py
class Category(models.Model):
    image = models.ImageField(upload_to='category_images/', blank=True, null=True)

# brand/models.py
class Brand(models.Model):
    image = models.ImageField(upload_to='brand_images/', blank=True, null=True)

# api/models.py
class CustomUser(AbstractUser):
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
```

### What ImageField does and does not guarantee

`ImageField` runs `Image.open()` on validation and rejects the file if Pillow cannot parse it. That stops the crudest attack — uploading a `.php` file with no image content — and it is why people assume they are covered. They are not.

| `ImageField` does | `ImageField` does NOT |
| --- | --- |
| Confirm Pillow can open the file | Bound the file size |
| Set `width`/`height` if you declare those fields | Check the extension against an allowlist |
| Run `get_valid_filename()` on the name | Stop a polyglot (a valid GIF that is also valid PHP) |
| | Strip EXIF, including GPS coordinates |
| | Stop a decompression bomb |
| | Reject SVG if you route it through a `FileField` |
| | Prevent overwriting an existing file by name collision |

And the guarantee vanishes entirely the moment someone uses `FileField` for a document, or writes `.objects.create()` instead of going through a serializer — model validators run on `full_clean()`, which `create()` does not call.

`CustomUser.profile_picture` is the highest-risk field of the four, because it is writable by any registered customer while the other three are staff-only behind `IsAdminOrReadOnly`. Rank your effort accordingly.

## Threats

| Threat | Mechanism | Outcome |
| --- | --- | --- |
| Web shell | Upload `shell.php`, request it under `/media/` | Remote code execution as the web user |
| Stored XSS | Upload an SVG or HTML file, served inline same-origin | Script runs in your origin; reads the JWT out of `localStorage`; full account takeover |
| Path traversal | Filename `../../../daf_backend/settings.py` | Overwrite application code or config |
| Decompression bomb | 40,000 x 40,000 PNG that compresses to 200 KB | Pillow allocates gigabytes; worker OOMs |
| EXIF leak | Customer photo with GPS tags, served publicly | Customer's home coordinates published |
| Polyglot | Valid GIF header, PHP payload appended | Passes `Image.open()`, still executes |
| Content-type confusion | `Content-Type: image/jpeg` on a `.html` file | Browser sniffs and renders as HTML |
| SSRF | Remote-fetch-by-URL feature | Server reads cloud metadata or internal services |
| Disk exhaustion | Loop uploading 5 MB files | Host fills; MySQL stops accepting writes |

The stored-XSS row deserves emphasis in this project specifically. `REST_AUTH = {'JWT_AUTH_HTTPONLY': False}` puts the JWT in `localStorage`, so any script executing on your origin can read it and impersonate the user. Media served same-origin is therefore not a minor issue — it is the shortest path to account takeover.

## Rule 1: allowlist, never denylist

WRONG:

```python
BLOCKED_EXTENSIONS = {'.php', '.exe', '.sh', '.py'}

def validate_upload(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise ValidationError('That file type is not allowed.')
```

Every one of these gets through: `.PhP` (the `.lower()` helps, but `.pHp5` is not on the list), `.phtml`, `.php7`, `.phar`, `.inc`, `.cgi`, `.pl`, `.jsp`, `.asp`, `.htaccess` (which reconfigures Apache to execute *any* extension you like), `shell.jpg.php`, `shell.php.` with a trailing dot, `shell.php%00.jpg`, and `.svg`.

The deeper problem is not that the list is incomplete. It is that you cannot enumerate what the *next* web server, the next PHP version, or the next misconfigured `AddHandler` directive will execute. A denylist is a list of the attacks you thought of; an allowlist is a list of what you support.

RIGHT — from `assets/validators.py`:

```python
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}
ALLOWED_DOCUMENT_EXTENSIONS = {'.pdf', '.csv', '.xlsx', '.xls'}
```

`.svg`, `.html`, `.htm`, `.php` and friends are absent on purpose, not by oversight.

## Rule 2: verify contents, not claims

`request.FILES['image'].content_type` comes from the `Content-Type` header inside the multipart body. **The client writes it.** An attacker uploading `shell.php` sets `Content-Type: image/jpeg` for free — it is one line in curl:

```bash
curl -X POST https://api.delhialuminium.com/product-images/ \
  -H "Authorization: Bearer $TOKEN" \
  -F 'image=@shell.php;type=image/jpeg;filename=cute-cat.jpg'
```

Extension, filename and content-type are all attacker-controlled and all agree with each other. Only the bytes are evidence.

`validate_image_file` checks all four layers — extension, content-type, magic bytes, Pillow decode, size. The magic-byte check is the one that catches the rename:

```python
IMAGE_MAGIC_PREFIXES = (
    b'\xff\xd8\xff',                    # JPEG
    b'\x89PNG\r\n\x1a\n',               # PNG
    b'GIF87a',
    b'GIF89a',
    b'RIFF',                            # WebP (RIFF....WEBP)
)
```

Two Pillow gotchas that produce maddening bugs if you hand-roll this:

**`verify()` invalidates the file object.** After `Image.open(f).verify()`, that `Image` is unusable and the file pointer has moved. You must reopen before doing anything else. If you forget to restore the pointer, the subsequent `save()` writes a **zero-byte file** — the upload "succeeds" and the image is blank. `assets/validators.py` handles this by recording `f.tell()` and restoring it in a `finally` block.

**`verify()` does not catch a polyglot.** It confirms the file *starts* as a valid image. A file that is a valid GIF for its first 800 bytes and a PHP script after that passes every check on this page. Only re-encoding kills it.

Decompression bombs need an explicit guard, because Pillow's default is a *warning*:

```python
import warnings
from PIL import Image

# Pillow warns above ~89 million pixels and raises only above 2x that.
# A warning is not a control — promote it.
warnings.simplefilter('error', Image.DecompressionBombWarning)
Image.MAX_IMAGE_PIXELS = 50_000_000        # ~7000x7000, well above any product photo
```

Set this once at app startup, in the `AppConfig.ready()` of the app that handles uploads. A 200 KB PNG declaring 40,000 x 40,000 pixels expands to roughly 6.4 GB in memory; the worker dies before any of your validation runs, because the allocation happens inside the decoder.

## Rule 3: re-encode

The strongest control available. Decode to a bitmap, throw away the original, re-encode to a canonical format. The output contains only the pixels the decoder actually read, which means:

- EXIF gone, including GPS
- ICC profiles and embedded thumbnails gone
- any data appended after the image trailer gone
- any polyglot second format gone
- the file is now definitively the format you claim

`assets/validators.py` provides `strip_image_metadata`. Call it from the serializer, not from a validator — validators must not mutate their input.

```python
from io import BytesIO
import uuid

from django.core.files.base import ContentFile
from PIL import Image, ImageOps


def reencode_image(uploaded_file, fmt='WEBP', quality=85, max_edge=2400):
    """Decode and re-encode, discarding everything that is not a pixel."""
    uploaded_file.seek(0)
    img = Image.open(uploaded_file)

    # Apply the EXIF orientation tag to the pixels BEFORE stripping metadata.
    # Skip this and every photo taken in portrait on a phone arrives sideways,
    # because the rotation lived in the EXIF you are about to discard.
    img = ImageOps.exif_transpose(img)

    if fmt.upper() == 'WEBP':
        img = img.convert('RGBA')
    else:
        if img.mode in ('RGBA', 'LA', 'P'):
            # Flatten transparency onto white; JPEG has no alpha channel and
            # converting straight to RGB turns transparent pixels black.
            background = Image.new('RGB', img.size, (255, 255, 255))
            img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1])
            img = background
        else:
            img = img.convert('RGB')

    if max_edge and max(img.size) > max_edge:
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)

    buf = BytesIO()
    save_kwargs = {'quality': quality, 'optimize': True}
    if fmt.upper() == 'WEBP':
        save_kwargs = {'quality': quality, 'method': 6}
    img.save(buf, format=fmt.upper(), **save_kwargs)
    buf.seek(0)
    return ContentFile(buf.read(), name=f'{uuid.uuid4().hex}.{fmt.lower()}')
```

The EXIF/GPS point is not theoretical and not merely a compliance box. A `CustomUser.profile_picture` taken on a phone with location services on carries the coordinates of wherever it was taken — usually home. Serving that publicly at a guessable URL publishes a customer's home address alongside their name and phone number, which are already in `Order`. For a consumer marketplace this is a physical-safety issue, and re-encoding removes it in one line.

## Rule 4: never trust the client filename

The filename is a string in the request body. It has never been near a filesystem.

| Sent as | Intent |
| --- | --- |
| `../../../daf_backend/settings.py` | Overwrite application config |
| `..\..\web.config` | Same, Windows/IIS path separators |
| `image.jpg\x00.php` | Null-byte truncation in a C-level path handler |
| `AAAA...` (4000 chars) | Filesystem or database column overflow |
| `photo‮gnp.php` | Right-to-left override renders as `photo.php` reversed — looks like `.png` in a UI |
| `logo.png` (again) | Collide with and replace an existing brand logo |
| `.htaccess` | Reconfigure Apache to execute the directory |

Django's `FileSystemStorage` does defend against traversal in current versions, and `get_valid_filename()` strips a lot. Do not rely on it as the last line — you also have Cloudinary in this stack, and a third-party storage backend has its own normalisation rules that you do not control.

Generate the name yourself:

```python
from django.db import models
from common.validators import safe_upload_to, validate_image_file

class ProductImage(models.Model):
    image = models.ImageField(
        upload_to=safe_upload_to('product_images'),
        validators=[validate_image_file],
    )
    # -> product_images/2026/08/3f9c1e70a1b34f0e9c2d8e5b7a4f1c93.webp
```

`safe_upload_to` discards the client's stem entirely, keeps only an extension that is on the allowlist (and empty otherwise), appends a UUID4, and date-partitions the path so no single directory accumulates millions of entries. UUID names also stop enumeration: a customer's profile picture is not at a guessable URL.

If you need the original name for display, keep it in a separate, escaped `CharField`. Never use it as a path.

```python
class ProductImage(models.Model):
    image = models.ImageField(upload_to=safe_upload_to('product_images'),
                              validators=[validate_image_file])
    original_filename = models.CharField(max_length=255, blank=True, default='')
```

Use `safe_upload_to('product_images', keep_stem=True)` if you want human-readable filenames — the slugified stem is capped at 40 chars and the UUID is always present, so it can neither collide nor traverse.

## Rule 5: limit size at every layer

| Field | Limit | Enforced by |
| --- | --- | --- |
| `ProductImage.image` | 5 MB | `MaxFileSizeValidator(5)` via `validate_image_file` |
| `Category.image`, `Brand.image` | 5 MB | same |
| `CustomUser.profile_picture` | 2 MB | `MaxFileSizeValidator(2)` |
| Whole request body | 5 MB in memory | `DATA_UPLOAD_MAX_MEMORY_SIZE` |
| Whole request body | 6 MB hard | nginx `client_max_body_size` |
| Field count | 1000 | `DATA_UPLOAD_MAX_NUMBER_FIELDS` |

```python
from common.validators import MaxFileSizeValidator, safe_upload_to, validate_image_file

class CustomUser(AbstractUser):
    profile_picture = models.ImageField(
        upload_to=safe_upload_to('profile_pics'),
        blank=True,
        null=True,
        validators=[validate_image_file, MaxFileSizeValidator(2)],
    )
```

```nginx
# The only limit that protects bandwidth and disk.
client_max_body_size 6M;
```

The layering matters and the reason is mechanical: **Django's checks run after the body has already been received.** By the time `MaxFileSizeValidator` sees a 2 GB upload, you have already paid for 2 GB of transfer and written it to a temp file. The web-server limit rejects at the edge with a 413 after reading the headers. The app-level limit is for correctness; the nginx limit is for survival.

Keep the nginx number slightly above the Django number, so a legitimate request at the boundary produces a clean DRF validation error rather than an opaque 413.

## Rule 6: serve uploads from somewhere harmless

Two independent requirements.

**`MEDIA_ROOT` must never sit inside a directory the web server will execute.** The current configuration is exactly the risky arrangement:

```python
MEDIA_ROOT = BASE_DIR / 'media'      # right next to the application code
```

On cPanel with Passenger, `BASE_DIR` is inside the served application directory. If a single file with an executable extension lands there and the handler is configured for it, it runs. Move `MEDIA_ROOT` outside the application tree, or move media to Cloudinary and stop serving user files from your host at all.

Also note this line in `daf_backend/urls.py`:

```python
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

`django.conf.urls.static.static()` is a no-op when `DEBUG = False`, so with S4 fixed this stops serving anything and media must be served by nginx or Cloudinary. That is the correct outcome — but if someone "fixes" the resulting 404s by re-enabling it unconditionally, every uploaded file is then served by Django with no header control at all.

**Serve user content from a different origin.** `media.delhialuminium.com`, or Cloudinary's domain. Same-origin user content means a stored XSS in an uploaded file executes with access to `localStorage` — where this project's JWT lives. A separate origin reduces that from account takeover to a defaced image.

```nginx
server {
    server_name media.delhialuminium.com;
    root /home/asshippi/media;

    location / {
        # No script handlers, ever.
        location ~ \.(php|phtml|php[0-9]|phar|pl|py|cgi|sh|jsp|asp|aspx)$ {
            deny all;
            return 403;
        }

        add_header X-Content-Type-Options nosniff always;
        add_header Content-Security-Policy "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'; sandbox" always;
        add_header Cross-Origin-Resource-Policy same-site always;

        # Anything not an inline-safe image downloads instead of rendering.
        if ($request_filename !~* \.(jpg|jpeg|png|webp|gif|avif)$) {
            add_header Content-Disposition "attachment" always;
        }

        try_files $uri =404;
        expires 30d;
    }
}
```

`Content-Disposition: attachment` turns "browser renders attacker HTML in your origin" into "browser downloads a file". Combined with `nosniff` and a `sandbox` CSP, an SVG or HTML that somehow got through cannot execute.

## Cloudinary

The packages are installed (`cloudinary==1.44.1`, `django-cloudinary-storage==0.3.0`) though not yet in `INSTALLED_APPS`. Moving media to Cloudinary removes the RCE-on-your-own-box class of risk entirely — files never touch your filesystem. It introduces different ones.

```python
INSTALLED_APPS += ['cloudinary', 'cloudinary_storage']

CLOUDINARY_STORAGE = {
    'CLOUD_NAME': env('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': env('CLOUDINARY_API_KEY'),
    'API_SECRET': env('CLOUDINARY_API_SECRET'),
    'SECURE': True,
}
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

What still applies:

- **Validate before upload.** Cloudinary will happily store an SVG, a PDF or a ZIP and serve it from its CDN. `validate_image_file` still runs; keep it on the field.
- **Signed uploads only.** An unsigned upload preset is a public write endpoint — anyone who finds your cloud name can fill your quota, and Cloudinary bills by storage and bandwidth. Set every preset to signed in the console.
- **Never expose `CLOUDINARY_API_SECRET` to the browser.** Vite inlines `VITE_`-prefixed variables into the bundle (`04-secrets.md`). Sign server-side and hand the client a short-lived signature.
- **Pin `resource_type='image'`.** With `resource_type='auto'`, a file that fails image detection is stored as `raw` and served with its original content type — the document path through the image endpoint.
- **Force format at ingest** with an incoming transformation, which re-encodes on Cloudinary's side and strips metadata for you.
- **Delivery URLs are public by default.** Anyone with the URL fetches the asset, and Cloudinary URLs are structurally predictable from the public ID. Use `type='authenticated'` or `type='private'` for anything not meant for the open web — a customer's profile picture, for instance.

A signed-upload endpoint, so the secret stays on the server:

```python
import time

import cloudinary.utils
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class CloudinarySignatureView(APIView):
    """Hand the browser a signature scoped to one upload. Never the secret."""

    permission_classes = [IsAuthenticated]
    throttle_scope = 'upload_signature'

    def post(self, request):
        params = {
            'timestamp': int(time.time()),
            'folder': f'profile_pics/{request.user.pk}',
            'upload_preset': 'daf_signed_profile',
            # Re-encode and strip metadata at ingest, server-chosen so the
            # client cannot ask for something else.
            'transformation': 'c_limit,w_1200,h_1200,q_auto,f_webp',
        }
        signature = cloudinary.utils.api_sign_request(
            params, settings.CLOUDINARY_STORAGE['API_SECRET'],
        )
        return Response({
            **params,
            'signature': signature,
            'api_key': settings.CLOUDINARY_STORAGE['API_KEY'],   # public by design
            'cloud_name': settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
        })
```

The signature covers the parameters, so the client cannot alter the folder or the transformation without invalidating it. `api_key` is public; `api_secret` never leaves the server.

## SVG

**Do not accept SVG on any field in this project.**

SVG is XML, not a raster image. It can contain `<script>`, `onload=` handlers, `<foreignObject>` holding arbitrary HTML, `<use href="...">` referencing external documents, and XML external entity declarations that read local files. When served inline, it is stored XSS wearing an image's file extension. Pillow will not save you: it does not open SVG at all, so a `FileField` accepting one skips every check on this page.

If a brand logo genuinely requires SVG:

1. Staff-only upload (`IsAdminOrReadOnly` already covers `Brand`).
2. Sanitize server-side with a real XML sanitizer, stripping script elements, all `on*` attributes, `<foreignObject>`, external references and DTDs. Disable entity resolution in the parser.
3. Serve from the media domain with `Content-Disposition: attachment`, or
4. Better: rasterize to PNG at ingest and store the raster. The vector never reaches a browser.

Option 4 is the one to take. The others are a standing commitment to keeping an XML sanitizer correct.

## Invoice PDFs and xhtml2pdf

This project renders invoices with `xhtml2pdf` and emails them (`orders/utils.py`, `send_invoice_email_task`; `inventory/utils.py`, `render_to_pdf`). It is an upload-shaped risk even though nobody uploads anything.

**Rendering user-controlled HTML through a PDF engine is an SSRF and local-file-read primitive.** xhtml2pdf resolves `<img src>` and CSS `url()` references through a `link_callback`. If that callback resolves whatever it is given, then a payload placed in any field that reaches the template is fetched **by your server**, with your server's network position, and the result is embedded in a PDF that is then emailed out.

The order fields that flow into the invoice are all attacker-controlled: `customer_name`, `street_address`, `city`, `customer_email`, `contact_number`, `bkash_number`, `transaction_id`. And `place_order` is `AllowAny`, so no account is needed.

Payloads:

```html
<img src="file:///home/asshippi/daf_backend/daf_backend/settings.py">
<img src="file:///etc/passwd">
<img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">
<img src="http://127.0.0.1:3306/">
```

The first is the direct link to S3 — it renders your database and email credentials into a PDF and mails it to an address the attacker chose.

The fixes, all three together:

**Autoescape.** Django templates escape by default. Never mark these fields `|safe`, and never build the invoice HTML by string concatenation or f-string.

WRONG:

```python
html = f"<h2>Invoice for {order.customer_name}</h2><p>{order.street_address}</p>"
pisa.CreatePDF(html, dest=buf)
```

RIGHT:

```python
from django.template.loader import render_to_string

html = render_to_string('orders/invoice.html', {'order': order, 'items': order.items.all()})
```

**A restrictive `link_callback`.** This is the load-bearing control:

```python
import os
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from xhtml2pdf import pisa


def safe_link_callback(uri, rel):
    """Resolve ONLY local static assets. Refuse every remote and file scheme.

    xhtml2pdf hands this every <img src> and CSS url() in the document. If it
    resolves an arbitrary URI, any attacker-controlled field in the invoice
    becomes a server-side fetch: file:// reads local files, http:// reaches
    internal services and cloud metadata endpoints.
    """
    if uri.startswith(('http://', 'https://', 'file://', 'ftp://', 'data:', '//')):
        return ''

    if uri.startswith(settings.STATIC_URL):
        path = os.path.join(settings.STATIC_ROOT, uri.replace(settings.STATIC_URL, '', 1))
    else:
        return ''

    # Containment check after normalisation — '../' in the URI cannot escape.
    root = os.path.realpath(settings.STATIC_ROOT)
    resolved = os.path.realpath(path)
    if not resolved.startswith(root + os.sep):
        return ''
    if not os.path.isfile(resolved):
        return ''
    return resolved


def render_invoice_pdf(order_id):
    """Render from the database, never from request data."""
    from orders.models import Order

    order = (
        Order.objects
        .prefetch_related('items__product', 'items__attribute')
        .get(pk=order_id)
    )
    html = render_to_string('orders/invoice.html', {
        'order': order,
        'items': order.items.all(),
        'currency': '৳',
    })
    buf = BytesIO()
    result = pisa.CreatePDF(html, dest=buf, link_callback=safe_link_callback)
    if result.err:
        raise RuntimeError(f'Invoice rendering failed for order {order_id}')
    buf.seek(0)
    return ContentFile(buf.read(), name=f'invoice-{order.id}.pdf')
```

Note the containment check uses `os.path.realpath` on both sides and compares with a trailing separator. Comparing with `startswith(root)` alone is bypassable by a sibling directory named `staticfiles-evil`.

**Render from server-side data.** `render_invoice_pdf` takes an `order_id` and re-fetches from the database. Nothing from `request.data` reaches the template. Amounts shown on the invoice are the stored `OrderItem.price` and `Order.total_amount` — which, per `06-server-authority.md`, the server computed. An invoice built from request data can be made to say ৳1 while the order says ৳45,000.

## Wiring it up

```python
# product/models.py
from django.db import models
from common.validators import safe_upload_to, validate_image_file


class ProductImage(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(
        upload_to=safe_upload_to('product_images'),
        validators=[validate_image_file],
    )
    original_filename = models.CharField(max_length=255, blank=True, default='')
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    is_main = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-is_main', 'position', 'id']
```

Changing `upload_to` generates a migration. It only affects *new* uploads; existing rows keep their stored paths.

The serializer, where re-encoding happens:

```python
from rest_framework import serializers

from common.validators import validate_image_file
from .models import ProductImage
from .utils import reencode_image


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'product', 'image', 'alt_text', 'is_main', 'position']

    def validate_image(self, value):
        # Validators on the model field run on full_clean(); running it here too
        # means a raw .objects.create() elsewhere is not the only line of defence.
        validate_image_file(value)
        return value

    def create(self, validated_data):
        upload = validated_data.get('image')
        if upload is not None:
            validated_data['original_filename'] = (upload.name or '')[:255]
            validated_data['image'] = reencode_image(upload)
        return super().create(validated_data)
```

The React uploader:

```jsx
import { useState } from 'react';
import api from '../js/api';

// Client-side checks are UX ONLY. They give instant feedback and save a
// pointless round trip. They are not a security control — anyone can POST
// directly with curl. The server checks are the control.
const MAX_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProductImageUploader({ productId, onUploaded }) {
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    if (!ACCEPTED.includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
      return;
    }

    const body = new FormData();
    body.append('product', productId);
    body.append('image', file);

    setBusy(true);
    setProgress(0);
    try {
      const { data } = await api.post('/product-images/', body, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      onUploaded?.(data);
    } catch (err) {
      if (err.response?.status === 413) {
        setError('That file is too large for the server to accept.');
      } else if (err.response?.status === 400) {
        const detail = err.response.data?.image?.[0];
        setError(detail || 'That file was rejected. Please choose a different image.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to upload product images.');
      } else {
        setError('Upload failed. Please try again.');
      }
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={busy}
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white"
      />
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
```

Note `accept="image/jpeg,image/png,image/webp"` filters the OS file picker. It is a convenience — the picker's "All files" option defeats it, and curl ignores it entirely.

## Testing

Every one of these must be rejected. This is the N5 regression suite.

```python
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from django.contrib.auth import get_user_model

User = get_user_model()

GIF_HEADER = b'GIF89a' + b'\x00' * 32


def real_png(size=(64, 64)):
    buf = io.BytesIO()
    Image.new('RGB', size, (200, 30, 30)).save(buf, format='PNG')
    buf.seek(0)
    return buf.read()


class UploadValidationTests(APITestCase):
    """Regression tests for N5."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='boss', email='boss@example.com', password='pw-not-a-secret-123',
        )
        self.client.force_authenticate(self.admin)
        self.url = reverse('productimage-list')

    def post(self, upload):
        return self.client.post(self.url, {'image': upload}, format='multipart')

    def test_rejects_php_renamed_to_jpg(self):
        payload = SimpleUploadedFile(
            'cute-cat.jpg', b'<?php system($_GET["c"]); ?>', content_type='image/jpeg',
        )
        self.assertEqual(self.post(payload).status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_polyglot_gif_with_appended_php(self):
        payload = SimpleUploadedFile(
            'ok.gif', GIF_HEADER + b'<?php system($_GET["c"]); ?>', content_type='image/gif',
        )
        # Magic bytes pass; the decode check is what must catch this.
        self.assertEqual(self.post(payload).status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_oversized_file(self):
        payload = SimpleUploadedFile(
            'huge.png', real_png() + b'\x00' * (6 * 1024 * 1024), content_type='image/png',
        )
        self.assertEqual(self.post(payload).status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_svg(self):
        payload = SimpleUploadedFile(
            'logo.svg',
            b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
            content_type='image/svg+xml',
        )
        self.assertEqual(self.post(payload).status_code, status.HTTP_400_BAD_REQUEST)

    def test_traversal_filename_is_discarded_not_honoured(self):
        payload = SimpleUploadedFile('../../evil.png', real_png(), content_type='image/png')
        response = self.post(payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        stored = response.data['image']
        self.assertNotIn('..', stored)
        self.assertNotIn('evil', stored)

    def test_accepts_a_real_png(self):
        payload = SimpleUploadedFile('product.png', real_png(), content_type='image/png')
        self.assertEqual(self.post(payload).status_code, status.HTTP_201_CREATED)


class InvoiceRenderingTests(APITestCase):
    """The xhtml2pdf link_callback must refuse file:// and http://."""

    def test_link_callback_refuses_local_file_scheme(self):
        from orders.utils import safe_link_callback
        self.assertEqual(safe_link_callback('file:///etc/passwd', None), '')
        self.assertEqual(safe_link_callback('http://169.254.169.254/', None), '')
        self.assertEqual(safe_link_callback('/static/../../settings.py', None), '')
```

The traversal test asserts on *behaviour*, not rejection: the upload succeeds and the stored path simply does not contain anything the attacker sent. That is what `safe_upload_to` guarantees, and asserting it this way survives a change in how the filename is sanitized.

## Checklist

- [ ] Every `ImageField`/`FileField` has `validators=[validate_image_file]` or `[validate_document_file]`.
- [ ] Every `upload_to` is a `safe_upload_to(...)` call, not a string literal.
- [ ] `Image.MAX_IMAGE_PIXELS` is set and `DecompressionBombWarning` is promoted to an error.
- [ ] Images are re-encoded on save; EXIF is not stored.
- [ ] `DATA_UPLOAD_MAX_MEMORY_SIZE` in Django **and** `client_max_body_size` in nginx.
- [ ] `MEDIA_ROOT` is outside any executable directory, or media is on Cloudinary.
- [ ] Media is served from a separate origin, or with `nosniff` + `Content-Disposition: attachment` for non-images.
- [ ] No Cloudinary unsigned upload preset exists; `CLOUDINARY_API_SECRET` is not in any `VITE_` variable.
- [ ] SVG is rejected everywhere.
- [ ] `pisa.CreatePDF` is always called with `link_callback=safe_link_callback`.
- [ ] Invoices render from a database re-fetch, never from `request.data`.
- [ ] The N5 test suite above passes.

## Related

- `references/01-permissions.md` — who may upload at all
- `references/03-settings-hardening.md` — the size and nosniff settings
- `references/04-secrets.md` — why Cloudinary secrets cannot go in the Vite bundle
- `references/06-server-authority.md` — why the invoice renders from stored data
- `checklists/pre-deploy-security.md` — the verifiable gate
