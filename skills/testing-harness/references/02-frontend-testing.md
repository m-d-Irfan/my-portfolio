# Frontend testing

Vitest + React Testing Library. What is worth testing in a React app, and what
is not.

## Setup

```bash
npm i -D vitest @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom jsdom msw
```

```js
// vite.config.js
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
  },
});
```

```js
// src/test/setup.js
import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` is the important flag. Without it an unmocked
request silently returns undefined and the component renders an empty state that
looks like a pass.

## Query by what the user sees

```jsx
// Right — survives any refactor that keeps the UI the same
screen.getByRole("button", { name: "Place order" });
screen.getByLabelText("Quantity");
screen.getByText("Only 3 left in stock.");

// Wrong — couples the test to markup
container.querySelector(".btn-primary");
wrapper.find("OrderForm").instance();
```

`getByRole` and `getByLabelText` fail when accessibility breaks, which makes them
two tests in one. A `querySelector` test passes on a form no screen reader can
use.

Reach for `getByTestId` only when there is genuinely no accessible handle — and
treat that as a signal the markup needs a label.

## What to test

| Priority | What |
|---|---|
| 1 | Role-gated rendering — an admin route with a customer user |
| 2 | Form validation and error display |
| 3 | Cart arithmetic |
| 4 | Loading, empty, and error states |
| 5 | Token refresh and logout behaviour |

Do **not** test: styling, third-party components, implementation details, or
that a `useState` setter updates state.

## Role gating (S7, S8)

```jsx
it("does not render admin nav for a customer", async () => {
  server.use(
    http.get("/api/auth/me/", () =>
      HttpResponse.json({ id: 1, email: "c@example.com", is_staff: false })
    )
  );
  renderWithProviders(<AppShell />);
  await waitFor(() => expect(screen.queryByText("Dashboard")).toBeNull());
});
```

```jsx
it("ignores a tampered localStorage role", async () => {
  // This IS finding S8. Editing one value in DevTools produced a working
  // admin UI, because the frontend trusted its own storage.
  localStorage.setItem("user", JSON.stringify({ is_staff: true }));
  server.use(
    http.get("/api/auth/me/", () => HttpResponse.json({ is_staff: false }))
  );

  renderWithProviders(<AdminRoute><Dashboard /></AdminRoute>);

  await waitFor(() => expect(screen.queryByText("Dashboard")).toBeNull());
});
```

That second test is the frontend half of S8. The backend half lives in
`test_security_regressions.py` — the UI hiding a link means nothing if the
endpoint answers. **Both halves are required.** Neither alone closes the finding.

## Forms

```jsx
it("shows the server error on the right field", async () => {
  const user = userEvent.setup();
  server.use(
    http.post("/api/orders/", () =>
      HttpResponse.json(
        { error: { code: "validation_error", fields: { quantity: "Only 3 left in stock." } } },
        { status: 400 }
      )
    )
  );

  render(<OrderForm />);
  await user.click(screen.getByRole("button", { name: "Place order" }));

  const input = screen.getByLabelText("Quantity");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Only 3 left in stock.")).toBeInTheDocument();
  expect(input).toHaveFocus();
});
```

Three assertions, three distinct failure modes: the error arrived, it is
announced, and focus moved.

```jsx
it("keeps values after a failed submit", async () => {
  const user = userEvent.setup();
  render(<OrderForm />);
  await user.type(screen.getByLabelText("Phone"), "01712345678");
  await submitFailing(user);
  expect(screen.getByLabelText("Phone")).toHaveValue("01712345678");
});
```

```jsx
it("re-enables the button after a failure", async () => {
  const user = userEvent.setup();
  render(<OrderForm />);
  await submitFailing(user);
  expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
});
```

That last one catches `setSubmitting(false)` outside `finally` — a bug that
leaves the form permanently dead after one error, and that manual testing
usually misses because nobody submits twice.

## Cart arithmetic

```jsx
it("increments quantity without mutating the existing item", () => {
  const initial = [{ id: 1, quantity: 1 }];
  const next = addToCart(initial, { id: 1, quantity: 2 });

  expect(next[0].quantity).toBe(3);
  expect(initial[0].quantity).toBe(1);      // the bug: += on a shallow copy
  expect(next[0]).not.toBe(initial[0]);     // new object reference
});
```

The audit found `updated[existingIndex].quantity += quantity` on a shallow-copied
array. It mutates the original object, breaks `React.memo`, and doubles under
StrictMode. Assert on the *old* array — that is what catches it.

## Async states

```jsx
it("shows a skeleton, then content", async () => {
  renderWithProviders(<ProductList />);
  expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  expect(await screen.findByText("Teak Door 900mm")).toBeInTheDocument();
  expect(screen.queryByTestId("skeleton")).toBeNull();
});

it("shows a retry on failure", async () => {
  server.use(http.get("/api/products/", () => HttpResponse.error()));
  renderWithProviders(<ProductList />);
  expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
});
```

`findBy*` waits; `getBy*` does not. Using `getBy*` for async content produces a
flaky test that passes on a fast machine and fails in CI.

## Mock the network, not your own modules

```jsx
// Right — MSW intercepts at the network layer, so the axios instance,
// interceptors, and error normalisation all run.
server.use(http.get("/api/products/", () => HttpResponse.json({ results: [] })));

// Wrong — the interceptor that normalises errors never executes, so the test
// passes with an error shape the app has never seen.
vi.mock("../api/client");
```

Mocking your own API module is how a test suite stays green while every error
path in production is broken.

## Do not test motion

```jsx
// Pointless — jsdom has no layout engine, so this always passes
expect(el).toHaveStyle("transform: translateX(6px)");
```

Assert the **class**, and let the CSS be reviewed visually:

```jsx
it("marks the field as shaking after a failed submit", async () => {
  await submitFailing(user);
  expect(document.querySelector(".is-shaking")).toBeTruthy();
});
```

## Accessibility

```bash
npm i -D vitest-axe
```

```jsx
it("has no accessibility violations", async () => {
  const { container } = render(<OrderForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Catches missing labels, bad contrast pairs, and dangling `aria-describedby` ids.
Cheap to add, and it fails on the mistakes that are easiest to ship.

## Verification

```bash
npm test                  # PASS: all green
npm test -- --coverage    # inspect gaps
```

```bash
# No component tests mock the API module.
grep -rn "vi.mock.*api" src/
# PASS: no output — use MSW
```

## Common mistakes

- `querySelector` instead of `getByRole`
- `getBy*` for async content
- Mocking your own API module instead of the network
- No `onUnhandledRequest: "error"`, so unmocked calls pass silently
- Testing inline styles or transforms in jsdom
- Only testing the UI half of a role check
- Not asserting that the original array is unmutated in cart tests
