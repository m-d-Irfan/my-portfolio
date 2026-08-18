"""Abstract model bases.

Copy to `common/models.py` and subclass. Every one of these exists because the
naive version of it was written wrong at least once in this codebase.

    from common.models import TimeStampedModel, SluggedModel, unique_slug

    class Product(TimeStampedModel, SluggedModel):
        slug_source = "title"
        title = models.CharField(max_length=255)

Four defects these bases prevent, all found in a real audit:

  1. `BaseDomainItem.objects.filter(pk=self.pk).first().name` on a model whose
     field is `title` — AttributeError on every update of an existing row.
     Nothing caught it because the code path only runs on edit, not create.

  2. A base model with no `class Meta: abstract = True`. Django creates a real
     table for it, and every subclass silently becomes multi-table inheritance:
     a hidden JOIN on every query, forever.

  3. `slugify(title)` into a `SlugField(unique=True)` with no collision
     handling. IntegrityError the first time two products share a name.

  4. Re-slugging on rename. The old slug is a live URL that search engines have
     indexed and customers have bookmarked. Silently changing it is a 404 with
     no redirect.
"""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def unique_slug(instance, base, slug_field="slug", max_length=50):
    """Return `base`, suffixed -2, -3, … until unique for this model.

    Excludes the instance's own pk so re-saving a record does not collide with
    itself. Truncates to fit `max_length` including the suffix — a 200-character
    title slugified into a 50-character column would otherwise raise DataError
    on MySQL and silently truncate on SQLite.

    Note the race: two concurrent creates can both see a slug as free. The
    UniqueConstraint on the column is what actually guarantees correctness; this
    helper just makes the common case not hit it. Catch IntegrityError and retry
    if you create rows concurrently.
    """
    Model = instance.__class__
    base = (base or "")[:max_length].rstrip("-") or uuid.uuid4().hex[:8]
    slug, n = base, 1
    while (
        Model.objects.filter(**{slug_field: slug})
        .exclude(pk=instance.pk)
        .exists()
    ):
        n += 1
        suffix = f"-{n}"
        slug = f"{base[: max_length - len(suffix)].rstrip('-')}{suffix}"
    return slug


class TimeStampedModel(models.Model):
    """created_at / updated_at.

    `auto_now_add` and `auto_now` are set by Django, not the database, and are
    not editable in the admin or via a serializer. That is what you want: a
    client-supplied `created_at` is a falsifiable audit trail.

    Both are indexed — "newest first" is the default ordering of nearly every
    list endpoint, and an unindexed ORDER BY on a large table is a filesort.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SluggedModel(models.Model):
    """A stable, unique, URL-safe slug.

    Set `slug_source` on the subclass to the field the slug derives from:

        class Product(SluggedModel):
            slug_source = "title"

    The slug is assigned once, on create, and never changes on rename. If a slug
    genuinely must change, change it explicitly and ship a redirect — do not let
    it happen as a side effect of an edit.
    """

    slug_source = "name"

    slug = models.SlugField(max_length=255, unique=True, blank=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.slug:
            source = getattr(self, self.slug_source, "") or ""
            self.slug = unique_slug(
                self,
                slugify(source, allow_unicode=False),
                max_length=self._meta.get_field("slug").max_length,
            )
        super().save(*args, **kwargs)


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)

    def delete(self):
        """Soft-delete in bulk. Use .hard_delete() to actually remove rows."""
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()


class SoftDeleteManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    """Soft delete via `deleted_at`.

    For records that must not vanish: orders, invoices, stock movements, anything
    with a financial or legal trail. A hard DELETE on an order destroys the
    accounting record and cascades into its items.

    TWO MANAGERS, and the order matters. `objects` is first, so it is the default
    manager Django uses for related-object access and for the admin — it hides
    deleted rows. `all_objects` sees everything.

        Order.objects.all()          # alive only
        Order.all_objects.all()      # including soft-deleted
        order.delete()               # sets deleted_at
        order.hard_delete()          # actually removes the row

    CAUTION: a `unique=True` column plus soft delete means a soft-deleted row
    keeps occupying its unique value forever, so the user cannot re-create it.
    Use a partial constraint instead:

        class Meta:
            constraints = [
                models.UniqueConstraint(
                    fields=["code"],
                    condition=models.Q(deleted_at__isnull=True),
                    name="uniq_active_code",
                )
            ]
    """

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager.from_queryset(SoftDeleteQuerySet)()

    class Meta:
        abstract = True

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at"])


class BaseDomainItem(TimeStampedModel, SluggedModel):
    """Abstract base for catalog items: Product, Article, Service.

    Subclass it. Do not use it directly — it is abstract on purpose (defect 2).

        class Product(BaseDomainItem):
            slug_source = "title"
            productcode = models.CharField(max_length=64, unique=True)

    `related_name='%(class)s_items'` is mandatory on an abstract base. A literal
    `related_name='items'` collides the moment a second subclass exists, and the
    error surfaces at import time in an unrelated app.
    """

    slug_source = "title"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(
        "category.Category",
        on_delete=models.PROTECT,
        related_name="%(class)s_items",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


# ---------------------------------------------------------------------------
# on_delete, chosen deliberately
#
#   PROTECT   default for anything referenced by financial or historical data.
#             Deleting a Category that still has Products should fail loudly,
#             not silently destroy the catalog.
#   CASCADE   only for rows that are meaningless without the parent —
#             ProductImage without its Product, OrderItem without its Order.
#   SET_NULL  for optional references that outlive the target — Order.user when
#             a customer closes their account but the order must remain.
#
# CASCADE is Django's most-copied default and is almost always the wrong choice
# for a foreign key pointing at a business entity.
# ---------------------------------------------------------------------------
