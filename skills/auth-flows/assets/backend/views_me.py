"""GET /auth/me/ — the only sanctioned source of role truth.

Copy to `api/views_me.py` and wire in urls.py:

    from api.views_me import CurrentUserView
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),

Background — S8. The frontend trusted `localStorage.user.is_staff` for admin
routing. Anyone could open the browser console and run:

    let u = JSON.parse(localStorage.getItem('user'));
    u.is_staff = true; u.is_superuser = true;
    localStorage.setItem('user', JSON.stringify(u));

then refresh into the full admin panel. AdminLayout.jsx and InventoryLayout.jsx
both redirected on `!user.is_staff` read from localStorage — cosmetic only. The
JWT was the one tamper-proof artifact in the browser (it is server-signed), and
neither layout ever validated it.

This view closes that. It resolves the user from the *verified* JWT, so the
response reflects the database, not the client's copy of it. A tampered
localStorage produces `is_staff: false` here and the frontend force-logs-out.

This is defence in depth, NOT a substitute for API-side permissions. If the API
itself is open (S1/S2), hiding the admin UI changes nothing — an attacker skips
the UI and calls the endpoint. Fix both.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()


class CurrentUserSerializer(serializers.ModelSerializer):
    """Identity and authorisation facts for the authenticated user.

    Keep this lean. It is fetched on every protected page mount, so it is a hot
    endpoint, and every field here is a field the client can see about itself.
    Never expose password hashes, OTP codes, internal notes or other users' data.
    """

    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "profile_picture",
            "is_staff",
            "is_superuser",
            "is_active",
            "role",
            "roles",
            "permissions",
            "date_joined",
        ]
        # Belt and braces: this endpoint is GET-only, but if someone later adds
        # a PATCH to it, these must not become client-writable. Privilege
        # escalation by PATCH /auth/me/ {"is_staff": true} is a classic.
        read_only_fields = fields

    def get_roles(self, obj):
        """Normalised role list. The frontend matches against this, not is_staff.

        `is_staff` is a boolean and cannot express "inventory manager may adjust
        stock but may not change selling prices". Emitting an explicit list lets
        ProtectedRoute gate on a named role without the frontend reimplementing
        the derivation.
        """
        roles = []
        role = getattr(obj, "role", None)
        if role:
            roles.append(role)
        if obj.is_staff and "admin" not in roles:
            roles.append("staff")
        if obj.is_superuser and "admin" not in roles:
            roles.append("admin")
        return roles

    def get_permissions(self, obj):
        """Coarse capability flags the UI uses to show or hide affordances.

        Presentation only. Every one of these is re-enforced server-side by the
        permission classes in the security-hardening skill. If this dict and the
        permission classes ever disagree, the permission classes are correct.
        """
        roles = set(self.get_roles(obj))
        is_priv = obj.is_staff or obj.is_superuser
        return {
            "can_access_admin": bool(is_priv),
            "can_access_inventory": bool(is_priv or "inventory_manager" in roles),
            "can_manage_catalog": bool(is_priv),
            "can_manage_users": bool(obj.is_superuser),
            "can_adjust_stock": bool(is_priv or "inventory_manager" in roles),
            "can_view_buying_price": bool(is_priv or "inventory_manager" in roles),
            "can_view_reports": bool(is_priv or "showroom_manager" in roles),
        }


class CurrentUserView(APIView):
    """Return the authenticated user, resolved from the verified token.

    401 if the token is missing, expired, malformed or blacklisted — DRF's
    JWTAuthentication handles that before this method runs.
    403 if the account has since been deactivated.

    Both are meaningful to the client: 401 means "log in again", 403 means
    "your account is gone" and must clear local state.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # A deactivated user may still hold an unexpired access token. Reject
        # explicitly rather than returning a happy payload for a disabled
        # account.
        if not user.is_active:
            return Response(
                {"detail": "This account is no longer active."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = CurrentUserSerializer(user, context={"request": request}).data

        response = Response(data)
        # Never cache an identity response. Without this, a shared proxy or the
        # browser's bfcache can serve one user's identity to the next visitor on
        # the same machine.
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response
