/**
 * ProtectedRoute — gate a route on server-verified identity.
 *
 * Copy to `src/authentication/ProtectedRoute.jsx`.
 *
 *     <Route element={<ProtectedRoute />}>
 *       <Route path="/profile" element={<Profile />} />
 *     </Route>
 *
 *     <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
 *       <Route path="/admin" element={<AdminLayout />}>…</Route>
 *     </Route>
 *
 *     <Route element={<ProtectedRoute capability="can_access_inventory" />}>
 *       <Route path="/inventory" element={<InventoryLayout />}>…</Route>
 *     </Route>
 *
 * Background — S8. The previous guard read `user.is_staff` from a context
 * hydrated from localStorage, so editing one line in the browser console
 * granted the admin panel. This component renders nothing privileged until the
 * server has confirmed who the user is.
 *
 * WRONG — what this replaces:
 *
 *     const { user } = useAuth();                    // hydrated from localStorage
 *     if (!user?.is_staff) return <Navigate to="/" />;
 *     return children;                               // renders on a tampered cache
 *
 * RIGHT — below: gate on status, never on a cached boolean.
 *
 * This is defence in depth, NOT the security boundary. The API must enforce the
 * same rules with permission classes (see the security-hardening skill). If the
 * endpoints are open, hiding the UI accomplishes nothing.
 */

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useVerifiedUser } from "./useVerifiedUser";

/** Replace with the project's skeleton/spinner. Must render NO privileged data. */
const DefaultVerifying = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60vh] items-center justify-center"
  >
    <span className="sr-only">Verifying your session…</span>
    <div
      aria-hidden="true"
      className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40"
    />
  </div>
);

export const ProtectedRoute = ({
  children,
  roles = null,
  capability = null,
  redirectTo = "/login",
  deniedTo = "/",
  fallback = <DefaultVerifying />,
}) => {
  const { status, hasRole, can } = useVerifiedUser();
  const location = useLocation();

  // 1. In flight. Render a neutral placeholder.
  //
  // This branch is the whole fix. The temptation is to render children
  // optimistically from the cached user and correct afterwards — that is
  // exactly S8, because the admin UI mounts, fires its data requests and paints
  // before any correction lands. Wait.
  if (status === "verifying") {
    return fallback;
  }

  // 2. No valid session. Send to login, remembering where they were headed so
  // login can return them after success.
  if (status === "unauthenticated") {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 3. Verified, but insufficient. Distinct destination from the unauthenticated
  // case: this user is legitimately logged in, they just may not be here.
  // Sending them to /login would be an infinite loop.
  if (roles && !hasRole(...roles)) {
    return <Navigate to={deniedTo} replace />;
  }

  if (capability && !can(capability)) {
    return <Navigate to={deniedTo} replace />;
  }

  // 4. Verified and authorised.
  return children ?? <Outlet />;
};

/**
 * Conditionally render an affordance (a button, a nav link, a menu item).
 *
 *     <RequireCapability capability="can_manage_users">
 *       <Link to="/admin/users">Users &amp; Staff</Link>
 *     </RequireCapability>
 *
 * Presentation only. Hiding a button is not access control — the endpoint
 * behind it must enforce the same rule. This exists so the UI does not offer
 * actions that will 403.
 */
export const RequireCapability = ({ capability, roles, children, fallback = null }) => {
  const { status, can, hasRole } = useVerifiedUser();
  if (status !== "verified") return fallback;
  if (capability && !can(capability)) return fallback;
  if (roles && !hasRole(...roles)) return fallback;
  return children;
};

export default ProtectedRoute;
