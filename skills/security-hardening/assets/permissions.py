"""Reusable DRF permission classes.

Copy this file to `api/permissions.py` (or a shared `common/permissions.py`) and
import from it. Do not rewrite these per project — every rewrite is a chance to
reintroduce S6.

Background — the two failures these classes exist to prevent:

  S1  `permission_classes = [permissions.AllowAny]` on a ModelViewSet left the
      entire product catalog open to anonymous writes.

  S2  No `permission_classes` at all on CategoryViewSet/BrandViewSet, so the
      project-wide default `IsAuthenticatedOrReadOnly` applied and any logged-in
      shopper could create or delete categories and brands.

  S6  A permission class whose `has_permission` returned True unconditionally
      and whose `has_object_permission` returned True for everything it did not
      explicitly handle — including DELETE. It read as a guard and enforced
      nothing.

THE RULE: every ViewSet declares `permission_classes` explicitly. Never rely on
DEFAULT_PERMISSION_CLASSES. A reader must be able to see the access policy of an
endpoint without opening settings.py.

Two-layer model, both layers required for owner-scoped resources:

  has_permission(request, view)              -> may this actor touch this endpoint at all?
  has_object_permission(request, view, obj)  -> may this actor touch THIS record?

`has_object_permission` is only consulted by DRF for detail routes, and only
after `get_object()` calls `check_object_permissions`. It is NOT called for list
routes and NOT called on create. Filter the queryset in `get_queryset()` for
list scoping; validate ownership in the serializer or `perform_create()` for
writes. A permission class alone does not scope a list.
"""

from rest_framework import permissions

# Methods that do not change state. GET, HEAD, OPTIONS.
SAFE_METHODS = permissions.SAFE_METHODS


def _is_staff(user):
    """True for staff and superusers. The single definition of 'privileged'."""
    return bool(
        user
        and user.is_authenticated
        and (user.is_staff or user.is_superuser)
    )


class ReadOnly(permissions.BasePermission):
    """Nobody writes, through this class, ever.

    Useful combined with another class via DRF's `|` operator, and for endpoints
    that are genuinely read-only projections (reports, aggregates, public feeds).
    """

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsAdminOrReadOnly(permissions.BasePermission):
    """Anyone reads. Only staff writes.

    This is the correct class for the public catalog: products, product images,
    product attributes, product colors, categories, brands. Storefront visitors
    must be able to browse without an account; nobody but staff may mutate.

    Fixes S1 and S2.
    """

    message = "Staff credentials are required to modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return _is_staff(request.user)

    def has_object_permission(self, request, view, obj):
        # Re-checked at object level so a detail-route DELETE cannot slip past
        # a view that forgot to call check_object_permissions on some path.
        if request.method in SAFE_METHODS:
            return True
        return _is_staff(request.user)


