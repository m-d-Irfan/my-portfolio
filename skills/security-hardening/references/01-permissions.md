# Permission classes

This file owns one decision: for any endpoint in this project, which permission class guards it.

## The hard rule

**Every ViewSet and every APIView declares `permission_classes` explicitly. Never inherit the global default.**

This is not style. It is the direct fix for **S2**. `CategoryViewSet` and `BrandViewSet` shipped with no `permission_classes` at all, so DRF fell back to `DEFAULT_PERMISSION_CLASSES` in `settings.py`, which was:

```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
}
```

`IsAuthenticatedOrReadOnly` means "any authenticated user may write". Every shopper who signed up could `DELETE /categories/3/` and take out a whole branch of the catalog tree, because `Category.parent` is a self-FK and `Product.category` is `on_delete=models.CASCADE`. One request from any customer account destroys every product under that category.

The failure was invisible in code review because there was nothing to review. An empty class body reads as "no special access rules", when it actually means "whatever settings.py happens to say today".

Two consequences you must internalise:

1. A reader must be able to determine an endpoint's access policy from the endpoint itself, without opening `settings.py`.
2. Changing `DEFAULT_PERMISSION_CLASSES` must never be able to silently widen access anywhere. `assets/settings_security.py` sets the default to `rest_framework.permissions.IsAdminUser` — deny-by-default. If you forget `permission_classes`, you get a loud 403 in development instead of a quiet hole in production.

Explicit `permission_classes = [AllowAny]` is acceptable where it is correct. It is a decision on the record. An omission is not a decision.

## The two layers

DRF asks two separate questions, and they are not interchangeable.

| Hook | Question | When DRF calls it |
| --- | --- | --- |
| `has_permission(request, view)` | May this actor touch this endpoint at all? | Every request, before the handler runs |
| `has_object_permission(request, view, obj)` | May this actor touch *this record*? | Detail routes only, from `get_object()` |

Critical mechanics, all of which have bitten this project:

- `has_object_permission` is **only** reached if `has_permission` returns `True` first. It is a narrowing filter, never a rescue.
- `has_object_permission` is **not** called on list routes. `GET /orders/` never consults it. List scoping is `get_queryset()`'s job.
- `has_object_permission` is **not** called on create. There is no object yet. Ownership on create belongs in `perform_create()` or the serializer.
- It is only called if the view actually calls `get_object()`. A custom `@action` that hand-rolls its own lookup skips the check entirely. `OrderViewSet.track` does exactly this: `Order.objects.get(pk=pk)` under `permission_classes=[AllowAny]`, so any anonymous visitor can walk `/orders/1/track/`, `/orders/2/track/` and read `customer_name`, `total_amount`, `payment_method` and `status` for every order ever placed.

### Why S6 defeated the entire class

**S6** was a permission class that looked like a guard and enforced nothing:

WRONG — this is the real shape of the S6 defect:

```python
class IsAdminOrReadOnlyForIsActive(permissions.BasePermission):
    def has_permission(self, request, view):
        return True                      # gate is wide open

    def has_object_permission(self, request, view, obj):
        if request.method in ('PUT', 'PATCH') and 'is_active' in request.data:
            return request.user.is_staff
        return True                      # DELETE lands here. Permitted.
```

Two independent fatal defects:

1. `has_permission` returning an unconditional `True` means the class contributes **zero** view-level protection. Adding it to `permission_classes` is indistinguishable from adding `AllowAny`. Worse, the name says the opposite, so every subsequent reader assumes the endpoint is guarded.
2. The object check enumerates what is *denied* and permits the remainder. `DELETE` is not named, so it falls to `return True`. This class permitted anonymous deletion of user records.

The principle, stated as a rule you can apply mechanically:

> A permission class must **fail closed**. Enumerate what is allowed and deny everything else. Never enumerate what is denied and allow the rest.

Applied to code review: if the last statement of a `has_permission` or `has_object_permission` is `return True`, treat it as a finding until proven otherwise. The safe shape ends with a positive assertion about the actor — `return _is_staff(request.user)` or `return owner == request.user` — not a bare `True`.

## The decision tree

