# Forms and validation acceptance

Every line has a pass condition. Sections 1, 2 and 3 map to security findings —
do not sign those off from code reading.

## 1. The server is the authority (S5)

```bash
# No writable price/total/status on any serializer a customer can reach.
grep -rn "unit_price\|total_amount\|price\|status" --include=serializers.py . \
  | grep -v "read_only"
# PASS: no writable hit
```

```bash
# Bypassing the form entirely is the real test.
curl -s -X POST localhost:8000/api/orders/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"product":1,"quantity":9999,"unit_price":"0.01","total":"1"}]}'
# PASS: 400 — quantity rejected, unit_price ignored
```

```bash
# A disabled button is not enforcement.
grep -rn "disabled={" src/ | grep -iE "stock|quantity|price"
# PASS: every hit has a server-side validate() counterpart
```

## 2. Server rules exist for every client rule

```bash
grep -rn "return .*must\|return .*required\|return .*invalid" src/validation/ \
  | cut -d: -f1 | sort -u > /tmp/client-rules.txt
grep -rn "def validate" --include=serializers.py . | sed 's/.*validate/validate/' \
  | sort -u > /tmp/server-rules.txt
diff /tmp/client-rules.txt /tmp/server-rules.txt
# PASS: no rule exists in only one layer — same thresholds, same wording
```

## 3. Client rules mirror the serializer

```bash
grep -rn "stock_quantity\|Only .* left" --include=serializers.py .
grep -rn "Only .* left\|stock" src/validation/
# PASS: the same threshold appears in both
```

## 4. Errors arrive on the right field

```bash
curl -s -X POST localhost:8000/api/orders/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"product":1,"quantity":999}]}' | python -m json.tool
# PASS: {"error": {"code": "validation_error", "fields": {"quantity": "..."}}}
```

- [ ] Every input renders its own error, adjacent to the input
- [ ] The error text is the server's message, not a generic "Error"
- [ ] `non_field_errors` renders as a summary, not on an arbitrary field

## 5. Accessible error wiring

```bash
grep -rn "<input\|<select\|<textarea" src/ | grep -v "aria-invalid"
# PASS: no output on any validated control
```

- [ ] `htmlFor`/`id` pair on every field
- [ ] `aria-invalid` reflects the error state
- [ ] `aria-describedby` links the message, set to `undefined` when clean
- [ ] `role="alert"` on error messages

Keyboard-only pass:

```
Tab to each field; submit an empty form.
PASS: focus moves to the first invalid field, its message is announced,
      every control remains reachable, nothing is unlabelled.
```

## 6. Error motion replays and respects reduced motion

- [ ] The shake is `.is-shaking` on `.t-input`, separate from `.is-error`
- [ ] `void el.offsetWidth` between class removal and re-add
- [ ] The effect depends on `submitCount`, so a repeated identical error shakes again

```jsx
it("replays the shake on repeated identical errors", async () => {
  render(<OrderForm />);
  await submitWithSameError();
  await submitWithSameError();
  expect(container.querySelector(".is-shaking")).toBeTruthy();
});
```

- [ ] `prefers-reduced-motion` disables the shake; border and text remain

## 7. Submit state

- [ ] `setSubmitting(false)` is in `finally`, not only on success
- [ ] The button is disabled while submitting, with `aria-busy`
- [ ] Double-submit is guarded client-side **and** the endpoint has an idempotency key

```jsx
it("does not clear values after a server error", async () => {
  render(<OrderForm />);
  await user.type(screen.getByLabelText("Phone"), "01712345678");
  await submitFailing();
  expect(screen.getByLabelText("Phone")).toHaveValue("01712345678");
});
```

- [ ] The form clears only on confirmed success
- [ ] Server-normalised values are reflected back into the form

## 8. Async validation

- [ ] Uniqueness checks are debounced (300–500ms)
- [ ] The endpoint is throttled server-side — an unthrottled
      email-check is an enumeration oracle
- [ ] Re-validated on submit, because someone may have taken the value

## 9. Uploads

- [ ] Client pre-checks type and size before upload
- [ ] The same limits are enforced server-side by `validators.py`
- [ ] Upload failure leaves the chosen file in the form

## 10. Validation timing

- [ ] Validate on blur, not on the first keystroke
- [ ] Re-validate live only for fields already in error

## 11. Cross-layer drift test

```jsx
// One assertion: the client rules and the server rules agree.
it("client and server quantity rules agree", () => {
  // Serializer: validate_quantity requires >= 1.
  expect(orderItemRules.quantity(0, { stock: 5 })).toBeTruthy();
  expect(orderItemRules.quantity(1, { stock: 5 })).toBeNull();
});
```

## Sign-off

| § | Area | Result |
|---|---|---|
| 1 | Server is the authority (S5) | |
| 2–3 | Rules exist in both layers, agree | |
| 4–5 | Errors on fields, accessible | |
| 6 | Motion replays, reduced-motion safe | |
| 7–8 | Submit state, async validation | |
| 9–10 | Uploads, timing | |
| 11 | Drift test green | |

§1 is the security finding. The rest is what makes it bearable to use.
