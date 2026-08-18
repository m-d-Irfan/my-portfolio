/**
 * Session provider. The server decides who you are.
 *
 * Copy to `src/context/AuthContext.jsx`.
 *
 * The whole design follows from one rule: roles come from GET /auth/me/, never
 * from localStorage and never from a decoded JWT payload. Audit finding S8 was
 * an admin panel reachable by typing one line into the DevTools console.
 * See references/03-auth-and-routing.md.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api, { clearAuthState, getAccessToken, setTokens } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Three states, not two. Collapsing `loading` into `anon` makes every guard
  // redirect to /login on the first frame, before /auth/me/ has answered — so a
  // logged-in user gets bounced on every hard refresh.
  const [status, setStatus] = useState("loading"); // 'loading' | 'authed' | 'anon'
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = useCallback(() => setRefreshKey((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getAccessToken()) {
        setUser(null);
        setStatus("anon");
        return;
      }

      try {
        // The only source of identity in the app. If localStorage claims admin
        // and this says customer, this wins.
        const { data } = await api.get("/auth/me/");
        if (cancelled) return;
        setUser(data);
        setStatus("authed");
        // Cached for first paint only — a name and avatar while loading. Never
        // read for a role decision.
        localStorage.setItem("user", JSON.stringify(data));
      } catch {
        if (cancelled) return;
        clearAuthState();
        setUser(null);
        setStatus("anon");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Re-verify when tokens change in this tab (login, logout, refresh) and in
  // other tabs. The `storage` event fires only in other tabs, so both are needed.
  useEffect(() => {
    const onTokens = () => bump();
    const onStorage = (e) => {
      if (e.key === "access_token" || e.key === "refresh_token") bump();
    };
    window.addEventListener("tokens-updated", onTokens);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("tokens-updated", onTokens);
      window.removeEventListener("storage", onStorage);
    };
  }, [bump]);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/auth/login/", credentials);
    setTokens({ access: data.access, refresh: data.refresh });
    // Do not trust a user object in the login response either — fetch it.
    const me = await api.get("/auth/me/");
    setUser(me.data);
    setStatus("authed");
    localStorage.setItem("user", JSON.stringify(me.data));
    return me.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Blacklists the refresh token server-side. Without this, a stolen token
      // stays valid for its full lifetime after "logging out".
      await api.post("/auth/logout/", { refresh: localStorage.getItem("refresh_token") });
    } catch {
      // A failed logout call must not trap the user in a session.
    } finally {
      clearAuthState();
      setUser(null);
      setStatus("anon");
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === "authed",
      isLoading: status === "loading",
      // Derived from the server response. Read it from here, never from storage.
      isStaff: Boolean(user?.is_staff),
      login,
      logout,
      refreshUser: bump,
    }),
    [status, user, login, logout, bump]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