Answer these in order. The first `yes` wins.

```
1. Must an anonymous visitor be able to READ this?
   |
   +- YES -> 2. Who may WRITE it?
   |          +- Staff only ................... IsAdminOrReadOnly
   |          +- The record's owner ........... IsOwnerOrReadOnly
   |          +- Nobody (server-generated) .... ReadOnly
   |
   +- NO --> 3. Is this record owned by a specific customer?
              |
              +- YES -> 4. Must staff also service it?
              |          +- YES ............... IsStaffOrOwner  (+ queryset scoping)
              |          +- NO ................ IsOwnerOrReadOnly with a scoped queryset
              |
              +- NO --> 5. Is `is_staff` a fine enough distinction?
                         +- YES ............... IsAdminOnly
                         +- NO, needs a role .. HasRole('inventory_manager', ...)
```

Step 5 is the one people skip. `is_staff` is a boolean; it cannot express "the inventory manager may record a godown receive but may not change a selling price". When you find yourself wanting to write `if user.is_staff and user.role == ...` inside a view, you wanted `HasRole` at step 5.

## The class catalog

All of these live in `assets/permissions.py`. Copy that file to `api/permissions.py` and import from it. Do not rewrite them per app — every rewrite is a chance to reintroduce S6.

| Class | Read | Write | Use for |
| --- | --- | --- | --- |
| `ReadOnly` | anyone | nobody | Server-computed projections, public feeds, report endpoints |
| `IsAdminOrReadOnly` | anyone | `is_staff` / `is_superuser` | The public catalog: products, images, attributes, colors, categories, brands |
| `IsAdminOnly` | `is_staff` | `is_staff` | Records whose very existence is privileged: users, buying prices, parties, sales reports, audit log |
| `IsOwnerOrReadOnly` | anyone | the object's owner | Reviews, public-readable owned content |
| `IsStaffOrOwner` | owner or staff | owner or staff | Orders, addresses, profile — customer-owned but staff-serviceable |
| `IsAdminOrWriteOnly` | `is_staff` | anyone may POST | Inbound-only: contact form, callback request |
| `HasRole(*roles)` | role holders | role holders | Inventory vs showroom separation |
| `IsAuthenticatedAndVerified` | verified users | verified users | Actions gated behind email verification |

Two API details that are easy to get wrong:

**`owner_field` is set on the view, not passed to the class.** `IsOwnerOrReadOnly` and `IsStaffOrOwner` both read `getattr(view, 'owner_field', 'user')`. Dotted paths work for indirect ownership.

```python
class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsOwnerOrReadOnly]
    owner_field = 'user'          # default; shown for clarity

class OrderItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffOrOwner]
    owner_field = 'order.user'    # OrderItem has no user FK of its own
```

If the owner field cannot be resolved, both classes return `False`. Unresolvable is a bug, and a bug must not read as "permitted" — that is precisely how S6 happened.

**`HasRole` is a factory, not a class.** Call it; don't subclass it.

```python
permission_classes = [HasRole('inventory_manager')]                  # correct
permission_classes = [HasRole('showroom_manager', 'admin')]          # any of these roles
permission_classes = [HasRole('admin', allow_staff=False)]           # excludes plain staff
```

`allow_staff=True` is the default, so superusers and staff always pass. Set it to `False` only for a genuine separation-of-duty control.

## This project's resources

Endpoint paths are as routed in `daf_backend/urls.py` — the router mounts at the root, so it is `/products/`, not `/api/products/`.

