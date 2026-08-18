---
name: audit-and-review
description: Audit a Django + React codebase against the failure patterns this project has actually shipped — open write endpoints, client-trusted prices and roles, leaked secrets, silent config failures, N+1 queries, oversized assets, and frontend/backend contract drift. Produces a numbered findings report with file:line evidence, a fix, an execution order, and a verification plan. Use when reviewing a codebase, before a release, when inheriting unfamiliar code, or when asked "is this safe" or "what's wrong with this". Commands: audit security, audit correctness, audit performance, audit full. Trigger on "audit", "review the codebase", "code review", "security review", "find bugs", "what's wrong with this project", "is this production ready", "check for vulnerabilities", "technical debt".
---

# Audit and review

Turns `problems and solutions.md` from a document someone wrote once into a
command that can be run again.

## Why this skill exists

That file found eighteen defects across security, correctness and performance —
including four write endpoints open to anonymous users and an admin panel
guarded only in the browser. It was thorough, and it was manual. A manual audit
happens when someone remembers.

This skill runs the same checks mechanically, in the same report format, seeded
with the findings this project has already had. A codebase that never had S5
still gets checked for S5, because that class of bug does not care whose
codebase it is in.

## When to use

- Reviewing a codebase, yours or inherited
- Before a release
- After a large feature lands
- When asked "is this safe" or "is this production ready"

Do **not** use it to review a working diff — that is `/code-review` and
`/security-review`, which read the change in context. This skill audits a
**codebase at rest** against a fixed checklist. They complement each other; run
both before a release.

## Commands

Each produces the report format in
[02-report-format.md](references/02-report-format.md).

### audit security

Permissions, server authority, secrets, settings, uploads, auth. The S-series.
Run this one if you only run one.

### audit correctness

Config that fails silently, timezone, transactions, data that is read but never
persisted, contract drift. The C-series and §2.5.

### audit performance

Query counts, payload size, bundle size, assets, code splitting. The P-series.

### audit full

All three, plus the structural checks. Report ordered by severity, not by
category.

## The method

1. **Run the mechanical checks** — [`assets/audit_scan.sh`](assets/audit_scan.sh)
   greps the whole seed corpus in a few seconds. Every hit is a *candidate*.
2. **Verify each candidate by reading the code.** A grep finds
   `permission_classes` missing; only reading tells you whether the viewset is
   read-only. **A finding you have not opened the file for is a guess.**
3. **Check the gaps the grep cannot see** —
   [01-check-catalogue.md](references/01-check-catalogue.md) lists what needs a
   human: a permission class that exists and does nothing, a serializer field
   with no model behind it, an optimistic update on a server-decided value.
4. **Rank by exploitability, not by tidiness.** An anonymous write endpoint
   outranks every naming inconsistency in the repository.
5. **Write the report.** Evidence as `file:line`, a specific fix, an execution
   order, and a verification step per finding.

## The rules

1. **Every finding carries `file:line`.** A finding without a location is an
   opinion, and it will be argued with rather than fixed.
2. **Every finding carries a verification step.** "How would I know this is
   fixed" is answered when the finding is written, not afterwards.
3. **Severity is exploitability × blast radius.** Not how ugly it is.
4. **Never paste a live secret into the report.** Reference it as
   `settings.py:99`. The report gets committed, pasted into chat, and screenshotted
   — a report containing a credential is a second leak. This has already
   happened once in this suite.
5. **Say what you did not check.** An audit that implies full coverage is worse
   than one that names its gaps. Concurrency, business-logic correctness, and
   anything needing runtime observation are usually gaps.

## Severity

| Level | Means | Example |
|---|---|---|
| **Critical** | Exploitable now, by anyone, with real loss | S1 — anonymous catalogue writes; S5 — buy anything for ৳1 |
| **High** | Exploitable with a valid account, or a live credential leak | S2 — any shopper deletes a category; S3 — committed passwords |
| **Medium** | Needs a precondition, or degrades under load | P4 — N+1; C2 — wrong timezone splitting the business day |
| **Low** | Correct today, fragile tomorrow | Naming, missing docstrings, absent tests on a stable path |

A silent failure is graded one level higher than the same failure that raises.
**C1** returned `None` and disabled courier dispatch for months with no error —
that invisibility is what made it expensive.

## What this skill does not own

| Concern | Owner |
|---|---|
| Reviewing a diff or PR in context | `/code-review`, `/security-review` |
| The rule that prevents each finding | the relevant build skill |
| The test that stops it regressing | `testing-harness` |
| Fixing what the audit finds | the owning skill |
| Design and UX critique | `impeccable` |

The triangle this suite is built on: **rule** (build skill) → **check** (here) →
**test** (`testing-harness`). This skill is only the middle one. A finding
reported and fixed without a test will return.

## Verification

The audit itself is verifiable:

```bash
# 1. The scan runs clean on a clean tree.
bash .agents/skills/audit-and-review/assets/audit_scan.sh
# PASS: exit 0, no candidates

# 2. It detects a planted defect.
#    Remove one permission_classes line, re-run, confirm it is reported,
#    then revert.

# 3. Every finding resolves to a real location, and leaks no secret.
grep -oE "[a-zA-Z0-9_/.-]+\.(py|jsx|js):[0-9]+" audit-report.md \
  | while IFS=: read -r f l; do
      [ -f "$f" ] && [ "$(wc -l <"$f")" -ge "$l" ] || echo "STALE: $f:$l"
    done                                              # PASS: no output
gitleaks detect --source audit-report.md --no-git -v   # PASS: no findings
```

Check 2 is the one that matters. A scan that has never caught anything is a
scan you have no reason to believe in.

## Reference files

- [01-check-catalogue.md](references/01-check-catalogue.md) — every check, what
  it greps for, and what it cannot see
- [02-report-format.md](references/02-report-format.md) — the report structure,
  with the worked S5 example
- [03-seed-corpus.md](references/03-seed-corpus.md) — the eighteen findings this
  project has actually had, as a permanent checklist

## Assets

- [audit_scan.sh](assets/audit_scan.sh) — the mechanical pass. Candidates, not
  findings.

## Common mistakes

- **Reporting a grep hit as a finding.** Roughly half are false positives. Open
  the file.
- **Ranking by how easy it is to fix.** The report is for deciding what to fix
  first, and that is driven by exploitability.
- **Omitting the verification step**, so nobody can tell when it is done.
- **Pasting the secret** instead of its location.
- **Implying full coverage.** Name the gaps.
- **Auditing without seeding from history.** The bug this codebase had last year
  is the most likely bug it has now.
