# States

Every view that fetches data has five states. Shipping one of them is the most
common reason a working app feels unfinished.

| State | When | Failure if missing |
|---|---|---|
| **Loading** | Request in flight | Blank screen, then a layout jump |
| **Empty** | Request succeeded, zero rows | Header row over nothing — reads as broken |
| **Error** | Request failed | Blank screen with no way forward |
| **Populated** | The happy path | — |
| **Partial** | Some data, some failed or still loading | Whole page held hostage by one slow widget |

Build them in that order. The populated state is the one you will get right
regardless; the other four are the ones that get skipped, and users hit them on
their first visit — an account with no orders sees the empty state before it
ever sees the populated one.

## Loading: match the shape of what is coming

Skeletons, not spinners. A spinner says "something is happening"; a skeleton
says "a table with five rows is arriving", and when the data lands nothing
moves.

```jsx
{loading && (
  <tbody aria-busy="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <td className="p-4"><div className="h-4 w-32 rounded-sm bg-surface-sunk animate-pulse" /></td>
        <td className="p-4"><div className="h-4 w-20 rounded-sm bg-surface-sunk animate-pulse" /></td>
      </tr>
    ))}
  </tbody>
)}
```

Rules:

- **The skeleton occupies the real dimensions.** A 40px skeleton row replaced by
  a 56px real row is the layout shift the skeleton existed to prevent.
- **Five rows, not the real count** — the count is unknown until the response
  arrives, and animating from 5 to 47 rows is worse than the shift.
- **Delay the skeleton ~200ms.** A skeleton that flashes for 80ms on a fast
  connection reads as a glitch. Show nothing, then the skeleton if the request
  is still open.
- **`aria-busy="true"`** on the container, so screen readers do not announce
  placeholder content as data.
- A centred spinner is acceptable for a full-page route transition, where there
  is no shape to match yet.

`transitions-dev/14-skeleton-reveal.md` owns the skeleton-to-content
cross-fade. Use it rather than a hard swap.

## Empty: say what to do next

"No data" is not an empty state. An empty state has three parts: what this
screen holds, why it is empty, and the action that fills it.

**WRONG**

```
No data
```

**RIGHT**

```jsx
<div className="py-12 text-center">
  <PackageIcon className="mx-auto h-10 w-10 text-text-subtle" aria-hidden />
  <h3 className="mt-4 text-lg font-semibold">No orders yet</h3>
  <p className="mx-auto mt-1 max-w-prose text-sm text-text-muted">
    Orders appear here as soon as a customer checks out.
  </p>
  <button className="mt-6">Add a manual order</button>
</div>
```

**Empty from a filter is a different state from empty by default**, and
conflating them is the version users complain about:

- No orders at all → "No orders yet" + the primary action.
- No orders matching "xyz" → "No orders match *xyz*" + a **Clear filters**
  button. Never the create action — the data exists, the query is wrong.

The clear-filters button is the part that gets left out, and without it the user
has to reason about which of four filters they set.

## Error: offer the retry

Three things: what failed, in plain language; what they can do; a working retry.

```jsx
<div role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-6">
  <h3 className="font-semibold text-danger">Couldn’t load orders</h3>
  <p className="mt-1 text-sm text-text-muted">{friendlyMessage(error)}</p>
  <button onClick={refetch} className="mt-4">Try again</button>
</div>
```

- **Never show a raw exception, stack trace or status code as the message.**
  Branch on `error.code` from the envelope (`api-contract/02`) and map to
  language. `Request failed with status code 500` tells the user nothing and
  tells an attacker something.
- **Distinguish the causes.** Offline → "You appear to be offline." 401 →
  refresh, then send to login. 403 → "You don't have access to this" and no
  retry button, because retrying cannot succeed. 5xx → retry.
- **A toast is not an error state.** It vanishes, and the user is left with a
  blank table and no way forward. Toast the transient failures; render the ones
  that leave the view unusable.
- **`role="alert"`** so it is announced.
- Keep whatever data is already on screen. Replacing a populated table with a
  full-page error because a background refresh failed loses the user's place.

## Partial

Independent regions fail and load independently. One slow widget must not hold
the page.

Per-region boundaries, not one page-level `if (loading)`. A dashboard where the
revenue tile is still loading should render the other five tiles — and if the
revenue endpoint 500s, that tile shows its own error while the rest work.

`react-vite-frontend-builder/07-error-boundaries.md` owns the boundary
placement; this file owns what the fallback looks like.

## Optimistic updates

For a like, a toggle, a quantity change — update the UI immediately, keep the
previous value, restore it on failure and say so.

Do **not** be optimistic about anything the server may legitimately reject or
recompute: order placement, payment, stock decrement, price. `security-hardening`
requires those to be server-decided, so an optimistic total is a number the
server is about to contradict.

## Success

For anything destructive, financial, or slow: confirm what happened, name the
thing, and offer the next step. "Order #1042 placed. Invoice emailed to
ifti@example.com." — not a green checkmark that fades.

`transitions-dev/10-success-check.md` owns the animation.

## Verification

Per view, in a browser:

```bash
# Loading — throttle to Slow 3G and reload.
#   PASS: skeletons matching the final shape; nothing jumps when data lands.

# Empty — query a term that matches nothing.
#   PASS: filter-specific message AND a working Clear filters button.

# Error — stop the API server and reload.
#   PASS: plain-language message, retry works when the server returns.

# Partial — block one endpoint in devtools.
#   PASS: the rest of the page renders.
```

```bash
# No raw error objects rendered.
grep -rnE "\{error\}|error\.message|err\.toString" src/
# REVIEW: each hit must pass through a friendly-message mapper

# Every fetching view has an empty branch.
grep -rln "useEffect\|useQuery" src/pages/ | xargs grep -Ln "length === 0\|isEmpty\|No .* yet"
# PASS: no output
```

The last check is the one worth running before every release. It lists views
that fetch and have no empty branch, which is the state a new user sees first.