| Endpoint | View | Class | Rationale |
| --- | --- | --- | --- |
| `/products/` | `ProductViewSet` | `IsAdminOrReadOnly` | Shoppers browse without an account; only staff mutate the catalog (**S1**) |
| `/products/<id>/reviews/` | `ProductReviewListCreateView` | `IsAuthenticatedOrReadOnly` + owner check on update | Anyone reads reviews; only signed-in users post; only the author edits |
| `/categories/` | `CategoryViewSet` | `IsAdminOrReadOnly` | **S2**. Cascade delete makes this high-blast-radius |
| `/brands/` | `BrandViewSet` | `IsAdminOrReadOnly` | **S2** |
| `/maincategories/`, `/subcategories/<id>/` | `MainCategoryListView`, `SubCategoryListView` | `ReadOnly` | Read-only projections; declare it rather than leaving it blank |
| `/categories/<id>/products/` | `ProductsByCategoryView` | `ReadOnly` | Same |
| `/orders/` | `OrderViewSet` | `IsStaffOrOwner` + `get_queryset` scoping | Customer sees own orders, staff see all |
| `/orders/<id>/track/` | `OrderViewSet.track` | `IsStaffOrOwner`, or a signed token | Currently `AllowAny` with a raw `.get(pk=pk)` — enumerable |
| `/place_order/` | `place_order` | `AllowAny` (guest checkout is a product requirement) | Explicit, and every price recomputed server-side — see `06-server-authority.md` |
| `/users/` | `UserViewSet` | `IsAdminOnly` + self-scoped queryset | Role and `is_staff` live here |
| `/auth/me/` | `CurrentUserView` | `IsAuthenticated` | Returns only `request.user` |
| `/auth/registration/`, `/auth/verify-otp/`, `/auth/login/`, `/auth/check-username/` | — | `AllowAny` + throttle | Must be open; abuse is bounded by throttling, not permissions (see `02-throttling.md`) |
| `/inventory/parties/` | `PartyViewSet` | `HasRole('inventory_manager')` | Supplier records carry commercial terms |
| `/inventory/receives/` | `GodownReceiveViewSet` | `HasRole('inventory_manager')` | Stock-in; `unit_buying_price` is confidential |
| `/inventory/dispatches/` | `GodownDispatchViewSet` | `HasRole('inventory_manager')` | Stock-out |
| `/inventory/products/` | `InventoryProductViewSet` | `HasRole('inventory_manager', 'showroom_manager')` | Showroom staff read stock; only inventory adjusts it |
| `/inventory/dashboard/` | `InventoryDashboardView` | `HasRole('inventory_manager', 'showroom_manager')` | Aggregates over buying prices |

Note the asymmetry on `ProductAttribute`: it carries both `mainPrice`/`discountedPrice` (public) and `buying_price` (confidential). The permission class does not solve this — a field-level control does. Exclude `buying_price` from the public serializer and expose it only through the inventory serializer.

## Worked examples

### Public read, staff write

The catalog. This is the S1 and S2 fix.

WRONG — S1, the literal line that shipped:

```python
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]   # anonymous POST/PUT/DELETE
```

WRONG — S2, the absence that shipped:

```python
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    # no permission_classes -> IsAuthenticatedOrReadOnly -> any shopper deletes categories
```

RIGHT:

```python
from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from api.permissions import IsAdminOrReadOnly
from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects
        .select_related('category', 'brand')
        .prefetch_related('images', 'attributes', 'color')
        .order_by('-created_at')
    )
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['name', 'productcode']
    filterset_fields = ['category', 'brand', 'is_active', 'is_featured', 'productcode']
```

`ProductImageViewSet`, `ProductAttributeViewSet`, `ProductColorViewSet`, `CategoryViewSet` and `BrandViewSet` all take the same line. Do not leave the nested viewsets weaker than the parent: `IsAdminOrReadOnly` on `ProductViewSet` is worthless if `PATCH /product-attributes/17/` lets anyone rewrite `discountedPrice` to `1.00`.

### Owner-only

Orders are the canonical case, and they need **two** controls. The permission class handles detail routes; the queryset handles the list route. Neither substitutes for the other.

WRONG — permission class only:

```python
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()            # list returns EVERY customer's orders
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrOwner]     # never consulted on list
```

`has_object_permission` is not called for list routes, so `GET /orders/` returns the full table: every customer name, phone number, delivery address, `bkash_number` and `transaction_id` in the database.

RIGHT:

```python
from rest_framework import viewsets
from api.permissions import IsStaffOrOwner
from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrOwner]

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.prefetch_related('items__product', 'items__attribute')
        if user.is_staff or user.is_superuser:
            return qs.order_by('-created_at')
        return qs.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        # Ownership is assigned by the server. Never from request.data.
        serializer.save(user=self.request.user)
```

