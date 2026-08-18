/**
 * useVerifiedUser — server-verified identity for the React app.
 *
 * Copy to `src/authentication/useVerifiedUser.jsx`.
 *
 * Background — S8. The app trusted `localStorage.user.is_staff` for admin
 * routing. Anyone could run this in the browser console:
 *
 *     let u = JSON.parse(localStorage.getItem('user'));
 *     u.is_staff = true; u.is_superuser = true;
 *     localStorage.setItem('user', JSON.stringify(u));
 *
 * and refresh into the full admin panel.
 *
 * THE RULE: localStorage is a cache for display. It is never an authority.
 * A role check is a server round-trip or it is not a role check.
 *
 * This module asks `GET /auth/me/`, which resolves the user from the verified
 * JWT signature server-side. A tampered cache produces `is_staff: false` here
 * and we force a logout.
 *
 * Architecture: one provider near the root fetches once and shares the result.
 * Do NOT call the fetch inside each ProtectedRoute — that fires a request per
 * route mount and makes every navigation wait on the network.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { clearAuthState } from "../services/api";

/** 'verifying' -> in flight. 'verified' -> server confirmed. 'unauthenticated' -> no valid session. */
const VerifiedUserContext = createContext(null);

const hasToken = () => Boolean(localStorage.getItem("access_token"));

export const VerifiedUserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Start at 'verifying' only when a token exists. With no token there is
  // nothing to verify and we should not flash a loading state on the public
  // storefront.
  const [status, setStatus] = useState(() =>
    hasToken() ? "verifying" : "unauthenticated"
  );

  // Guards against a late response from a previous session overwriting the
  // current one — e.g. verify starts, user logs out, stale 200 lands.
  const requestId = useRef(0);

  const verify = useCallback(async () => {
    const id = ++requestId.current;

    if (!hasToken()) {
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }

    setStatus("verifying");
    try {
      const { data } = await api.get("/auth/me/");
      if (id !== requestId.current) return null; // superseded

      setUser(data);
      setStatus("verified");

      // Overwrite the cache with server truth. This is what actively undoes
      // tampering: even if someone edits localStorage, the next verify resets
      // it to what the database says.
      localStorage.setItem("user", JSON.stringify(data));
      return data;
    } catch (err) {
      if (id !== requestId.current) return null;

      const code = err?.response?.status;

      // 401 — token missing, expired, malformed or blacklisted.
      // 403 — account deactivated.
      // Both mean: this session is over. Clear everything.
      if (code === 401 || code === 403) {
        clearAuthState();
        setUser(null);
        setStatus("unauthenticated");
        return null;
      }

      // Network error or 5xx. NOT an authorisation failure — do not clear the
      // session over a flaky connection. But do not grant access either: fail
      // closed, leave the cached user unused, and let the caller retry.
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  // Re-verify whenever tokens change: login, logout, refresh rotation, or a
  // change in another tab. `tokens-updated` is dispatched by services/api.js.
  useEffect(() => {
    const onChange = () => verify();
    window.addEventListener("tokens-updated", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("tokens-updated", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [verify]);

  const value = useMemo(
    () => ({
      user,
      status,
      isVerifying: status === "verifying",
      isVerified: status === "verified",
      /** Named-role check. Reads the server-issued roles array, never a cached boolean. */
      hasRole: (...roles) => {
        if (status !== "verified" || !user) return false;
        if (user.is_superuser) return true;
        const owned = new Set(user.roles || []);
        return roles.some((r) => owned.has(r));
      },
      /** Capability check against the server-issued permissions map. */
      can: (capability) => {
        if (status !== "verified" || !user) return false;
        return Boolean(user.permissions?.[capability]);
      },
      refresh: verify,
    }),
    [user, status, verify]
  );

  return (
    <VerifiedUserContext.Provider value={value}>
      {children}
    </VerifiedUserContext.Provider>
  );
};

export const useVerifiedUser = () => {
  const ctx = useContext(VerifiedUserContext);
  if (ctx === null) {
    // Fail loudly. Returning a default here would silently report
    // 'unauthenticated' for every route and look like a login bug, or worse,
    // a default of 'verified' would be a security hole.
    throw new Error(
      "useVerifiedUser must be used inside <VerifiedUserProvider>. " +
        "Mount it above your router in App.jsx."
    );
  }
  return ctx;
};

export default useVerifiedUser;
