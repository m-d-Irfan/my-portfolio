# Error display

Wiring server errors into the form, accessibly, with the motion this project
already has.

## Server errors land on fields

The envelope from `api-contract` gives you a flat map:

```jsonc
{"error": {"code": "validation_error", "fields": {"quantity": "Only 3 left in stock."}}}
```

```jsx
try {
  await api.post("/api/orders/", payload);
} catch (err) {
  const { code, message, fields } = err.normalized;
  setErrors(fields);                       // straight into form state
  if (code !== "validation_error") {
    toast.error(message);                  // non-field failures only
  }
}
```

Do not toast a validation error. The message is already next to the field that
caused it; a toast on top is duplicate noise that covers the form.

Do toast a 403, a 500, or a network failure — nothing on the form explains those.

## Focus the first error

```jsx
const firstErrorRef = useRef(null);

useEffect(() => {
  if (Object.keys(errors).length) firstErrorRef.current?.focus();
}, [errors]);
```

On a long form, an error above the fold after a submit from the bottom is
invisible. Keyboard and screen-reader users have no way to find it at all.

`focus()` — not `scrollIntoView()`. Focus scrolls *and* moves the cursor, which
is what a screen reader announces.

## Accessible markup

```jsx
<div className="t-input">
  <label htmlFor="quantity">Quantity</label>
  <input
    id="quantity"
    name="quantity"
    type="number"
    inputMode="numeric"
    value={value}
    onChange={handleChange}
    onBlur={handleBlur}
    aria-invalid={!!error}
    aria-describedby={error ? "quantity-error" : undefined}
    ref={isFirstError ? firstErrorRef : undefined}
  />
  {error && (
    <p id="quantity-error" className="t-input__message" role="alert">
      {error}
    </p>
  )}
</div>
```

Four things are load-bearing:

- `htmlFor` / `id` — clicking the label focuses the input. Without it there is no
  programmatic label at all.
- `aria-invalid` — how a screen reader knows the field is wrong.
- `aria-describedby` — links the message to the input, so it is read on focus.
  Set it to `undefined` when there is no error, not to a dangling id.
- `role="alert"` — announces the message when it appears.

Never rely on colour alone. A red border is invisible to the ~8% of men with red-green
colour blindness. Always ship the text.

## Wiring the shake

`transitions-dev` provides the error shake. Its contract:

- `.is-error` — the error treatment (border, message)
- `.is-shaking` — the shake animation, **deliberately separate** so the shake can
  replay without the error state flickering off and on in the same tick

```js
function shake(el) {
  el.classList.remove("is-shaking");
  void el.offsetWidth;             // forced reflow — without it the animation
                                   // does not replay on a second failed submit
  el.classList.add("is-shaking");
}
```

```jsx
useEffect(() => {
  if (!Object.keys(errors).length) return;
  const el = firstErrorRef.current?.closest(".t-input");
  if (el) shake(el);
}, [errors, submitCount]);
```

`submitCount` in the deps matters: submitting twice with the *same* error leaves
`errors` unchanged, so without it the effect does not re-run and the second
rejection is silent.

Read [transitions-dev/12-error-state-shake.md](../../transitions-dev/12-error-state-shake.md)
for the full recipe. Do not re-implement the keyframes here.

Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .t-input.is-shaking { animation: none; }
}
```

The error must still be obvious without the movement — which it is, because the
border and the text are doing the work.

## Submit state

```jsx
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  if (submitting) return;              // double-submit guard
  setSubmitting(true);
  try {
    await api.post("/api/orders/", payload);
  } finally {
    setSubmitting(false);              // always, even on error
  }
}
```

```jsx
<button type="submit" disabled={submitting} aria-busy={submitting}>
  {submitting ? "Placing order…" : "Place order"}
</button>
```

`finally` is not optional. Setting it only on success leaves the form
permanently disabled after one failure, and the user has to reload and retype.

The guard is UX, not a duplicate-order control. That is an idempotency key —
see `data-layer/references/05-transactions-and-time.md`.

## Do not clear the form on error

```jsx
// WRONG
catch (err) { setForm(initialState); }
```

Retyping a long form because one field was wrong is the fastest way to lose a
sale. Keep every value; only set the errors.

Clear on **success**, and only after the response confirms it.

## Never reset a field the server accepted

If the server normalised a value — a phone number to `01712345678`, an email
lowercased — take the server's version back into the form on success. Otherwise
the display disagrees with what was stored.

## Error summary on long forms

```jsx
{Object.keys(errors).length > 1 && (
  <div role="alert" className="form-summary">
    <p>Please fix {Object.keys(errors).length} fields:</p>
    <ul>
      {Object.entries(errors).map(([field, msg]) => (
        <li key={field}>
          <a href={`#${field}`}>{labels[field]}</a>: {msg}
        </li>
      ))}
    </ul>
  </div>
)}
```

Worth it above roughly six fields. The anchors let a keyboard user jump straight
to each problem.

## Message wording

| Instead of | Write |
|---|---|
| "Invalid input" | "Enter a valid Bangladeshi mobile number." |
| "Error" | "Only 3 left in stock." |
| "This field is required" | "Enter your delivery address." |
| "Request failed with status 403" | "You do not have permission to do that." |

Say what is wrong and what to do. Never show a raw status code or an exception
string.

Message text lives server-side for anything the server decides, so the two
layers cannot drift.

## Verification

Keyboard only, no mouse:

```
Tab to each field · submit an empty form
PASS: focus lands on the first bad field, the message is announced,
      every field is reachable, nothing is unlabelled
```

```bash
# Every input has a label and error wiring.
grep -rn "<input" src/ | grep -v "aria-invalid"
# PASS: no output on any validated input

grep -rn "<input\|<select\|<textarea" src/ | grep -v "id="
# PASS: no output — no unlabelled control
```

```jsx
// The second identical failure still shakes.
it("replays the shake on repeated identical errors", async () => {
  render(<OrderForm />);
  await submitWithSameError();
  await submitWithSameError();
  expect(container.querySelector(".is-shaking")).toBeTruthy();
});
```

```jsx
// A failed submit does not clear input.
it("keeps values after a server error", async () => {
  render(<OrderForm />);
  await user.type(screen.getByLabelText("Phone"), "01712345678");
  await submitFailing();
  expect(screen.getByLabelText("Phone")).toHaveValue("01712345678");
});
```

```bash
# Reduced motion is honoured.
grep -rn "prefers-reduced-motion" src/
# PASS: the shake is disabled, the border and text are not
```

## Common mistakes

- Toasting validation errors as well as showing them inline
- No focus move, so the error is off-screen
- Missing `aria-invalid` or `aria-describedby`
- `aria-describedby` pointing at an id that does not exist
- Colour as the only error signal
- Forgetting the reflow, so the shake does not replay
- Omitting `submitCount` from the shake effect deps
- `setSubmitting(false)` outside `finally`
- Clearing the form on error
- Raw status codes or exception strings shown to the user