Two things to notice. First, `get_queryset` scoping also fixes enumeration: a non-owner requesting `/orders/812/` gets `404`, not `403`, because the object is not in their queryset. A 404 leaks less than a 403 — a 403 confirms the record exists.

Second, `perform_create` assigns `user` server-side. If `user` were writable through the serializer, a customer could POST an order attributed to someone else. See `06-server-authority.md`.

The same pattern applies to addresses and profile updates.

### Staff-only

```python
from rest_framework import viewsets
from django.contrib.auth import get_user_model

from api.permissions import IsAdminOnly
from .serializers import CustomUserSerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = CustomUserSerializer
    permission_classes = [IsAdminOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return User.objects.all().order_by('-date_joined')
        return User.objects.filter(id=user.id)
```

`CustomUserSerializer` must keep `is_staff`, `is_superuser`, `is_active`, `role` and `otp` in `read_only_fields` — the permission class controls *who reaches the endpoint*, and the serializer controls *which fields they can set*. Both are required. A staff-gated endpoint that lets a showroom manager PATCH their own `is_superuser` to `true` is still a privilege-escalation bug.

### Role-gated: inventory vs showroom

`is_staff` cannot express this split. `CustomUser.role` can, with choices `customer`, `inventory_manager`, `showroom_manager`, `admin`.

```python
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response

from api.permissions import HasRole
from .models import Party, GodownReceive
from .serializers import PartySerializer, GodownReceiveSerializer


class PartyViewSet(viewsets.ModelViewSet):
    queryset = Party.objects.all()
    serializer_class = PartySerializer
    permission_classes = [HasRole('inventory_manager')]


class GodownReceiveViewSet(viewsets.ModelViewSet):
    queryset = GodownReceive.objects.prefetch_related('items__product', 'items__attribute')
    serializer_class = GodownReceiveSerializer
    permission_classes = [HasRole('inventory_manager')]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SalesReportView(APIView):
    permission_classes = [HasRole('showroom_manager', 'admin')]

    def get(self, request):
        ...
        return Response({'currency': 'BDT'})
```

Different permissions per action on one viewset — showroom staff may read stock levels, only inventory staff may change them:

```python
class InventoryProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.prefetch_related('attributes')
    serializer_class = InventoryProductSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [HasRole('inventory_manager', 'showroom_manager')()]
        return [HasRole('inventory_manager')()]
```

Note the trailing `()`. `get_permissions` must return **instances**; `permission_classes` holds **classes**. `HasRole(...)` returns a class, so inside `get_permissions` you call it twice: once to build the class, once to instantiate. Forgetting the second call raises `TypeError: 'type' object is not callable` at request time — a loud failure, which is the good outcome.

### Combining classes

`permission_classes = [A, B]` means A **AND** B. For OR, use DRF's operators:

```python
from api.permissions import IsAdminOnly, HasRole

permission_classes = [IsAdminOnly | HasRole('showroom_manager')]
```

Be careful: `|` short-circuits on `has_permission`, and DRF's `OR` also ORs the object-level checks. Two classes that each fail closed compose safely. A class that returns unconditional `True` poisons the whole expression — one more reason S6 was so damaging.

## The frontend is not a permission layer

**S7/S8**: the admin panel was guarded by reading `is_staff` out of `localStorage`. Any visitor could run this in the console and reload into the full admin UI:

```js
let u = JSON.parse(localStorage.getItem('user'));
u.is_staff = true;
localStorage.setItem('user', JSON.stringify(u));
```

The correct mental model: **the frontend guard is a navigation convenience, not a security control.** Its job is to avoid showing a customer a menu of buttons that will all 403. It cannot be the thing that stops them.

`AdminLayout.jsx` now re-verifies against the server, which is the right shape:

