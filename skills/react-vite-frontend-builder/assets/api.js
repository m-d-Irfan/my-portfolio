/**
 * The single axios instance. Every request in the app goes through this file.
 *
 * Copy to `src/services/api.js`.
 *
 * Responsibilities:
 *   - inject the access token
 *   - refresh once for N concurrent 401s (single-flight)
 *   - normalise DRF error shapes into `error.normalized`
 *   - clear session state without a hard page reload
 *
 * A raw `fetch()` or a second axios instance bypasses all four. See
 * references/02-api-client.md.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// ---------------------------------------------------------------------------
// Token storage
//
// localStorage is readable by any script on the origin, so an XSS exfiltrates
// both tokens. Accepted here for a cross-origin SPA; prefer an httpOnly cookie
// for the refresh token on anything handling payments. Either way, roles are
// NEVER read from here — they come from GET /auth/me/. See
// references/03-auth-and-routing.md (S8).
// ---------------------------------------------------------------------------

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const setTokens = ({ access, refresh }) => {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  window.dispatchEvent(new Event("tokens-updated"));
};

export const clearAuthState = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("user");
  // The auth provider listens for this and flips to unauthenticated, letting
  // ProtectedRoute navigate with the router. No window.location.href — that
  // reload destroys unsaved form state and in-flight requests.
  window.dispatchEvent(new Event("tokens-updated"));
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // FormData sets its own multipart boundary. Leaving our JSON default in place
  // produces a boundary-less header the server cannot parse.
  if (config.data instanceof FormData) delete config.headers["Content-Type"];

  return config;
});

// ---------------------------------------------------------------------------
// Refresh: single-flight
//
// Six components mounting at once produce six 401s. Without a queue each fires
// its own refresh; with ROTATE_REFRESH_TOKENS on, the first rotation invalidates
// the token the other five hold, so five fail and the user is logged out while
// genuinely logged in.
// ---------------------------------------------------------------------------

let isRefreshing = false;
let waiters = [];

const settleWaiters = (err, token) => {
  waiters.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  waiters = [];
};

const refreshAccessToken = async () => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }

  const refresh = getRefreshToken();
  if (!refresh) {
    const err = new Error("No refresh token");
    clearAuthState();
    throw err;
  }

  isRefreshing = true;
  try {
    // Bare axios, not `api` — using the instance would send this request back
    // through this same interceptor.
    const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
    setTokens({ access: data.access, refresh: data.refresh });
    settleWaiters(null, data.access);
    return data.access;
  } catch (err) {
    settleWaiters(err);
    clearAuthState();
    throw err;
  } finally {
    isRefreshing = false;
  }
};

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

const REFRESH_PATH = "/auth/token/refresh/";

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    // No response at all: offline, DNS failure, CORS rejection, or timeout.
    if (!response) {
      error.normalized = {
        kind: error.code === "ECONNABORTED" ? "timeout" : "network",
        status: 0,
        message: "Could not reach the server. Check your connection and try again.",
        fields: {},
      };
      return Promise.reject(error);
    }

    const { status, data } = response;

    // 401: refresh once, then replay. Never refresh the refresh endpoint —
    // if that 401s the session is over, and retrying recurses.
    if (
      status === 401 &&
      config &&
      !config._retried &&
      !config.url?.includes(REFRESH_PATH)
    ) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        // Fall through to normalisation below; the session is already cleared.
      }
    }

    error.normalized = normalizeError(status, data);
    return Promise.reject(error);
  }
);

/**
 * Flatten DRF's several error shapes into one.
 *
 * DRF returns {detail}, {field: [msg]}, or {non_field_errors: [...]} depending
 * on what failed. Normalising once here means no call site parses four cases,
 * and `fields` drops straight into form state.
 */
function normalizeError(status, data) {
  const out = { kind: "server", status, message: "Something went wrong.", fields: {} };

  if (status === 400 && data && typeof data === "object") {
    out.kind = "validation";
    for (const [key, value] of Object.entries(data)) {
      out.fields[key] = Array.isArray(value) ? value.join(" ") : String(value);
    }
    out.message =
      out.fields.non_field_errors ||
      out.fields.detail ||
      "Please check the highlighted fields.";
    return out;
  }

  if (status === 401) {
    out.kind = "unauthenticated";
    out.message = "Your session has expired. Please sign in again.";
    return out;
  }

  if (status === 403) {
    out.kind = "forbidden";
    // A 403 from a tampered client-side guard lands here: the UI rendered, the
    // server refused. That is the server doing its job.
    out.message = data?.detail || "You do not have permission to do that.";
    return out;
  }

  if (status === 404) {
    out.kind = "not_found";
    out.message = data?.detail || "That item could not be found.";
    return out;
  }

  if (status === 429) {
    out.kind = "throttled";
    // Surface this and disable the control. NEVER auto-retry — automatic retry
    // is exactly what the throttle exists to stop.
    const seconds = Number(data?.retry_after) || 60;
    out.retryAfter = seconds;
    out.message = `Too many attempts. Try again in ${seconds} seconds.`;
    return out;
  }

  if (status >= 500) {
    out.kind = "server";
    // Never surface a server message verbatim — with DEBUG on it contains
    // tracebacks and query text.
    out.message = "The server had a problem. Please try again shortly.";
    return out;
  }

  if (data?.detail) out.message = data.detail;
  return out;
}

export default api;
