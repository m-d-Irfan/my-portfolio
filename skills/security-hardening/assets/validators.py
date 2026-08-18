"""Upload validators and safe upload paths.

Copy to `common/validators.py`. Attach to every FileField and ImageField:

    from common.validators import validate_image_file, safe_upload_to

    class ProductImage(models.Model):
        image = models.ImageField(
            upload_to=safe_upload_to("products"),
            validators=[validate_image_file],
        )

Background — the gap this file closes (N5): the project had ImageField uploads
with no content-type check, no size limit, no extension allowlist and no
path-traversal guard. Django's ImageField calls Pillow, which stops the crudest
attacks, but it does not bound file size, does not stop a polyglot file, and does
nothing about the filename.

Validators run on `full_clean()`. DRF serializers call it for ModelSerializer
fields, but a raw `.objects.create()` bypasses it — so treat these as one layer,
not the only one, and keep the web-server-level body limit in place too.
"""

import os
import uuid

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.utils.deconstruct import deconstructible
from django.utils.text import slugify

# Allowlist, never a denylist. A denylist is a list of the attacks you thought
# of; an allowlist is a list of what you support. `.php`, `.phtml`, `.phar`,
# `.svg`, `.html` and `.htm` are all absent on purpose — SVG and HTML execute
# script in the browser when served inline.
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
}

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls"}
ALLOWED_DOCUMENT_CONTENT_TYPES = {
    "application/pdf",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# Magic bytes. Content-Type comes from the client and is a hint, not evidence.
# An attacker uploading shell.php sets Content-Type: image/jpeg for free.
IMAGE_MAGIC_PREFIXES = (
    b"\xff\xd8\xff",                    # JPEG
    b"\x89PNG\r\n\x1a\n",               # PNG
    b"GIF87a",
    b"GIF89a",
    b"RIFF",                            # WebP (RIFF....WEBP)
)

MAX_IMAGE_MB = 5
MAX_DOCUMENT_MB = 10


@deconstructible
class MaxFileSizeValidator:
    """Reject files above `max_mb`.

    Deconstructible so it can live in a migration without Django complaining.
    """

    def __init__(self, max_mb):
        self.max_mb = max_mb

    def __call__(self, value):
        limit = self.max_mb * 1024 * 1024
        size = getattr(value, "size", None)
        if size is None:
            return
        if size > limit:
            raise ValidationError(
                f"File is {size / 1024 / 1024:.1f} MB. The maximum is {self.max_mb} MB."
            )

    def __eq__(self, other):
        return isinstance(other, MaxFileSizeValidator) and self.max_mb == other.max_mb


def _extension_of(value):
    name = getattr(value, "name", "") or ""
    return os.path.splitext(name)[1].lower()


def _check_extension(value, allowed):
    ext = _extension_of(value)
    if ext not in allowed:
        raise ValidationError(
            f"'{ext or 'no extension'}' is not an accepted file type. "
            f"Accepted: {', '.join(sorted(allowed))}."
        )


def _check_content_type(value, allowed):
    # Present only for a fresh upload; absent when re-validating a stored file.
    if not isinstance(value, UploadedFile):
        return
    content_type = (getattr(value, "content_type", "") or "").lower()
    if content_type and content_type not in allowed:
        raise ValidationError(f"Content type '{content_type}' is not accepted.")


def _check_image_magic(value):
    """Read the first bytes and confirm they look like an image.

    Cheap, and it catches the rename attack that extension + content-type both
    miss. Always restore the file pointer — a consumed pointer makes the
    subsequent save write a zero-byte file, which is a maddening bug to trace.
    """
    f = getattr(value, "file", value)
    try:
        pos = f.tell()
    except (AttributeError, OSError):
        return
    try:
        f.seek(0)
        head = f.read(16)
    except (AttributeError, OSError):
        return
    finally:
        try:
            f.seek(pos)
        except (AttributeError, OSError):
            pass

    if not head:
        raise ValidationError("The uploaded file is empty.")
    if not any(head.startswith(prefix) for prefix in IMAGE_MAGIC_PREFIXES):
        raise ValidationError(
            "The file contents are not a recognised image. "
            "Renaming a file does not change what it is."
        )


def _check_image_decodes(value):
    """Confirm Pillow can actually parse it.

    `verify()` checks structural integrity without decoding pixel data. It must
    be called on a fresh handle — Pillow closes the file after verify(), so an
    Image object is unusable afterwards.
    """
    try:
        from PIL import Image
    except ImportError:  # Pillow absent: the other checks still apply.
        return

    f = getattr(value, "file", value)
    try:
        pos = f.tell()
        f.seek(0)
    except (AttributeError, OSError):
        return
    try:
        Image.open(f).verify()
    except Exception:
        raise ValidationError("The image could not be decoded and may be corrupt or crafted.")
    finally:
        try:
            f.seek(pos)
        except (AttributeError, OSError):
            pass


def validate_image_file(value):
    """Full image validation: extension, content type, magic bytes, decode, size."""
    _check_extension(value, ALLOWED_IMAGE_EXTENSIONS)
    _check_content_type(value, ALLOWED_IMAGE_CONTENT_TYPES)
    _check_image_magic(value)
    _check_image_decodes(value)
    MaxFileSizeValidator(MAX_IMAGE_MB)(value)


def validate_document_file(value):
    """Document validation: extension, content type, size.

    No magic-byte check — CSV has no signature. Anything parsing these files
    must treat the contents as hostile: a CSV cell beginning with =, +, - or @
    is a formula-injection payload in Excel, so prefix it with a single quote
    before writing any user-supplied CSV.
    """
    _check_extension(value, ALLOWED_DOCUMENT_EXTENSIONS)
    _check_content_type(value, ALLOWED_DOCUMENT_CONTENT_TYPES)
    MaxFileSizeValidator(MAX_DOCUMENT_MB)(value)


@deconstructible
class safe_upload_to:
    """Build an `upload_to` callable that discards the client's filename.

        image = models.ImageField(upload_to=safe_upload_to("products"))
        # -> products/2026/08/3f9c1e70a1b34f0e9c2d8e5b7a4f1c93.webp

    The client filename is attacker-controlled. `../../../etc/passwd`,
    `..\\..\\web.config`, a null byte, a 4000-character name, a name that
    normalises to an existing file — all arrive as ordinary strings. Django
    sanitises somewhat; do not rely on it. Generate the name yourself and keep
    only the validated extension.

    Date-partitioned so no single directory accumulates millions of entries,
    which degrades most filesystems and makes ops tooling slow.
    """

    def __init__(self, subdir, keep_stem=False):
        self.subdir = subdir.strip("/")
        # keep_stem=True prepends a slugified 40-char stem for human-readable
        # filenames. It still cannot collide or traverse: the UUID is always
        # present and slugify() strips separators.
        self.keep_stem = keep_stem

    def __call__(self, instance, filename):
        from django.utils import timezone

        ext = os.path.splitext(filename or "")[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS:
            ext = ""
        token = uuid.uuid4().hex
        if self.keep_stem:
            stem = slugify(os.path.splitext(os.path.basename(filename or ""))[0])[:40]
            name = f"{stem}-{token}{ext}" if stem else f"{token}{ext}"
        else:
            name = f"{token}{ext}"
        now = timezone.now()
        return f"{self.subdir}/{now:%Y}/{now:%m}/{name}"

    def __eq__(self, other):
        return (
            isinstance(other, safe_upload_to)
            and self.subdir == other.subdir
            and self.keep_stem == other.keep_stem
        )


def strip_image_metadata(django_file, fmt="WEBP", quality=82, max_edge=2400):
    """Re-encode an image to drop EXIF, ICC and any appended payload.

    Re-encoding is the only reliable way to neutralise a polyglot file: the
    output contains just the pixels the decoder read. It also strips GPS
    coordinates from customer photos, which is a privacy obligation, not an
    optimisation.

    Returns a ContentFile ready to assign to the field. Call it in the
    serializer or a pre_save signal, not in a validator — validators must not
    mutate their input.
    """
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image

    django_file.seek(0)
    img = Image.open(django_file)
    img = img.convert("RGBA" if fmt.upper() == "WEBP" else "RGB")
    if max_edge and max(img.size) > max_edge:
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format=fmt, quality=quality, method=6 if fmt.upper() == "WEBP" else None)
    buf.seek(0)
    return ContentFile(buf.read(), name=f"{uuid.uuid4().hex}.{fmt.lower()}")
