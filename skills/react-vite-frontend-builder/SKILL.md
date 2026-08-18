---
name: react-vite-frontend-builder
description: Build or extend a React + Vite frontend — project setup, the axios API client with token refresh, auth context and route guards, code splitting, cart and client state. Use when scaffolding a Vite React app, adding a page or route, fixing API/auth/token-refresh wiring, splitting bundles, or working on cart and context state. Covers Tailwind setup, environment variables, and error handling.
---

# React + Vite frontend builder

Builds React 18 + Vite frontends for a Django REST backend: axios with refresh,
server-verified auth, lazy admin routes, Tailwind.

## Scope

This skill owns **structure and data flow** — how the app is wired, how it talks
to the API, how session and cart state are held.

It does not own visual design, motion, or backend behaviour:

| Need | Skill |
|---|---|
| Login, OTP, password reset, token strategy, `/auth/me/` contract | `auth-flows` |
| Permission classes, what the server actually enforces | `security-hardening` |
| Colour, type, spacing, component design | `ui-design-system` |
| Transitions and micro-interactions | `transitions-dev` |
| Form validation and error display | `forms-and-validation` |
| Bundle budgets, image optimisation, Core Web Vitals | `performance-budget` |
| Endpoint shapes and drift | `api-contract` |
| Admin console layout | `admin-panel-builder` |

## Non-negotiables

Each one is a defect that reached production in this codebase.

1. **Roles come from `GET /auth/me/`.** Never from `localStorage`, never from a
   decoded JWT payload. An admin panel was reachable by typing one line into the
   DevTools console (**S8**).
2. **The client never sends a price.** Checkout sends ids and quantities; the
   server re-fetches and recomputes. A ৳45,000 door was bought for ৳1 (**S5**).
3. **Admin and inventory routes are `lazy()`.** Every anonymous visitor was
   downloading 130 KB of admin code they could never open (**P2**).
4. **Never mutate state.** `arr[i].qty += n` after a shallow copy mutates the
   old state, so `memo` skips the re-render and StrictMode double-applies.
5. **One axios instance.** A raw `fetch` bypasses auth injection, refresh, and
   error normalisation.
6. **No secret in a `VITE_` variable.** They are inlined into the shipped bundle.

## Decision rules

**Where does this state go?**
Local UI → `useState`. Server data → a fetch hook, never mirrored into context.
Session/cart/theme → context, one per concern. Distant + frequent writes → a
store.

**Eager or lazy import?**
Will an anonymous visitor render it? Eager. Otherwise lazy, with `Suspense`
*inside* the guard so the chunk is never fetched by someone who will be
redirected.

**Does this belong in `services/`?**
If it names an endpoint, yes. Components import from `services/`, never
`api` directly.

**New context or prop drilling?**
Fewer than three levels, one consumer → props. Otherwise context.

## Files

Read only what the task needs.

| File | Read when |
|---|---|
| `references/01-project-setup.md` | Scaffolding; aliases, env vars, folder layout |
| `references/02-api-client.md` | Anything touching requests, refresh, or error shape |
| `references/03-auth-and-routing.md` | **Any** auth or guard work. Read before writing a guard |
| `references/04-routing.md` | Adding routes, code splitting, error boundaries |
| `references/05-state-and-cart.md` | Cart, context, or state-update work |
| `assets/api.js` | Copy verbatim |
| `assets/AuthContext.jsx` | Copy verbatim |
| `assets/ProtectedRoute.jsx` | Copy verbatim |
| `checklists/frontend-acceptance.md` | Before declaring frontend work done |

Assets are **copied, not retyped**. The refresh queue and the three-state auth
provider have subtle failure modes that reappear when re-derived from memory.

## Workflow

**New frontend**

1. `references/01-project-setup.md` — scaffold, aliases, `.env.example`.
2. Copy `assets/api.js`.
3. Copy `assets/AuthContext.jsx` and `assets/ProtectedRoute.jsx`; confirm the
   backend exposes `/auth/me/` (from `auth-flows`).
4. Build `routes.jsx` with storefront eager, admin lazy.
5. Add `services/` modules per resource.
6. Cart via reducer, ids and quantities only.
7. Run `checklists/frontend-acceptance.md`.

**Adding a page**

1. Read a neighbouring page first — match its conventions over this skill's.
2. `services/` function → page component → route entry.
3. Loading, empty, and error states before styling. A page without all three is
   not finished.

**Fixing an existing frontend**

Start with `checklists/frontend-acceptance.md`. §3 and §6 find the exploitable
problems fastest.

## Verification

Never report frontend work as done without these.

```bash
npm run build && npm run preview     # preview catches build-only failures
npx vitest run
npx eslint src/

# No secrets shipped.
grep -riE "secret|api_key|password|bkash" dist/assets/*.js
# expect: no output

# Admin code is not in the entry chunk.
grep -l "AdminProducts\|InventoryShell" dist/assets/index-*.js
# expect: no output
```

If auth or the guard changed, run the tampering test in
`checklists/frontend-acceptance.md` §3 — set `is_staff: true` in `localStorage`,
reload, confirm the redirect **and** that every admin request returns 403.
That one is not verifiable by reading code.
