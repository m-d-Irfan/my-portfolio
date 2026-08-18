# Roles and scopes

The project's four roles, what each may do, and how to express that in code.

## The permission matrix

Rows are resources; columns are roles. This table is the contract — the
permission classes in
[`security-hardening`](../../security-hardening/references/01-permissions.md)
implement it, and `/auth/me/` reports it.

| Resource | customer | showroom_manager | inventory_manager | admin |
|---|---|---|---|---|
| Products (browse) | read | read | read | read |
| Products (create/edit/delete) | — | — | — | write |
| Selling price (`mainPrice`, `discountedPrice`) | read | read | read | write |
| **Buying price** (`buying_price`) | — | — | read | write |
| Categories, Brands | read | read | read | write |
| Product images / attributes / colors | read | read | read | write |
| Own orders | own | own | own | own |
| All orders | — | read | — | write |
| Order status change | — | write | — | write |
| Dispatch to courier | — | write | — | write |
| Own reviews | own | own | own | own |
| Review moderation | — | write | — | write |
| Users & staff | own profile | — | — | write |
| Role assignment | — | — | — | **superuser only** |
| Godown receive (stock in) | — | — | write | write |
| Godown dispatch (stock out) | — | — | write | write |
| Stock quantity adjustment | — | — | write | write |
| Parties / suppliers | — | — | write | write |
| Internal product names (`inv_name`) | — | — | write | write |
| Sales reports | — | read | — | read |
| Inventory reports | — | — | read | read |
| Audit log | — | — | — | read |

`own` means the row is filtered to `user=request.user`, enforced in
`get_queryset()` — see
[django-backend-builder/05-viewsets.md](../../django-backend-builder/references/05-viewsets.md).

Two entries carry most of the design:

- **`buying_price` is invisible to `showroom_manager`.** A showroom manager sells
  and needs the selling price; the margin is not theirs to see. This is the
  clearest case for named roles.
- **`inventory_manager` may move stock but may not change price.** A boolean
  cannot express this at all.

## Why `is_staff` is not enough

```python
# The tempting version.
if user.is_staff:
    ...
```

`is_staff` is one bit. It can express "privileged" and nothing else. The matrix
above needs at least:

- May see cost prices (inventory_manager, admin)
- May change selling prices (admin only)
- May move stock (inventory_manager, admin)
- May see all orders (showroom_manager, admin)
- May assign roles (superuser only)

Encoding that in one boolean means either giving inventory managers full admin —
which is what happens in practice — or scattering `if user.email in [...]`
checks through the codebase.

## The shape

