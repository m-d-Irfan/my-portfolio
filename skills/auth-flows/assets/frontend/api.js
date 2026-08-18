/**
 * api.js — the single axios instance, with token handling and refresh.
 *
 * Copy to `src/services/api.js`. Every request in the app goes through this.
 *
 * TOKEN STRATEGY (see references/01-token-strategy.md for the full tradeoff):
 *
 *   Default, recommended — AUTH_MODE = 'cookie'
 *     Refresh token lives in an httpOnly + Secure + SameSite cookie the browser
 *     manages and JavaScript cannot read. Access token lives in a module
 *     variable — memory only, gone on refresh, re-obtained silently.
 *     An XSS can make requests as the user while the page is open. It cannot
 *     steal a durable credential.
 *
 *   Opt-out — AUTH_MODE = 'localstorage'
 *     Both tokens in localStorage. Simpler, survives a tab refresh with no
 *     round-trip, and this is what the project does today.
 *     THE COST, stated plainly: any XSS — yours, or in any npm package you
 *     ship — reads both tokens and exfiltrates them. The refresh token is a
 *     long-lived credential; the attacker keeps access after the user closes
 *     the tab, changes networks, or reboots. HTTPS does not help. HttpOnly is
 *     the only control that makes the token unreadable to script.
 *
 * Set VITE_AUTH_MODE in .env. Anything other than 'localstorage' means cookie.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const AUTH_MODE =
  import.meta.env.VITE_AUTH_MODE === "localstorage" ? "localstorage" : "cookie";

/** Access token, memory only in cookie mode. Never persisted there. */
let accessToken = null;

export const getAccessToken = () =>
  AUTH_MODE === "localstorage"
    ? localStorage.getItem("access_token")
    : accessToken;

export const setAccessToken = (token) => {
  if (AUTH_MODE === "localstorage") {
    if (token) localStorage.setItem("access_token", token);
    else localStorage.removeItem("access_token");
  } else {
    accessToken = token;
  }
  // Tells VerifiedUserProvider to re-run GET /auth/me/. Roles must be re-read
  // from the server after any token change — a rotation may follow a role
  // change, and the old token's claims are stale.
  window.dispatchEvent(new Event("tokens-updated"));
};

/**
 * Wipe every trace of the session.
 *
 * `user` is included deliberately: leaving a stale cached user behind is how a
 * logged-out browser still renders a name in the header, and how a tampered
 * `is_staff` survives a logout (S8).
 */
export const clearAuthState = () => {
  accessToken = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("tokens-updated"));
};

const api = axios.create({
  baseURL: BASE_URL,
  // Required in cookie mode so the browser sends the httpOnly refresh cookie.
  // Harmless in localstorage mode. The server must name this exact origin in
  // CORS_ALLOWED_ORIGINS — CORS_ALLOW_ALL_ORIGINS cannot be combined with
  // credentials.
  withCredentials: AUTH_MODE === "cookie",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Django's CSRF check applies to cookie-authenticated session views. Echo the
  // cookie back in the header; SameSite=Lax alone does not cover every case.
  if (AUTH_MODE === "cookie" && !/^(GET|HEAD|OPTIONS)$/i.test(config.method || "")) {
    const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (csrf) config.headers["X-CSRFToken"] = decodeURIComponent(csrf[1]);
  }
  return config;
});

/* ------------------------------------------------------------------ *
 * Refresh: single-flight per tab, coordinated across tabs.
 *
 * Without a queue, a page that fires six requests on mount gets six 401s and
 * launches six refreshes. With ROTATE_REFRESH_TOKENS on, the first rotation
 * invalidates the token the other five are using, so five fail, the queue
 * clears the session, and the user is thrown to /login for no reason. This is
 * a real and commonly-reported bug — the queue is not an optimisation.
 *
 * The queue is a MODULE variable, so it is per-tab. Two open tabs are two
 * independent queues: tab A rotates, blacklists the token tab B holds, and
 * tab B logs out on its next refresh. `localstorage` mode fixes this by
 * sharing the rotated token through a storage event (below). Cookie mode is
 * immune — the browser owns one cookie jar for every tab.
 *
 * See references/09-session-longevity.md for the full symptom → cause table.
 * ------------------------------------------------------------------ */

let isRefreshing = false;
let waiters = [];

const drain = (error, token = null) => {
  waiters.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  waiters = [];
};

/**
 * Did the refresh fail because the credential is genuinely dead, or because
 * the network was briefly unavailable?
 *
 * This distinction IS the difference between a correct session and one that
 * drops users at random. A 15s timeout on a phone that walked into a lift is
 * not a logout. Only the server saying "this token is invalid" is.
 */
const isCredentialRejection = (err) => {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return true;
  // No refresh token to send at all — nothing to recover from.
  if (err?.code === "NO_REFRESH_TOKEN") return true;
  return false;
};

