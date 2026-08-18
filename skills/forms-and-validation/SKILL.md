---
name: forms-and-validation
description: Build forms that validate correctly and fail readably — client and server validation layers, field-level server error wiring, accessible error markup, submit state, async uniqueness checks, and file input validation. Use when building or fixing any form, wiring API validation errors into fields, or deciding what to validate where.
---

# Forms and validation

Forms are where security, UX, and motion meet. This skill covers all three, and
is clear about which one is which.

## The rule

> **Client validation is UX. Server validation is the control.**

Audit finding **S5** was a client that computed the order total and a server
that stored what it was sent — a ৳45,000 door sold for ৳1. A disabled button, a
`required` attribute, and a green form are all courtesy. Every rule that matters
exists server-side, and is reachable by `curl`.

Write the serializer rule first, then mirror it client-side. The reverse order
produces a rule that feels finished before the guarantee exists.

## Route by task

| Task | Read |
|---|---|
| Deciding what to validate where; async uniqueness; normalising phone/email; file pre-checks | [01-validation-layers.md](references/01-validation-layers.md) |
| Wiring server errors to fields; accessible markup; the error shake; submit state | [02-error-display.md](references/02-error-display.md) |

Copy [`assets/useForm.js`](assets/useForm.js) to `src/hooks/`. It owns the state
machine and the error wiring that is easy to get wrong — not layout or styling.

## The five rules

1. **Every client rule has a server rule behind it**, with the same threshold
   and the same wording. When they disagree the user gets a green form that
   fails on submit.
2. **Server errors land on fields**, via `error.normalized.fields` from the
   `api-contract` envelope. Do not toast a validation error — the message is
   already next to the input.
3. **Focus the first invalid field.** An error above the fold after submitting
   from the bottom is invisible, and keyboard users cannot find it at all.
4. **Never clear the form on error.** Retyping a long form because one field was
   wrong is the fastest way to lose a sale.
5. **`setSubmitting(false)` goes in `finally`.** Only on success leaves the form
   permanently disabled after one failure.

## Decisions

**Where does this rule live?** Empty, format, length, confirmation match →
client *and* server. Cross-field, uniqueness, stock, permissions → server, with
a client mirror where it helps. Invariants that must hold on any write path →
a database constraint, in `data-layer`.

**Validate on change or blur?** Blur by default. On change only for a field
already showing an error, so a correction clears live. Validating from the first
keystroke shows "Enter a valid email" while someone types the `i` of `ifti@`.

**Toast or inline?** Inline for validation. Toast for 403, 500 and network
failures — nothing on the form explains those.

**Is a disabled button enough?** No. It is a hint; the endpoint still accepts
the request.

## Workflow

1. Write the serializer rules — `validate_<field>` for single fields, `validate`
   for cross-field. Raise with a dict so the error lands on a field.
2. Confirm the endpoint rejects a `curl` bypass before touching the UI.
3. Mirror the rules in `src/validation/<resource>.js`, same thresholds and
   wording, with a comment naming the serializer.
4. Build the form with `useForm`; spread `fieldProps(name)` onto each input.
5. Wire the shake with `useErrorShake(errors, submitCount, firstErrorRef)`.
6. Run [checklists/forms-acceptance.md](checklists/forms-acceptance.md).

## What this skill does not own

| Concern | Owner |
|---|---|
| Which fields the server must compute (**S5**), upload content sniffing, throttling | `security-hardening` |
| The `{code, message, fields}` error envelope | `api-contract` |
| Database constraints behind the rules | `data-layer` |
| The shake keyframes and motion tokens | `transitions-dev` |
| Input, label and button visual design | `ui-design-system` |
| The axios instance and `error.normalized` | `react-vite-frontend-builder` |

This skill owns *wiring*: getting a server rule's message onto the right input,
accessibly, and replaying the motion when it happens again.

## Verification

```bash
# The endpoint enforces it, not the form.
curl -s -X POST localhost:8000/api/orders/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"product":1,"quantity":9999,"unit_price":"0.01"}]}'
# PASS: 400 on quantity, unit_price ignored entirely

# No writable price or total on any customer-facing serializer.
grep -rn "unit_price\|total_amount" --include=serializers.py . | grep -v read_only
# PASS: no output

# Every validated input is wired for assistive tech.
grep -rn "<input" src/ | grep -v "aria-invalid"
# PASS: no output
```

Keyboard-only: submit an empty form. Focus must land on the first invalid field
and its message must be announced.

Full list: [checklists/forms-acceptance.md](checklists/forms-acceptance.md).

## Audit findings this skill closes

| Ref | Finding | Where |
|---|---|---|
| **S5** (client half) | Client-computed totals trusted by the server | [01](references/01-validation-layers.md) |
| — | No accessible error wiring on any form | [02](references/02-error-display.md) |
| — | Error shake not replaying on repeated identical failures | [02](references/02-error-display.md), `assets/useForm.js` |
