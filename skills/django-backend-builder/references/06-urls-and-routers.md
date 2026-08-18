# URLs and routers

Wiring endpoints. Owns the URL namespace, router registration, and the auth
endpoint surface.

## Project root

```python
# project_core/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Not /admin/. The Django admin at a guessable path attracts constant
    # credential-stuffing traffic, and it collides with the SPA's own /admin
    # route in every developer's head.
    path("django-admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("api/", include("core_domain.urls")),
    path("api/", include("transactions.urls")),
]

# Development only. In production the web server serves media directly — Django
# is single-threaded per worker and one large image download blocks a worker for
# the duration of the transfer.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

## App-level router

```python
# core_domain/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BrandViewSet, CategoryViewSet, ProductViewSet

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")

urlpatterns = [path("", include(router.urls))]
```

Always pass `basename`. Without it, DRF derives one from `queryset`, and a
ViewSet that defines `get_queryset()` instead of a class-level `queryset` —
which every owner-scoped ViewSet does — raises at import with an error that does
not name the cause.

`DefaultRouter` adds a browsable API root at `/api/`. That is useful in
development and an endpoint enumeration in production; `settings.py` already
strips `BrowsableAPIRenderer` when `DEBUG` is off, which neutralises it.

## The auth surface

```python
# api/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .views import CustomTokenObtainPairView, LogoutAllView, LogoutView, RegisterView
from .views_me import CurrentUserView
from .views_otp import RequestOTPView, VerifyOTPView
from .views_password import PasswordResetConfirmView, PasswordResetRequestView

urlpatterns = [
    # Identity. The frontend's entire role model depends on this one endpoint.
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),

    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/logout-all/", LogoutAllView.as_view(), name="logout_all"),

    path("auth/otp/request/", RequestOTPView.as_view(), name="otp_request"),
    path("auth/otp/verify/", VerifyOTPView.as_view(), name="otp_verify"),

    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(),
         name="password_reset_confirm"),
]
```

Name every route. `reverse("otp_verify")` in a test survives a URL change; a
hardcoded `/api/auth/otp/verify/` does not, and the test then fails for a reason
unrelated to what it was checking.

## Trailing slashes

Django defaults to trailing slashes, and `APPEND_SLASH` redirects when one is
missing. That redirect is a **302 that drops the request body on POST** — the
client follows it with a GET and the write silently vanishes.

Pick one convention and make the frontend match it exactly. With the
`django-backend-builder` defaults that means trailing slashes everywhere:

```js
api.post("/orders/", payload);     // correct
api.post("/orders", payload);      // 302 -> GET -> body lost
```

If the frontend cannot be changed, turn the router's slashes off instead of
relying on the redirect:

```python
router = DefaultRouter(trailing_slash=False)
```

Never leave it ambiguous. This is one of the most common causes of "the POST
works in Postman but not in the app".

## Versioning

Version from the first release, even with one version. Retrofitting a prefix
once mobile clients exist means maintaining both paths forever.

```python
path("api/v1/", include("core_domain.urls")),
```

Cheapest form is URL-prefix versioning as above. See the `api-contract` skill
for when a version bump is required versus when a field can simply be added.

## Nested resources

Prefer a filter over a nested route:

```
GET /api/products/?category=3          # do this
GET /api/categories/3/products/        # not this
```

Flat routes keep one ViewSet per resource, one permission declaration, and one
place where the queryset is scoped. Nested routes duplicate all three and make
the permission question ambiguous — does `/categories/3/products/` check the
category's permissions or the product's?

Use a nested route only when the child genuinely cannot exist standalone and its
list has no meaning globally.

## Verification

```bash
# Every registered route, with its view and name.
python manage.py show_urls 2>/dev/null || \
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','project_core.settings')
django.setup()
from django.urls import get_resolver
for k, v in sorted(get_resolver().reverse_dict.items()):
    if isinstance(k, str):
        print(f'{k:35} /{v[0][0][0]}')
"

# The identity endpoint exists and is protected.
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/auth/me/
# expect: 401 — not 404

# Trailing slash behaviour is not a silent redirect on writes.
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'
# expect: 404 or 400 — a 301/302 here means bodies are being dropped
```

## Common mistakes

- Omitting `basename` on a ViewSet that uses `get_queryset()`.
- The Django admin at `/admin/`, colliding with the SPA route.
- Serving media through Django in production.
- Mismatched trailing slashes between frontend and backend, so POSTs redirect
  and lose their body.
- Unnamed routes, so every test hardcodes a URL.
- Adding versioning later.
