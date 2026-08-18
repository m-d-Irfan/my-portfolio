# Seed corpus

The eighteen findings this project has actually had, plus the ten risks the
skills carried before the suite existed. This is the checklist the audit runs
against every codebase — not because they will repeat exactly, but because these
are the *classes* of defect this stack and this team produce.

The full original document is
[`.agents/problems and solutions.md`](../../../problems%20and%20solutions.md),
kept in place as the DAF project record. This file is the reusable extraction.

## Security

| ID | Finding | Class | Where it was |
|---|---|---|---|
| **S1** | Anonymous write to the whole catalog — `AllowAny` on four `ModelViewSet`s | Missing authorization | `product/views.py:22` |
| **S2** | `CategoryViewSet` / `BrandViewSet` had no `permission_classes`, so the global `IsAuthenticatedOrReadOnly` applied — any logged-in shopper could create or delete categories and brands | Wrong default inherited | `category/views.py:31`, `brand/views.py:6` |
| **S3** | MySQL password and Gmail app password as literals in git-tracked `settings.py` | Secret in source | `settings.py:99`, `:240` |
| **S4** | `DEBUG = True` hardcoded, cascading to `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` all being off in production | Insecure config | `settings.py:11`, `:229-231` |
| **S5** | Order totals and per-item prices taken from the request body and saved — a crafted POST buys anything for ৳1 | Client-trusted value | `orders/views.py:166,197` |
| **S6** | `IsAdminOrReadOnlyForIsActive.has_permission` returned `True` unconditionally; the object check guarded only `is_active` on PUT/PATCH and returned `True` for everything else, DELETE included | Permission class that permits | `api/permissions.py` |
| **S7** | Admin panel guarded client-side only | Cosmetic guard | `AdminLayout.jsx:29` |
| **S8** | localStorage tampering granted admin — three console lines set `is_staff: true` and the panel rendered | Client-trusted role | `AdminLayout.jsx`, `auth.jsx` |

**The pattern in five of eight:** the server trusted something the client
controlled — a role, a price, a flag — or trusted a default nobody chose.

## Correctness

| ID | Finding | Class | Where it was |
|---|---|---|---|
| **C1** | `os.environ.get('<the literal key>')` — the secret pasted in as the variable *name*, so both courier settings were `None` and dispatch was silently dead | Config failing silently | `settings.py:245-246` |
| **C2** | `TIME_ZONE = 'UTC'` with `USE_TZ = True` in a UTC+6 country — the business day split at 06:00 local | Timezone | `settings.py:171,175` |
| **C3** | Invoice email sent synchronously despite a docstring claiming it ran in a thread; `threading` imported in two files and never used | Blocking side effect | `orders/views.py:203` |
| **C4** | Web orders never decremented stock | Documented as intentional | — |
| **C5** | `courier_type` read into `instance._courier_type` and never persisted; the signal defaulted to `'manual'`, so every order dispatched manually | Read but never stored | `orders/views.py:32`, `signals.py:23` |
| **C6** | `stock_quantity` allowed negatives | Documented as intentional | `product/models.py:76` |

**The pattern:** a value that looked configured, looked saved, or looked
asynchronous, and was none of those — with no error in any case.

## Performance

| ID | Finding | Class |
|---|---|---|
| **P1** | `ProductContext` fetched **all** products on mount; every page filtered that array client-side |
| **P2** | All 24 routes statically imported — the 76 KB `Admin/Products.jsx` shipped to every anonymous visitor |
| **P3** | `src/assets/homebg.png` at 6.6 MB, unoptimised |
| **P4** | `ProductSerializer` used `fields = '__all__'` with four nested read-only serializers and no prefetch — N+1 across the catalogue |

## Contract drift (§2.5)

Four frontend files, a context provider and a DRF serializer all agreed on
`product.features`. **The model and migration were never created.**

Nothing failed. `product.features` was `undefined`, `undefined?.map()` is
`undefined`, React rendered nothing, spec filters silently returned zero
results, and the admin feature editor saved into a void. It went unnoticed for
months.

Also drifted: `structure.md` documented routes for `Parts.jsx`,
`CarsAndTrucks.jsx` and `Radios.jsx` — components that existed with no route
entries.

**The pattern:** JavaScript does not raise on a missing property and DRF ignores
unknown input keys, so drift is silent by construction. It has to be detected
deliberately.

## Risks the skills themselves carried

Found while auditing the skill suite, before any of it was rebuilt. Each is now
a rule somewhere.

| ID | Risk | Now owned by |
|---|---|---|
| **N1** | Tokens in `localStorage`, with no mention of the httpOnly alternative or the XSS tradeoff | `auth-flows/01` |
| **N2** | Zero rate limiting on a system using 6-digit OTPs — ~10⁶ guesses, crackable in minutes | `security-hardening/02` |
| **N3** | OTP as a plain `CharField` on the user row: no expiry, no attempt cap, no hashing, persisting forever | `auth-flows/03` |
| **N4** | JWT carrying `is_staff`, encouraging decode-and-trust, and leaving a revoked admin admin for the full token window | `auth-flows/06` |
| **N5** | `ImageField` + `MEDIA_ROOT` with no content-type, size, extension or path-traversal validation | `security-hardening/05` |
| **N6** | `IsOwnerOrReadOnly` named in the docs and defined nowhere | `security-hardening/01` |
| **N7** | No CSRF story for the cookie-auth path; `withCredentials` never configured | `auth-flows/01` |
| **N8** | No account lockout or login-attempt tracking | `auth-flows/04` |
| **N9** | No audit log for role changes, price edits, order edits or stock adjustments | `jobs-and-integrations/05` |
| **N10** | No idempotency on order or transaction creation — a double submit created duplicates | `data-layer/05` |
| **N11** | `OrderViewSet.track` was `AllowAny` with a raw `Order.objects.get(pk=pk)` — customer names, phones and addresses enumerable by walking integers | `security-hardening/01` |
| **N12** | `OrderSerializer` declared `created_at` writable — orders could be backdated | `api-contract/01` |

N11 and N12 were found during the suite build, not in the original audit. Both
are now checks in `audit_scan.sh`.

## Using this in a new codebase

The IDs are project-specific; the classes are not. When auditing anything on
this stack, ask the class question directly:

1. **Which endpoints accept writes, and who can call each?** (S1, S2, S6, N11)
2. **What does the server accept from the client that it should compute itself?**
   (S5, S7, S8, N12)
3. **What secrets exist, and are any in git?** (S3)
4. **What is configured that could be silently absent?** (C1)
5. **What happens outside the request, and does it survive a restart?** (C3)
6. **What is read from a request and never stored?** (C5)
7. **What grows with row count?** (P1, P4)
8. **What ships to a user who cannot use it?** (P2)
9. **What does the frontend read that the backend never sends?** (§2.5)
10. **Who can find out who changed this?** (N9)

Ten questions. They found eighteen defects here, and the first three found the
five that mattered.
