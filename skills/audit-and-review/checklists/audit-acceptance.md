# Audit acceptance

An audit is done when this checklist is complete — not when the scan has been
run.

## 1. Mechanical pass

- [ ] `bash assets/audit_scan.sh` run at the repo root
- [ ] Every candidate opened in its file and confirmed or dismissed
- [ ] Dismissals recorded with a reason (a dismissed candidate reappears next
      audit and gets re-investigated otherwise)
- [ ] The scan was verified to *work* — a defect planted, detected, reverted

## 2. Manual pass

- [ ] Every custom permission class read in full (S6 was a real class that
      returned `True`)
- [ ] Every admin endpoint tested with curl using a shopper token (S8)
- [ ] Query counts measured on the three heaviest endpoints, at 10 rows and
      1,000 (P4)
- [ ] One order traced end to end: request → serializer → model → signal →
      response → email → courier (C5 lived in a gap between two files)
- [ ] Drift detector run — serializer fields vs model fields vs frontend usage
      (§2.5)
- [ ] Money path attacked: modified price, forged transaction id, negative
      quantity, quantity above stock, another user's id. All five must fail

## 3. Every finding

- [ ] Has a stable id (`S1`, `C3`, `P4`)
- [ ] Names what someone can *do*, not what the code looks like
- [ ] Carries `file:line` evidence, including every sibling location
- [ ] Carries a specific, implementable fix
- [ ] Names the rule (which skill prevents it) and the test (what pins it)
- [ ] Is graded by exploitability × blast radius
- [ ] A silent failure is graded one level higher than a loud one
- [ ] **Contains no secret value** — only its location

## 4. Report

- [ ] Summary is three sentences and a count by severity
- [ ] Findings grouped S / C / P, ordered by severity within each
- [ ] Execution order given, with the dependency reasoning stated
- [ ] Verification plan has one runnable check per finding
- [ ] Every check produces an unambiguous yes or no
- [ ] Deferred findings recorded with a named decision-maker and a date
- [ ] **"Not covered" section present and honest**
- [ ] Tone is about code, not people
- [ ] Fits in about four pages

## 5. After the report

- [ ] Every fixed finding has a test named for it (`test_s2_customer_cannot_write`)
- [ ] Every test was confirmed to fail before the fix (revert locally and check)
- [ ] Every finding is a check in `audit_scan.sh` or the manual catalogue
- [ ] New classes of defect added to `03-seed-corpus.md`
- [ ] The rule lives in the owning build skill, not only in the report

A finding fixed without a test is a finding with a return date. The triangle —
rule, check, test — is the only thing that makes a fix permanent; the report is
the middle third of it.

## 6. Re-audit

- [ ] Previous findings re-checked, not assumed fixed
- [ ] Deferred decisions still valid, or reopened
- [ ] New code covered by the same checks
- [ ] The scan updated with anything found manually that a grep could have found

## Sign-off

An audit is complete when every box is ticked. An audit that ran the scan and
reported the hits is a lint run, and it will miss the class of defect that has
cost this project the most: the code that looks correct and does nothing.
