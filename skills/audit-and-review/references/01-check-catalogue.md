# Check catalogue

Every check the audit runs, what it greps for, and — the part that matters —
what the grep cannot see.

Columns: **ID** ties to the seed corpus. **Mechanical** is what
`audit_scan.sh` does. **Manual** is what must be read. **Owner** is the skill
that owns the rule.

## Security

| ID | Check | Mechanical | Manual | Owner |
|---|---|---|---|---|
| S1 | Write endpoint open to anonymous | `AllowAny` on a `ModelViewSet`; missing `permission_classes` | Is it genuinely read-only? A `ReadOnlyModelViewSet` with `AllowAny` is fine | `security-hardening/01` |
| S2 | Write endpoint open to any authenticated user | `IsAuthenticated` on a catalogue/admin viewset | Should this be staff-only? Product edits and category deletes are staff actions | `security-hardening/01` |
| S6 | Permission class that permits everything | `has_permission` returning unconditional `True` | **Read every custom permission class.** S6 was a real class, correctly named, that returned `True` — no grep finds intent | `security-hardening/01` |
| S5 | Client-supplied price, amount or total trusted | `data.get('price'\|'amount'\|'total')` | Is the total *recomputed*, and recomputed correctly, from database prices? A recompute that reads the client's quantity without validating stock is still wrong | `security-hardening/06` |
| S5 | Client-supplied transaction id trusted | `data.get('transaction_id')` | Is there a real provider verification call, an amount comparison, and a replay check? | `jobs-and-integrations/03` |
| S7 | Role escalation through a writable field | `role`/`is_staff` in serializer `fields` without `read_only` | Can any endpoint set them indirectly — a nested serializer, a `**validated_data` splat, an admin action? | `security-hardening/01` |
| S8 | Admin guarded only in the browser | Role checks inside a `Layout`/`Dashboard` component | **Does the API enforce it?** A client-side guard is a UX affordance. Test with curl and a shopper token | `security-hardening/01` |
| S3 | Secrets in tracked source | Credential-shaped literals; tracked `.env`, `.sqlite3`, `.log` | Has every leaked credential been **rotated**? Deleting the line is not remediation | `security-hardening/04` |
| S4 | `DEBUG = True`, or a broken read | `^DEBUG\s*=\s*True`, `bool(os.environ...)` | What else is defined as `not DEBUG`? Here it silently disabled three `SECURE_*` settings | `security-hardening/03` |
| N2 | No rate limiting | No `DEFAULT_THROTTLE_RATES`; `locmem` in production | Are login, OTP and password-reset throttled *specifically*? A global anon rate does not protect a 6-digit OTP | `security-hardening/02` |
| N3 | OTP stored in plaintext, never expiring | `otp = models.CharField` on the user | Is it hashed, TTL'd, attempt-capped, and single-use? | `auth-flows/03` |
| N5 | Uploads unvalidated | `ImageField(` with no `validators` | Is content type sniffed server-side, is size capped, is the filename sanitised? Extension checks are not validation | `security-hardening/05` |
| N11 | Object enumeration | `AllowAny` on a detail route with a raw `pk` lookup | Can a sequential id read another customer's order? Test it | `security-hardening/01` |
| N12 | Backdating | `created_at` in serializer fields without `read_only` | Any other server-owned field a client can set — `status`, `paid_amount`, `user`? | `api-contract/01` |

## Correctness

| ID | Check | Mechanical | Manual | Owner |
|---|---|---|---|---|
| C1 | Config that fails silently | `environ.get('<lowercase>')`; `if settings.API_KEY:` guards | **Does a missing credential crash at boot, or disable a feature quietly?** The silent path is what made C1 last months | `deploy-and-env/01` |
| C2 | Wrong timezone | `TIME_ZONE` not `Asia/Dhaka`; `date.today()`, `datetime.now()` | Do daily reports use `timezone.localdate()`? Does an invoice show the local date? | `data-layer/05` |
| C3 | Blocking third-party call in a request | `send_mail`/`requests` in `views.py` or `signals.py`; `threading` | Is it in the outbox and is the handler idempotent? A thread is not an answer on Passenger | `jobs-and-integrations/01` |
| C5 | Data read but never persisted | `getattr(instance, '_...')` | **Every field read in `create`/`update` must map to a column.** C5's `_courier_type` meant every order dispatched manually | `data-layer/01` |
| — | Multi-row write without a transaction | `objects.create`/`bulk_create` in a file with no `atomic` | Is a partial write possible? An order with no items, or items with no order | `data-layer/05` |
| N10 | No idempotency | no `idempotency` anywhere | Does a double submit create two orders? Is the key per form instance, not per click? | `data-layer/05` |
| — | State mutation inside a shallow copy | `[...arr]` followed by an element-property assignment | Does `React.memo` see a new reference? A mutated element inside a copied array does not re-render | `react-vite-frontend-builder` |
| — | Full reload as navigation | `window.location.href` | Is it losing SPA state and re-downloading the bundle? | `react-vite-frontend-builder` |
| §2.5 | Contract drift | — | **Run the drift detector.** A serializer field with no model field behind it returns `null` forever and the frontend renders blank | `api-contract/01` |

