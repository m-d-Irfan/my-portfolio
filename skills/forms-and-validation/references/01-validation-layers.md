# Validation layers

Where each rule lives, and why the same rule is written twice on purpose.

## Three layers, three jobs

| Layer | Job | Bypassable |
|---|---|---|
| Client | Fast feedback, fewer round-trips | Trivially — DevTools, curl |
| Serializer | Readable field errors, business rules | By `bulk_create`, shell, management commands |
| Database constraint | The guarantee | No |

They are not redundant. Each one is doing something the others cannot.

> **The client layer is UX. It is never security.**
> Audit finding **S5** was a client that computed the order total and a server
> that stored what it was sent. A ৳45,000 door sold for ৳1. Every rule that
> matters exists server-side regardless of what the form does.

## What belongs where

**Client only** — cheap, instant, no security weight:

- Required field is empty
- Email looks like an email
- Password confirmation matches
- Character count under the max
- File size and extension before upload starts

**Serializer** — everything the client checks, plus:

- Cross-field rules (`delivery_date > order_date`)
- Uniqueness that needs a query
- Business rules (`quantity <= stock_quantity`)
- Field-level permission (`is_staff` writable only by a superuser)
- Anything whose value the server must own — price, total, status, ownership

**Database** — invariants that must hold no matter which code path writes:

- `quantity > 0`
- `unit_price >= 0`
- Unique `(order, product)`

Detail on the constraint layer is in `data-layer`.

## Server-side rules first

Write the serializer rule, then the client rule. Not the reverse — a client rule
written first is a rule that feels finished before the guarantee exists.

```python
class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["product", "quantity"]
        # NOT in fields: unit_price, total. The server computes both from its
        # own Product lookup (S5).

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        product = attrs["product"]
        if attrs["quantity"] > product.stock_quantity:
            raise serializers.ValidationError(
                {"quantity": f"Only {product.stock_quantity} left in stock."}
            )
        return attrs
```

`validate_<field>` for single-field rules, `validate` for anything reading two
or more. Raise with a dict from `validate` so the error lands on a field rather
than in `non_field_errors` — the form can then highlight the input.

## Client rules mirror, never invent

```js
export const orderItemRules = {
  quantity: (value, { stock }) => {
    if (!value) return "Quantity is required.";
    if (value < 1) return "Quantity must be at least 1.";
    if (value > stock) return `Only ${stock} left in stock.`;
    return null;
  },
};
```

Same thresholds, same wording. When they disagree the user gets a green form
that fails on submit, which reads as a broken site.

Keep them in one module per resource so a threshold change is one file, and put
a comment naming the serializer they mirror.

## Never trust a client-side disable

```jsx
// WRONG — the only thing stopping an over-quantity order
<button disabled={quantity > stock}>Checkout</button>
```

Disabled is a hint. The endpoint still accepts the request. The button is
courtesy; `validate()` is the control.

## Async validation

Uniqueness needs a query, so it cannot be synchronous.

```js
const check = useDebouncedCallback(async (email) => {
  try {
    await api.post("/auth/check-email/", { email });
    setError(null);
  } catch (err) {
    setError(err.normalized.fields.email);
  }
}, 400);
```

Three requirements:

- **Debounce** at 300–500ms, or you fire a request per keystroke.
- **Throttle the endpoint** server-side. An unthrottled email-check endpoint is
  an account enumeration oracle — see `security-hardening`.
- **Re-validate on submit.** Between the check and the submit, someone else may
  have taken the value. The unique constraint is what actually decides.

## File uploads

```js
const MAX_MB = 5;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function validateFile(file) {
  if (!ALLOWED.includes(file.type)) return "Use a JPEG, PNG, or WebP image.";
  if (file.size > MAX_MB * 1024 * 1024) return `Keep images under ${MAX_MB}MB.`;
  return null;
}
```

This saves the user a failed 6MB upload on a slow connection. It proves nothing
about the file — `file.type` comes from the extension and is trivially spoofed.
Server-side content-type sniffing and size limits are in `security-hardening`.

## Normalise before validating

```python
def validate_email(self, value):
    return value.strip().lower()

def validate_phone(self, value):
    digits = re.sub(r"\D", "", value)
    # Bangladesh: 01XXXXXXXXX (11) or 8801XXXXXXXXX (13)
    if len(digits) == 11 and digits.startswith("01"):
        return digits
    if len(digits) == 13 and digits.startswith("8801"):
        return "0" + digits[3:]
    raise serializers.ValidationError("Enter a valid Bangladeshi mobile number.")
```

Users paste `+880 1712-345678`, ` Ifti@Example.COM `, and `০১৭` in Bengali
digits. Normalise first, then validate the normalised form, and store the
normalised value — otherwise the same person creates two accounts.

`CharField(max_length=20)` for phone, never an integer field: `01712345678` as
an integer loses the leading zero.

## Validate on the right event

| Event | Use for |
|---|---|
| On blur | Default. Validate after the user leaves the field |
| On change | Only after that field has already errored, so corrections clear live |
| On submit | Everything, always |

Validating on change from the first keystroke shows "Enter a valid email" while
someone types the `i` of `ifti@`. That is hostile.

```jsx
const handleChange = (e) => {
  setValue(e.target.value);
  if (errors[name]) validateField(name, e.target.value);  // only if already wrong
};
```

## Verification

```bash
# Client rules exist for every serializer rule.
grep -rn "def validate" --include=serializers.py .
grep -rn "export const .*Rules" src/validation/
# PASS: matching coverage per resource
```

```bash
# No price or total on a write serializer.
grep -rn "unit_price\|total_amount\|price" --include=serializers.py . \
  | grep -v read_only
# PASS: no writable hit (S5)
```

```bash
# Bypass the form entirely — the real test.
curl -s -X POST localhost:8000/api/orders/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"product":1,"quantity":9999,"unit_price":"0.01"}]}'
# PASS: 400 on quantity, and unit_price ignored entirely
```

## Common mistakes

- Client validation with no server rule behind it
- Different thresholds or wording between the two layers
- A disabled button treated as enforcement
- Async uniqueness with no debounce, or no server-side throttle
- Not re-validating uniqueness on submit
- Validating on change from the first keystroke
- Storing a non-normalised email or phone
- An integer field for a phone number
- Accepting `unit_price` or `total` from the client (**S5**)