class IsAdminOnly(permissions.BasePermission):
    """Staff only, including reads.

    For resources where even the existence of a record is privileged: user
    administration, buying prices, supplier/party records, sales reports,
    audit logs.
    """

    message = "Staff credentials are required to access this resource."

    def has_permission(self, request, view):
        return _is_staff(request.user)

    def has_object_permission(self, request, view, obj):
        return _is_staff(request.user)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Anyone reads. Only the object's owner writes.

    Set `owner_field` on the view to point at the FK holding the owner when it
    is not named `user`:

        class ReviewViewSet(ModelViewSet):
            permission_classes = [IsOwnerOrReadOnly]
            owner_field = "author"

    Supports dotted paths for indirect ownership:

        class OrderItemViewSet(ModelViewSet):
            permission_classes = [IsOwnerOrReadOnly]
            owner_field = "order.user"
    """

    message = "You may only modify your own records."
    default_owner_field = "user"

    def _owner(self, view, obj):
        field = getattr(view, "owner_field", self.default_owner_field)
        value = obj
        for part in field.split("."):
            value = getattr(value, part, None)
            if value is None:
                return None
        return value

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        # Ownership is a per-object question, but an anonymous user can never
        # own anything — reject early rather than letting an AnonymousUser reach
        # the object check.
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = self._owner(view, obj)
        # Fail closed. An unresolvable owner field is a bug, and a bug must not
        # read as "permitted" — that is exactly how S6 happened.
        if owner is None:
            return False
        return owner == request.user


class IsStaffOrOwner(permissions.BasePermission):
    """The owner, or any staff member. Reads included.

    For records that belong to a customer but that staff must also service:
    orders, addresses, support threads. A customer sees only their own; staff
    see all.

    IMPORTANT: this class does not filter list routes. Pair it with queryset
    scoping:

        def get_queryset(self):
            qs = Order.objects.all()
            if not (self.request.user.is_staff or self.request.user.is_superuser):
                qs = qs.filter(user=self.request.user)
            return qs

    Without that, `GET /orders/` returns every customer's orders.
    """

    message = "You may only access your own records."
    default_owner_field = "user"

    def _owner(self, view, obj):
        field = getattr(view, "owner_field", self.default_owner_field)
        value = obj
        for part in field.split("."):
            value = getattr(value, part, None)
            if value is None:
                return None
        return value

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if _is_staff(request.user):
            return True
        owner = self._owner(view, obj)
        if owner is None:
            return False
        return owner == request.user


class IsAdminOrWriteOnly(permissions.BasePermission):
    """Anyone may create. Only staff may read, update or delete.

    For inbound-only endpoints: contact form submissions, newsletter signups,
    callback requests. Prevents the common mistake of exposing a submissions
    list publicly because the create endpoint had to be open.
    """

    message = "Staff credentials are required to read submissions."

    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        return _is_staff(request.user)

    def has_object_permission(self, request, view, obj):
        return _is_staff(request.user)


def HasRole(*roles, allow_staff=True, role_field="role"):
    """Permission-class factory gating on a named role.

    `is_staff` is a boolean and cannot express "inventory manager may adjust
    stock but may not change selling prices". Named roles can.

        class GodownReceiveViewSet(ModelViewSet):
            permission_classes = [HasRole("inventory_manager")]

        class SalesReportView(APIView):
            permission_classes = [HasRole("showroom_manager", "admin")]

    allow_staff=True (default) means superusers and staff always pass. Set it to
    False for a role that must be exclusive even of admins — rare, and usually a
    smell, but occasionally correct for separation-of-duty controls.
    """

    normalized = tuple(roles)

    class _HasRole(permissions.BasePermission):
        message = f"This resource requires one of the following roles: {', '.join(normalized)}."

        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if allow_staff and _is_staff(user):
                return True
            return getattr(user, role_field, None) in normalized

        def has_object_permission(self, request, view, obj):
            return self.has_permission(request, view)

    _HasRole.__name__ = "HasRole_" + "_".join(normalized)
    _HasRole.__qualname__ = _HasRole.__name__
    return _HasRole


class IsAuthenticatedAndVerified(permissions.BasePermission):
    """Authenticated AND email-verified.

    For actions that must not be reachable by an unverified signup: placing an
    order, requesting a refund, changing a payout detail. Assumes an
    `is_email_verified` boolean on the user model; adjust the attribute name if
    yours differs.
    """

    message = "Verify your email address to continue."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(getattr(user, "is_email_verified", False))


# ---------------------------------------------------------------------------
# Anti-pattern reference. Do not copy the class below — it is here so the shape
# is recognisable in review.
#
# class IsAdminOrReadOnlyForIsActive(permissions.BasePermission):   # S6, WRONG
#     def has_permission(self, request, view):
#         return True                       # <-- gate is wide open
#
#     def has_object_permission(self, request, view, obj):
#         if request.method in ("PUT", "PATCH") and "is_active" in request.data:
#             return request.user.is_staff
#         return True                       # <-- DELETE lands here. Permitted.
#
# Two defects, both fatal:
#   1. `has_permission` returning an unconditional True means the class provides
#      no view-level protection at all.
#   2. The object check falls through to True for every method it does not name.
#      A permission class must fail closed: enumerate what is allowed and deny
#      the rest, never enumerate what is denied and allow the rest.
# ---------------------------------------------------------------------------