## Performance

| ID | Check | Mechanical | Manual | Owner |
|---|---|---|---|---|
| P4 | N+1 queries | nested serializer + no `prefetch_related` on the viewset | **Count queries with `CaptureQueriesContext`.** Is the count constant as rows grow? That is the only real test | `performance-budget/01` |
| P4 | Over-serialisation | `fields = '__all__'` | Does a customer response include `buying_price`? `__all__` publishes every future column automatically | `api-contract/01` |
| P1 | No pagination | no `DEFAULT_PAGINATION_CLASS` | Is there a `max_page_size`? An exposed `page_size` with no cap is a denial-of-service parameter | `performance-budget/01` |
| P1 | Client-side filtering | `.filter(` on fetched data in context/pages | Does the server support the filter? Filtering 5,000 rows in the browser is a 5,000-row download | `performance-budget/02` |
| P2 | No code splitting | admin routes statically imported | Do admin bundles reach shoppers? Measure the initial chunk | `performance-budget/02` |
| P3 | Oversized assets | files over 300 KB | Is the LCP image lazy-loaded, animated, or missing dimensions? Each is a separate defect | `performance-budget/03` |
| — | Duplicate libraries | multiple toast/date/chart libraries | Is more than one actually used at runtime? | `performance-budget/02` |

## Structural

| Check | Mechanical | Manual | Owner |
|---|---|---|---|
| No regression suite | `tests/test_security_regressions.py` absent | **Do the tests that exist assert anything?** A test asserting `status_code != 500` passes on a 403 and on a 200 | `testing-harness` |
| No pre-commit | `.pre-commit-config.yaml` absent | Is it installed on developers' machines, or just committed? | `deploy-and-env/05` |
| No CI | `.github/workflows/` absent | Are the gates non-skippable? Has each been observed failing? | `deploy-and-env/05` |
| Skippable gates | `continue-on-error`, `\|\| true` | — | `deploy-and-env/05` |
| Hardcoded design values | hex literals in components | Are they in a token file? ~40 brand hexes are why the same brown appeared everywhere | `ui-design-system` |

## The manual pass

Six things no grep will find. Budget an hour.

1. **Read every custom permission class.** S6 was a real class with a real name
   that returned `True` unconditionally.
2. **Test the API with a shopper token.** Every admin endpoint, with curl. This
   is the only way to know S8 is closed, and it takes ten minutes.
3. **Count queries on the three heaviest endpoints**, with 10 rows and with
   1,000. A count that grows is P4 regardless of what the code looks like.
4. **Trace one order end to end**: request body → serializer → model → signal →
   response → email → courier. C5 lived in the gap between serializer and
   signal, where neither file looked wrong alone.
5. **Run the drift detector.** §2.5-class defects are invisible in both
   codebases separately.
6. **Try to break the money path.** Place an order with a modified price, a
   forged transaction id, a negative quantity, a quantity above stock, and a
   different user's `user` field. All five must fail.

## Coverage this audit does not have

State these in the report rather than implying coverage:

- **Concurrency.** Two simultaneous checkouts on the last unit; two payment
  callbacks. Needs load testing, not reading.
- **Business-logic correctness.** Whether the discount rule matches what the
  business intends is not inferable from code.
- **Third-party behaviour.** Whether bKash's sandbox matches live.
- **Anything runtime-only.** Memory growth, connection exhaustion, cache
  behaviour under pressure.
- **Whether the tests are honest.** A suite can be green and assert nothing.

## Verifying the scan itself

A check that scans zero files reports `ok`. That is indistinguishable from a
clean tree, and it is the failure mode this whole skill exists to warn about.
Both bugs below were live in `audit_scan.sh` on its first run against this
codebase:

| Bug | Symptom | Fix |
|---|---|---|
| `git ls-files '*.py'` from the parent repo returns nothing when the backend is a **submodule** | S3 reported `ok` while two live credentials sat in `settings.py:102` and `:250` | Scan the filesystem; use `git submodule foreach` for the tracked-file checks |
| A check description containing unescaped quotes shifted `check`'s arguments, so it evaluated `=` instead of the grep | P4's `__all__` check reported `ok` while five serializers used it | Quote descriptions with no embedded `"` |

So, before trusting a clean run:

```bash
# 1. Plant a defect and confirm it is reported.
#    Remove one permission_classes line → re-run → expect S1/S2. Revert.

# 2. Confirm each "ok" check actually scanned something.
#    Replace the check's command with `... | tee /dev/stderr` and look for input.

# 3. Spot-check two or three "ok" results against a direct grep.
grep -rn "fields = '__all__'" --include=serializers.py daf_backend
```

Step 3 is the cheapest and it is what caught both bugs above.
