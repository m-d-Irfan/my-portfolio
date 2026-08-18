---
name: admin-panel-builder
description: Build admin consoles and management dashboards — sidebar shell, route-aware header banner, CRUD entity views with loading/empty/error states, depth-shaded cards, and theme tokens. Use when creating an admin panel, dashboard, inventory console, or any staff-facing management screen, or when fixing admin layout, nav, or table views. Covers server-side pagination, delete confirmation, and status badges.
---

# Admin panel builder

Builds staff-facing consoles: a sidebar shell, a route-aware banner, and CRUD
views that handle every state.

## Scope

This skill owns the **console shell and the CRUD pattern**.

It does not own the auth guard, the visual system, motion, or charts:

| Need | Skill |
|---|---|
| Route guard, `/auth/me/`, roles | `auth-flows` + `react-vite-frontend-builder` |
| What the server actually enforces | `security-hardening` |
| Global colour, type, spacing scales | `ui-design-system` |
| Transitions, modals, micro-interactions | `transitions-dev` |
| Charts, KPI tiles, dashboards | `dataviz` |
| Form validation and error display | `forms-and-validation` |
| Open-ended visual critique | `impeccable` |

## Non-negotiables

1. **No auth check inside the layout.** The route is gated by
   `<ProtectedRoute requireStaff>` before `AdminLayout` mounts. An
   in-component check reading `localStorage` was audit finding **S7/S8** — one
   console line walked past it, and child panels had already fetched by the
   time it ran.
2. **No hex literals.** Every colour is `var(--color-*)`. The previous version
   called itself theme-adaptive and hardcoded ~40 brand literals, so every
   project came out the same brown.
3. **Five states per list view**: loading, empty, error, populated, partial.
   Skeletons, not spinners.
4. **Server-side pagination and search.** Fetching the full table and slicing
   in the browser was audit finding **P1**.
5. **One toast library** — `react-hot-toast`. This skill and the frontend skill
   previously disagreed, which meant two stacking contexts in one app.
6. **Hiding a nav item is not access control.** The endpoint needs its own
   permission class regardless.

## Decision rules

**Where does the auth check go?**
The route, never the component. Guard the layout, not each page — guarding
pages lets the shell mount for anyone.

**Table or cards?**
Comparing values across rows → table. Scanning independent items with images →
cards. Admin work is almost always the former.

**Modal or separate route?**
Quick edit of a few fields → modal. Anything with tabs, uploads, or more than
about eight fields → its own route, so it is linkable and survives a refresh.

**New reference or existing pattern?**
Read the neighbouring admin page first. Conventions already in the file beat
conventions in this skill.

## Files

| File | Read when |
|---|---|
| `references/01-design-language.md` | Any styling; tokens, depth, density, anti-slop checks |
| `references/02-layout-and-nav.md` | Shell, sidebar, banner, route wiring, mobile drawer |
| `references/03-crud-views.md` | Any list, table, form or delete flow |
| `assets/admin-tokens.css` | Copy once into the host stylesheet |
| `assets/AdminLayout.jsx` | Copy verbatim |
| `assets/AdminBanner.jsx` | Copy verbatim |
| `assets/EntityManage.jsx` | Copy as the CRUD starting point |
| `checklists/admin-acceptance.md` | Before declaring admin work done |

## Workflow

**New console**

1. Copy `assets/admin-tokens.css`; replace the nine `:root` values with the
   host project's brand.
2. Copy `AdminLayout.jsx` and `AdminBanner.jsx`; create `nav.jsx`.
3. Wire the route with `<ProtectedRoute requireStaff>` **outside** and
   `<Suspense>` **inside** it.
4. Build each entity view from `EntityManage.jsx`.
5. Run `checklists/admin-acceptance.md`.

**Adding an entity view**

1. Add the nav entry to `nav.jsx` and the route meta to `AdminBanner.jsx`.
2. Copy `EntityManage.jsx`, define `columns` and `newRow`.
3. Confirm all five states render before styling anything.

**Fixing an existing console**

Start with the retheme test in `references/01-design-language.md` — change
`--color-accent` and see what does not follow. Whatever stays the old colour is
a hardcoded literal.

## Verification

```bash
# No hex literals in admin components.
grep -rnE "#[0-9a-fA-F]{3,8}" src/pages/Admin/ src/pages/Inventory/
# expect: no output

# No role check inside the layout.
grep -rnE "isAdmin|is_staff|Staff Eyes" src/pages/Admin/AdminLayout.jsx
# expect: no output

# No client-side pagination of a full fetch.
grep -rnE "\.slice\(.*page|filter\(.*search" src/pages/Admin/
# expect: no output

# Icon-only buttons are labelled.
grep -rn "<button" src/pages/Admin/ | grep -v "aria-label" | grep -iE "Trash|Edit2|Plus"
# expect: no output
```

Then in a browser, per list view: throttle to Slow 3G and reload (skeletons, no
jump), search for nonsense (empty state with guidance), stop the API and reload
(error state with working retry), delete the last row of page 2 (lands on page 1
with data).

The retheme test is the one that proves the tokens are real: set
`--color-accent: #0f766e`, reload, and confirm every pill, button, hairline and
focus ring turns teal.
