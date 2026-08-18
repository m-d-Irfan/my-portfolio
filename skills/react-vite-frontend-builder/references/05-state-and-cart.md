# State and the cart

Client state, and the one place where getting it wrong becomes a security
problem.

## Choosing where state lives

Reach for the simplest that works:

| State | Where |
|---|---|
| Form inputs, toggles, local UI | `useState` in the component |
| Server data | Fetch hook + cache — never mirrored into context |
| Session, cart, theme | Context |
| Shared across distant routes, frequent writes | A store (Zustand) |

Two rules that prevent most refactors:

- **Do not copy server data into context.** Two copies means two truths and a
  stale one. Fetch where it is used; cache by key.
- **One context per concern.** `AuthContext`, `CartContext`, `ThemeContext` —
  not one `AppContext`. Any context value change re-renders every consumer, so a
  combined context re-renders the cart when the theme flips.

## The cart is display-only

> **The cart holds product ids and quantities. It does not hold authoritative
> prices.**

Audit finding **S5**: the client computed the order total and the server stored
what it was sent. A user edited the payload and bought a ৳45,000 door for ৳1.

Prices in cart state exist to render a subtotal. On checkout, send ids and
quantities; the server re-fetches every price and recomputes. If the server's
total differs from what was displayed, **the server wins** — show the user the
corrected total and ask them to confirm.

```js
// What goes to /orders/
{
  items: [{ product_attribute: 41, quantity: 2 }],
  shipping_address_id: 7,
  // No price. No subtotal. No total_amount. Sending them is the vulnerability;
  // a server that reads them is the bug.
}
```

A price shown in the cart may be stale — the admin can change it mid-session.
Re-validating server-side is what makes that safe.

## Never mutate state

```js
// WRONG — this shipped
const updated = [...items];
updated[i].quantity += quantity;   // mutates the object the old array holds
setItems(updated);
```

The spread copies the *array*, not the objects in it. `updated[i]` and
`items[i]` are the same object, so the old state mutates too. Consequences:

- `React.memo` and `useMemo` compare by reference, see no change, and skip the
  re-render — the badge shows a stale count.
- StrictMode double-invokes the reducer in development, so `+= quantity` applies
  twice and quantities jump by two.

```js
// RIGHT — new object at the changed index
setItems((prev) =>
  prev.map((item, idx) =>
    idx === i ? { ...item, quantity: item.quantity + quantity } : item
  )
);
```

Use the functional updater. `setItems(next)` computed from a captured `items`
loses writes when two updates land in the same tick.

## Identity is the variant, not the product

A product with size and colour variants has one id and many purchasable things.
Keying the cart on `product.id` merges a 900 mm door with a 1200 mm door.

```js
const lineKey = (item) => `${item.product_id}:${item.attribute_id}`;
```

Key on whatever the backend charges for — `ProductAttribute.id` here.

## Reducer, not scattered setters

A cart has enough operations that individual setters drift apart.

```js
function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const key = lineKey(action.item);
      const existing = state.items.find((i) => lineKey(i) === key);
      return existing
        ? { ...state, items: state.items.map((i) =>
              lineKey(i) === key
                ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, MAX_QTY) }
                : i) }
        : { ...state, items: [...state.items, action.item] };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => lineKey(i) !== action.key) };
    case "SET_QTY":
      return action.quantity < 1
        ? cartReducer(state, { type: "REMOVE", key: action.key })
        : { ...state, items: state.items.map((i) =>
              lineKey(i) === action.key ? { ...i, quantity: action.quantity } : i) };
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}
```

`SET_QTY` to zero removing the line matches what users expect from a quantity
box, and it removes a whole class of "quantity: 0" line items from orders.

## Persistence

Persist the cart so a reload does not empty it — but validate on read. Stored
JSON is user-editable and may be months old.

```js
const loadCart = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("cart") || "{}");
    if (!Array.isArray(raw.items)) return { items: [] };
    return {
      items: raw.items.filter(
        (i) =>
          Number.isInteger(i.product_id) &&
          Number.isInteger(i.attribute_id) &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          i.quantity <= MAX_QTY
      ),
    };
  } catch {
    return { items: [] };   // corrupt JSON must not break the app on boot
  }
};
```

Also re-fetch prices and stock on cart mount. A product may have been deleted,
gone out of stock, or been repriced since the cart was written.

## Memoise the context value

```jsx
// WRONG — new object every render; every consumer re-renders
<CartContext.Provider value={{ items, dispatch, subtotal }}>

// RIGHT
const value = useMemo(() => ({ items, dispatch, subtotal }), [items, subtotal]);
```

`dispatch` from `useReducer` is stable, so it needs no dependency entry.

## Verification

```jsx
// Adding the same variant twice increments, not duplicates, and does not
// double under StrictMode.
add({ product_id: 1, attribute_id: 41, quantity: 1 });
add({ product_id: 1, attribute_id: 41, quantity: 1 });
// PASS: one line, quantity 2

// Different variants stay separate.
add({ product_id: 1, attribute_id: 41, quantity: 1 });
add({ product_id: 1, attribute_id: 42, quantity: 1 });
// PASS: two lines
```

```bash
# No index-assignment mutation of state.
grep -rnE "\w+\[\w+\]\.\w+\s*(\+|-|)=" src/ --include=*.jsx
# PASS: no output

# No price sent on checkout.
grep -rnE "(price|total|amount|subtotal)" src/services/orders.js
# PASS: no occurrence inside a request payload
```

```
Browser, in StrictMode dev:
1. Add one item. PASS: quantity is 1, not 2.
2. Reload. PASS: cart survives.
3. Set localStorage cart to {"items":[{"quantity":-5}]}, reload.
   PASS: empty cart, no crash.
```

## Common mistakes

- Client-computed totals trusted by the server (**S5**).
- Index assignment into a shallow-copied array.
- Keying on `product.id` when variants are what sell.
- A non-functional updater, so concurrent updates drop.
- Unvalidated `localStorage` on boot.
- An unmemoised context value.
- One combined `AppContext`.
- Server data mirrored into context.
