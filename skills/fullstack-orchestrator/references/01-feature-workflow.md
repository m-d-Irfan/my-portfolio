# Feature workflow

One feature, worked end to end. The example is a **product review** — customers
leave a rating and comment, staff moderate them, the product page shows the
average. It touches every layer, which is why it is the example.

## 0. Decide the four things

Before any file is opened:

| Question | Answer here | Consequence |
|---|---|---|
| Who can do this? | Any authenticated customer creates; owner edits; staff moderates | The permission class |
| Is money involved? | No | No server-authority recompute needed |
| Third party? | No | No outbox |
| New field on an existing model? | Yes — `Product.average_rating` | A migration and a backfill decision |

Guessing the first one produced **S1** and **S2**. It is one question and it
takes one message.

## 1. data-layer — the model

```python
class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(max_length=2000, blank=True)
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['product', 'user'], name='one_review_per_user'),
        ]
        indexes = [models.Index(fields=['product', 'is_approved'], name='review_visible_idx')]
```

Decisions worth naming, because each one is a defect class from the corpus:

- **`UniqueConstraint`, not application logic.** A double-submitted form hits
  the database constraint, which is the only check that holds under concurrency
  (**N10**).
- **`is_approved` defaults to `False`.** The safe default. A moderation queue
  that defaults to visible is not a moderation queue.
- **`auto_now_add`**, so `created_at` cannot be set by a client (**N12**).
- **The index matches the query** the product page will run.

```bash
python manage.py makemigrations reviews
python manage.py sqlmigrate reviews 0001     # read it
python manage.py migrate
```

`average_rating` on `Product`: a nullable `DecimalField`, recomputed on review
approval. Denormalised deliberately — the product list would otherwise
aggregate across reviews on every request (**P4**).

## 2. api-contract — the wire shape

Written down **before** either side is built. This is the step that prevents
§2.5.

```
GET  /api/products/<id>/reviews/     → paginated, approved only
POST /api/products/<id>/reviews/     → create (authenticated)
PATCH /api/reviews/<id>/             → own review, or staff moderating
DELETE /api/reviews/<id>/            → own review, or staff
```

```json
{
  "id": 12,
  "rating": 4,
  "comment": "Solid build quality.",
  "user_name": "Rahim I.",
  "created_at": "2026-08-09T14:30:00+06:00",
  "is_approved": true
}
```

Every field maps to a model field or a declared `SerializerMethodField`. Nothing
is aspirational — that is the whole lesson of `product.features`.

Server-owned and therefore `read_only`: `id`, `user`, `user_name`,
`created_at`, `is_approved`. A customer who can PATCH `is_approved` has
self-approving reviews.

Errors use the project envelope (`api-contract/02`), so the frontend maps them
without special-casing.

## 3. django-backend-builder — serializer, viewset, URL

```python
class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'user_name', 'created_at', 'is_approved']
        read_only_fields = ['id', 'user_name', 'created_at', 'is_approved']

    def get_user_name(self, obj):
        # Not the full name and never the email — a review list is public.
        return f'{obj.user.first_name} {obj.user.last_name[:1]}.'.strip()
```

No `fields = '__all__'` (**P4**, and it publishes every future column). The
`user` FK is absent from `fields` entirely — it comes from the request.

```python
class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrStaffOrReadOnly]     # step 4, written now

    def get_queryset(self):
        qs = Review.objects.select_related('user')
        if not self.request.user.is_staff:
            qs = qs.filter(is_approved=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)         # never from the body
```

`select_related('user')` because the serializer reads `obj.user` — without it,
a 20-review page is 21 queries (**P4**).

## 4. security-hardening — the permission class

Written with the viewset, not after.

```python
class IsOwnerOrStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated   # not `True`

    def has_object_permission(self, request, request_view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff:
            return True
        return obj.user_id == request.user.id
```

Compare with **S6**: that class returned `True` from `has_permission`
unconditionally and returned `True` from the object check for every method
except PUT/PATCH — so DELETE was open to everyone. It had a correct name and a
plausible shape. **Read the returns, not the name.**

## 5. testing-harness — tests before the frontend

The permission matrix, as a table, as tests:

| Actor | List | Create | Edit own | Edit other | Approve |
|---|---|---|---|---|---|
| Anonymous | 200 | 401 | 401 | 401 | 401 |
| Customer | 200 | 201 | 200 | 403 | 403 |
| Staff | 200 | 201 | 200 | 200 | 200 |

Fifteen assertions. They are the reason S1, S2 and S6 cannot come back in this
app.

Also: unapproved reviews absent from the anonymous list, a second review by the
same user returning 400, `assertNumQueries` pinned on the list.

**Confirm each test fails before the fix exists.** Comment out
`permission_classes` and watch the anonymous-create test go red. A test never
observed failing is a test you have no reason to trust.

## 6. react-vite-frontend-builder — fetching

The frontend now reads a **real, tested, permission-checked endpoint**.

- Server data is server state — not copied into a context and filtered locally
  (**P1**).
- Loading, empty and error are three separate states, all designed
  (`ui-design-system/05`).
- The submit is optimistic **only** for the comment text, never for
  `is_approved` — that value is the server's, and animating it would be
  animating a lie.

## 7. forms-and-validation + ui-design-system — the interface

The form: rating input, comment textarea, character counter, submit.

- Client validation for shape (rating 1–5, comment length) — a fast hint, never
  the boundary.
- Server errors mapped field by field from the envelope. A 400 with
  `{"rating": ["..."]}` highlights the rating input, not a toast.
- Tokens only — no hex literals, no magic pixel values.
- `aria-invalid` and `aria-describedby` wired to the error text.
- The success state uses `transitions-dev/10-success-check`, at
  `transitions-polish` timings.

## 8. performance-budget — measure the finished slice

```bash
pytest tests/test_query_budget.py::test_review_list_queries    # constant at 10 and 1000
npm run build && bash scripts/check_budget.sh                  # bundle unchanged
```

The review list must be paginated with a `max_page_size`. A product with 4,000
reviews is otherwise a 4,000-row response.

## 9. Done gate

Run the checklist in the SKILL. The lines that catch real problems here:

- Every serializer field exists on the model → run the drift check
- `permission_classes` explicit → it is, from step 4
- Server-owned fields `read_only` → `is_approved`, `created_at`, `user_name`
- Query count pinned → step 8
- `.env.example` updated → nothing new here, but check

## What went differently from the failure mode

The original codebase built `product.features` in this order: **frontend
first**, then a serializer field, and never a model. Four files agreed with each
other, nothing errored, and the feature did not exist.

Here the model came first and the contract was written second, so by the time
any JSX existed, the endpoint was real, tested and permission-checked. The
frontend could not have been built against a shape that does not exist, because
the shape existed first.

That is the entire argument for the order.