if (AUTH_MODE === "localstorage" && typeof window !== "undefined") {
  // Another tab rotated. Adopt its access token instead of refreshing again
  // with a refresh token that is now blacklisted.
  window.addEventListener("storage", (e) => {
    if (e.key === "access_token" && e.newValue) {
      window.dispatchEvent(new Event("tokens-updated"));
      if (isRefreshing) drain(null, e.newValue);
    }
  });
}

const refreshAccessToken = async () => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }
  isRefreshing = true;

  try {
    // Bare axios, not `api` — using the instance would recurse through this
    // same interceptor on failure.
    const body =
      AUTH_MODE === "localstorage"
        ? { refresh: localStorage.getItem("refresh_token") }
        : {}; // cookie mode: the browser attaches the refresh cookie itself

    if (AUTH_MODE === "localstorage" && !body.refresh) {
      throw Object.assign(new Error("No refresh token stored."), {
        code: "NO_REFRESH_TOKEN",
      });
    }

    const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, body, {
      withCredentials: AUTH_MODE === "cookie",
      timeout: 15000,
    });

    const next = data.access || data.access_token;
    if (!next) throw new Error("Refresh response contained no access token.");

    // Rotation: SimpleJWT issues a new refresh token and blacklists the old
    // one. Persist the new one FIRST — if this write is skipped or fails, the
    // next refresh presents a blacklisted token and the user is logged out.
    if (AUTH_MODE === "localstorage" && (data.refresh || data.refresh_token)) {
      localStorage.setItem("refresh_token", data.refresh || data.refresh_token);
    }
    setAccessToken(next);

    drain(null, next);
    return next;
  } catch (err) {
    drain(err, null);
    // Only end the session when the credential itself was rejected. Clearing
    // on a timeout or a 502 is the single most common cause of "it logs me out
    // every so often" — and it is indistinguishable from a token bug in a bug
    // report, so it survives for months.
    if (isCredentialRejection(err)) clearAuthState();
    throw err;
  } finally {
    isRefreshing = false;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // No response at all: offline, DNS failure, CORS rejection, timeout.
    // Do NOT clear the session — a flaky connection is not a logout.
    if (!error.response) {
      return Promise.reject(
        Object.assign(error, {
          normalized: {
            kind: "network",
            message: "Could not reach the server. Check your connection.",
          },
        })
      );
    }

    if (status === 401 && original && !original._retried) {
      // Never try to refresh the refresh call itself.
      if (original.url?.includes("/auth/token/refresh/")) {
        clearAuthState();
        return Promise.reject(error);
      }
      // A 401 on login or registration means "wrong password", not "expired
      // session". Refreshing here would clear the tokens of a user who is
      // already signed in on another tab and simply mistyped. Fall through to
      // the normalizer so the form shows the error.
      if (!/\/auth\/(login|registration|token\/verify)\//.test(original.url || "")) {
        original._retried = true;
        try {
          const token = await refreshAccessToken();
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        } catch (refreshErr) {
          // Session is genuinely over. Do NOT window.location.href here — a
          // hard reload destroys unsaved work and any in-flight state.
          // clearAuthState dispatches 'tokens-updated'; VerifiedUserProvider
          // flips to 'unauthenticated' and ProtectedRoute navigates with the
          // router, preserving `from` so the user returns where they were.
          //
          // If the refresh failed on the NETWORK, the session was left intact
          // on purpose. Surface it as a network error so the UI can offer a
          // retry rather than bouncing the user to /login.
          if (!refreshErr?.response) {
            return Promise.reject(
              Object.assign(refreshErr, {
                normalized: {
                  kind: "network",
                  message: "Lost connection while renewing your session. Retrying may work.",
                },
              })
            );
          }
          return Promise.reject(refreshErr);
        }
      }
    }

    // One error shape for the whole app, so forms and toasts do not each
    // reimplement DRF's response parsing.
    const data = error.response.data;
    error.normalized = {
      kind:
        status === 403
          ? "forbidden"
          : status === 404
          ? "not_found"
          : status === 429
          ? "throttled"
          : status >= 500
          ? "server"
          : "validation",
      status,
      // DRF returns {detail: "..."} for permission and throttle errors, and
      // {field: ["msg"]} for serializer validation.
      message:
        data?.detail ||
        data?.message ||
        (status === 429
          ? "Too many attempts. Please wait and try again."
          : status >= 500
          ? "Something went wrong on our end."
          : "Please check the form and try again."),
      fields:
        data && typeof data === "object" && !data.detail
          ? Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
            )
          : {},
      // Seconds to wait, when the server sends Retry-After on a 429.
      retryAfter: Number(error.response.headers?.["retry-after"]) || null,
    };
    return Promise.reject(error);
  }
);

export default api;