```jsx
useEffect(() => {
  let isMounted = true;
  const verifyAccess = async () => {
    const serverUser = await fetchCurrentUser();   // GET /auth/me/ with the JWT
    if (!isMounted) return;
    if (!serverUser || !(serverUser.is_staff || serverUser.is_superuser)) {
      navigate('/');
    } else {
      setVerifying(false);
    }
  };
  if (!user || !(user.is_staff || user.is_superuser)) {
    navigate('/');            // cheap local check, avoids a flash of admin chrome
  } else {
    verifyAccess();           // authoritative check
  }
  return () => { isMounted = false; };
}, [fetchCurrentUser, navigate]);
```

Two properties make this correct. The local `localStorage` check is only ever used to redirect *away* — tampering with it can get you as far as a spinner. And `fetchCurrentUser()` derives identity from the JWT server-side, which the attacker cannot forge without `SECRET_KEY`.

But the load-bearing claim is still this: **even with the frontend guard removed entirely, every admin action must fail.** The panel calls `/products/`, `/categories/`, `/users/`. If those carry the right `permission_classes`, a tampered `localStorage` buys the attacker a rendered layout full of empty tables and 403s. That is the outcome you are designing for. Test it that way — see the localStorage-tampering test in `../checklists/pre-deploy-security.md`.

## Testing permissions

Every entry in the resource table above should have three tests: anonymous, wrong-role, right-role.

```python
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class CategoryPermissionTests(APITestCase):
    """Regression tests for S2."""

    def setUp(self):
        self.shopper = User.objects.create_user(
            username='shopper', email='shopper@example.com', password='pw-not-a-secret-123',
        )
        self.admin = User.objects.create_superuser(
            username='boss', email='boss@example.com', password='pw-not-a-secret-123',
        )
        self.url = reverse('category-list')
        self.payload = {'name': 'Injected Category'}

    def test_anonymous_cannot_create(self):
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_shopper_cannot_create(self):
        self.client.force_authenticate(self.shopper)
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_shopper_cannot_delete(self):
        # The original S2 exploit: cascade-deleting products via a category.
        from category.models import Category
        category = Category.objects.create(name='Aluminium Sheets')
        self.client.force_authenticate(self.shopper)
        response = self.client.delete(reverse('category-detail', args=[category.pk]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())

    def test_admin_can_create(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_anyone_can_read(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)
```

A test that catches the *class* of bug rather than one instance — this is the one that would have caught S2 before it shipped:

```python
from django.apps import apps
from rest_framework.routers import DefaultRouter
from rest_framework.viewsets import GenericViewSet
from django.test import SimpleTestCase

from daf_backend.urls import router


class EveryViewSetDeclaresPermissions(SimpleTestCase):
    """No endpoint may rely on DEFAULT_PERMISSION_CLASSES."""

    def test_all_registered_viewsets_are_explicit(self):
        offenders = []
        for prefix, viewset, basename in router.registry:
            if 'permission_classes' not in vars(viewset):
                offenders.append(f'{viewset.__name__} (/{prefix}/)')
        self.assertEqual(
            offenders, [],
            'These ViewSets inherit the global default permission — declare '
            'permission_classes explicitly. See references/01-permissions.md (S2).',
        )
```

`vars(viewset)` rather than `hasattr` is deliberate: `hasattr` is satisfied by the inherited attribute from `APIView`, so it passes for exactly the broken case you are trying to catch. Checking the class's own `__dict__` requires the declaration to be present on the class itself.

## Review checklist

- [ ] Every ViewSet and APIView has `permission_classes` in its own class body.
- [ ] No `permission_classes = [AllowAny]` on a `ModelViewSet` (S1). If write access must be open, it is a function view with explicit server-side validation, like `place_order`.
- [ ] No `has_permission` or `has_object_permission` ends in a bare `return True` (S6).
- [ ] Every owner-scoped ViewSet has **both** a permission class and a filtered `get_queryset`.
- [ ] Every `@action` that looks up its own object either calls `self.get_object()` or checks permissions by hand.
- [ ] `perform_create` assigns the owner from `request.user`, never from `request.data`.
- [ ] Privileged serializer fields (`is_staff`, `is_superuser`, `role`, `is_active`, `otp`, `buying_price`) are read-only or absent in customer-facing serializers.
- [ ] The three-way curl matrix in `../checklists/pre-deploy-security.md` passes for `/products/`, `/categories/` and `/brands/`.
