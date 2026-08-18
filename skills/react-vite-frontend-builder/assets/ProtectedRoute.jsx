/**
 * Route guard. Gates on server-verified identity.
 *
 * Copy to `src/components/ProtectedRoute.jsx`.
 *
 *   <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
 *   <Route path="/admin/*"  element={<ProtectedRoute requireStaff><AdminShell /></ProtectedRoute>} />
 *
 * This is a UX affordance, NOT the security boundary. It stops the app showing
 * a screen that will 403. The actual control is `permission_classes` on every
 * endpoint — see security-hardening/references/01-permissions.md. If a tampered
 * client renders the admin shell but every request 403s and no data appears,
 * that is ugly, not a breach. If the data loads, the server was never checking.
 */

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

function FullPageSpinner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center"
    >
      <span className="sr-only">Checking your session…</span>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>
  );
}

export default function ProtectedRoute({ children, requireStaff = false }) {
  const { status, user } = useAuth();
  const location = useLocation();

  // Still asking the server. Rendering children here would flash protected UI;
  // redirecting here would bounce a legitimately logged-in user on every
  // refresh. Wait.
  if (status === "loading") return <FullPageSpinner />;

  if (status === "anon") {
    // `from` lets the login page return the user where they were headed.
    // `replace` keeps the guarded URL out of history, so Back does not loop.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // `user` is a /auth/me/ response body, so this is the server's answer.
  if (requireStaff && !user?.is_staff) {
    // Home, not /login. This user IS authenticated — sending them to a login
    // page implies different credentials would help and loops for someone
    // already signed in.
    return <Navigate to="/" replace />;
  }

  return children;
}