Keep `is_staff` (Django's admin site and a lot of third-party code depend on it)
and **derive** it from an explicit role.

```python
class Role(models.TextChoices):
    CUSTOMER = "customer", "Customer"
    SHOWROOM_MANAGER = "showroom_manager", "Showroom manager"
    INVENTORY_MANAGER = "inventory_manager", "Inventory manager"
    ADMIN = "admin", "Admin"


class CustomUser(AbstractUser):
    role = models.CharField(
        max_length=32, choices=Role.choices, default=Role.CUSTOMER, db_index=True
    )

    # Roles that get Django-admin access. Inventory managers use the custom
    # /inventory portal, not /django-admin.
    STAFF_ROLES = {Role.SHOWROOM_MANAGER, Role.INVENTORY_MANAGER, Role.ADMIN}

    def save(self, *args, **kwargs):
        # Derived, never set by hand. Two sources of truth for "is this person
        # staff" will disagree, and the disagreement will be a security bug.
        if not self.is_superuser:
            self.is_staff = self.role in self.STAFF_ROLES
        super().save(*args, **kwargs)
```

Then gate with `HasRole` from the security-hardening assets:

```python
from api.permissions import HasRole, IsAdminOnly

class GodownReceiveViewSet(viewsets.ModelViewSet):
    permission_classes = [HasRole("inventory_manager")]     # admin passes too

class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOnly]
```

## Hiding a field by role

`buying_price` must not appear in a showroom manager's payload. Filtering it in
the frontend is not hiding it — the value is in the response and visible in
devtools.

```python
class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ["id", "size", "mainPrice", "discountedPrice",
                  "stock_quantity", "buying_price"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = self.context["request"].user
        may_see_cost = user.is_authenticated and (
            user.is_superuser or user.role in {"inventory_manager", "admin"}
        )
        if not may_see_cost:
            data.pop("buying_price", None)
        return data
```

For anything more than one or two fields, use separate serializers instead —
`to_representation` runs on every row, and a chain of role checks inside it is
both slow and easy to get wrong.

## Role assignment is privileged and audited

```python
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "is_staff", "is_active"]
        # Never writable through the ordinary user endpoint, and NEVER through
        # registration. A registration serializer that publishes `role` is
        # one-line self-service privilege escalation.
        read_only_fields = ["is_staff", "role"]
```

Role changes go through a dedicated superuser-only action that writes an audit
record:

```python
    @action(detail=True, methods=["post"], permission_classes=[IsSuperUser])
    def set_role(self, request, pk=None):
        target = self.get_object()
        new_role = request.data.get("role")
        if new_role not in Role.values:
            return Response({"role": "Unknown role."}, status=400)

        old_role = target.role
        target.role = new_role
        target.save()                      # save() re-derives is_staff
        target.revoke_all_sessions()       # the old token still claims the old role

        AuditLog.objects.create(
            actor=request.user, action="user.role_changed", target=f"user:{target.pk}",
            before={"role": old_role}, after={"role": new_role},
            ip=_client_ip(request),
        )
        return Response({"detail": f"Role set to {new_role}."})
```

`revoke_all_sessions()` is the part people forget. Without it the demoted user
keeps their old access for the full token lifetime — see
[06-session-revocation.md](./06-session-revocation.md).

## The frontend side

`/auth/me/` returns `roles` and a `permissions` map. The frontend gates on those,
never on a cached boolean:

```jsx
<ProtectedRoute roles={['admin', 'staff']}>          {/* /admin/* */}
<ProtectedRoute capability="can_access_inventory">   {/* /inventory/* */}

<RequireCapability capability="can_view_buying_price">
  <td>{attr.buying_price}</td>
</RequireCapability>
```

The `permissions` map is presentation only. Every entry has a server-side
counterpart in the permission classes, and when they disagree the server is
right. Hiding a column is a courtesy; not sending the field is the control.

## Verification

```bash
# A showroom manager must not receive buying_price.
curl -s localhost:8000/api/products/1/ -H "Authorization: Bearer $SHOWROOM_TOKEN" \
  | grep -c buying_price
# expect: 0

# An inventory manager may receive stock but not change a price.
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:8000/api/product-attributes/1/ \
  -H "Authorization: Bearer $INVENTORY_TOKEN" -H 'Content-Type: application/json' \
  -d '{"mainPrice":"1.00"}'
# expect: 403

curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/godown-receive/ \
  -H "Authorization: Bearer $INVENTORY_TOKEN" -H 'Content-Type: application/json' -d '{...}'
# expect: 201

# Registration cannot set a role.
curl -s -X POST localhost:8000/api/register/ -H 'Content-Type: application/json' \
  -d '{"email":"x@y.com","password":"correct-horse-battery","role":"admin"}' \
  | python -c "import sys,json;print(json.load(sys.stdin).get('role'))"
# expect: customer

# is_staff is derived, not divergent.
python manage.py shell -c "
from api.models import CustomUser as U
bad = [u.email for u in U.objects.all()
       if not u.is_superuser and u.is_staff != (u.role in U.STAFF_ROLES)]
print('divergent:', bad)"
# expect: []
```

## Common mistakes

- Using `is_staff` for everything, then discovering it cannot express the
  inventory/pricing split.
- Storing the role only in the JWT. It is a snapshot; use `/auth/me/`.
- Letting `role`, `is_staff` or `is_superuser` be writable on any serializer a
  non-superuser can reach.
- Setting `is_staff` by hand alongside `role`. Two sources of truth.
- Changing a role without revoking sessions.
- Hiding a sensitive field in the frontend while the API still returns it.
- Adding a fifth role instead of a capability. Roles are coarse; if a
  distinction is about one action, a capability flag is usually the better tool.
