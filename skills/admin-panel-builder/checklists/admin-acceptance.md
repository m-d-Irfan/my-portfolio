# Admin panel acceptance

Run before declaring admin work done. Every line has a command or a browser
step and a pass condition. Sections 1 and 2 are the ones that catch real
defects; do not skip them because the panel "looks fine".

## 1. Auth boundary

The layout must not decide access.

```bash
grep -rnE "isAdmin|is_staff|Staff Eyes|currentUser\?\." src/pages/Admin/AdminLayout.jsx
# PASS: no output
```

```bash
# The guard wraps the layout, and Suspense is inside it.
grep -n -A3 'path="/admin"' src/routes.jsx
# PASS: ProtectedRoute outermost, then Suspense, then AdminLayout
```

Browser:

1. Log in as a non-staff user, navigate to `/admin`.
   **PASS:** redirected away; no admin shell paints, not even briefly.
2. DevTools → Network → JS, filter `Admin`.
   **PASS:** no admin chunk requested.
3. Console:
   `let u=JSON.parse(localStorage.getItem('user')); u.is_staff=true; localStorage.setItem('user',JSON.stringify(u))`
   then reload `/admin`.
   **PASS:** still redirected. This is audit finding **S8** — if the panel opens,
   stop and fix the guard before anything else.
4. If the shell does render for a tampered client, check the API.
   **PASS:** every admin request returns 403 and no data appears. Ugly, not a
   breach — but the guard is still broken.

## 2. Tokens

```bash
grep -rnE "#[0-9a-fA-F]{3,8}" src/pages/Admin/ src/pages/Inventory/
# PASS: no output
```

```bash
grep -rn "border-gray-\|border-slate-\|bg-white" src/pages/Admin/
# PASS: no output (use --color-border and the surface gradient)
```

Retheme test — the one that proves tokens are real:

1. Set `--color-accent: #0f766e` in `:root`, reload.
   **PASS:** every active nav pill, primary button, hairline and focus ring is
   teal. Anything still brown is a hardcoded literal.
2. Revert.

## 3. The five states

Per list view:

1. Throttle to Slow 3G, reload.
   **PASS:** skeleton rows matching the final column shape; no layout jump when
   data lands.
2. Search for `zzzzzz`.
   **PASS:** empty state naming what is missing and what to do next. Not "No data".
3. Stop the backend, reload.
   **PASS:** error state with a Retry that works once the backend is back.
4. Populated.
   **PASS:** rows render; numbers right-aligned and `tabular-nums`.
5. Trigger a failing mutation (delete as non-superuser).
   **PASS:** table intact, inline or toast error with the server's message.

```bash
grep -rn "animate-pulse\|Skeleton" src/pages/Admin/
# PASS: at least one hit per list view
```

## 4. Pagination and search

```bash
grep -rnE "\.slice\(.*page|filter\(.*search" src/pages/Admin/
# PASS: no output — paging and filtering are server-side (P1)
```

1. Open a list with more than one page, go to page 2, search something.
   **PASS:** resets to page 1.
2. Delete the only row on the last page.
   **PASS:** steps back a page and shows data, not an empty table.
3. Network tab on page 2.
   **PASS:** request carries `?page=2`; response holds one page of rows, not all.

## 5. Delete

1. Click delete.
   **PASS:** confirmation names the record ("Delete Teak Door 900mm?").
2. Cancel.
   **PASS:** row still present, no request sent.
3. Confirm.
   **PASS:** row disappears only after the server responds. No optimistic
   removal, no flicker-back on failure.

## 6. Accessibility

```bash
grep -rn "<button" src/pages/Admin/ | grep -v "aria-label" | grep -iE "Trash|Edit2|Plus|X\b"
# PASS: no output
```

1. Tab from the top of the page to the bottom.
   **PASS:** visible focus on every interactive element; order matches visual
   order; nothing is skipped and nothing is trapped.
2. Every table has a `<caption>` or `aria-label`.
3. Every status badge carries text, not colour alone.
   **PASS:** readable in greyscale.
4. `prefers-reduced-motion: reduce` in DevTools rendering panel.
   **PASS:** transitions effectively stop.

```bash
grep -rn "prefers-reduced-motion" src/styles/
# PASS: one hit
```

## 7. Layout

1. Open a table long enough to scroll, scroll to the bottom.
   **PASS:** sidebar stays fixed.
2. Navigate to a nested route (`/admin/products/1/edit`).
   **PASS:** banner shows the products title, not the dashboard fallback; exactly
   one nav item is active.
3. Resize to 375px.
   **PASS:** no horizontal page scroll; the table scrolls inside its wrapper.
4. If a mobile drawer exists: open it, navigate.
   **PASS:** closes on navigation, Escape closes it, focus returns to the
   trigger.

## 8. Build

```bash
npm run build && npm run preview
npx eslint src/pages/Admin/
```

```bash
# Admin code is not in the entry chunk.
grep -l "AdminProducts\|AdminLayout" dist/assets/index-*.js
# PASS: no output
```

```bash
# One toast library.
grep -rn "from 'sonner'\|from \"sonner\"" src/
# PASS: no output — this project uses react-hot-toast
```

```bash
grep -riE "secret|api_key|password|bkash" dist/assets/*.js
# PASS: no output
```

## Sign-off

Do not report admin work as complete with an unchecked box in §1, §2, or §3.

§1 maps to audit findings **S7/S8**, §4 to **P1**. Those three sections are the
regression surface — when `testing-harness` is built, they become its admin test
cases, and this file is the source of truth for them.
