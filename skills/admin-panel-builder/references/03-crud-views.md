# CRUD views

The entity management pattern: list, search, page, create, edit, delete.

Copy [`assets/EntityManage.jsx`](../assets/EntityManage.jsx).

## The five states

Every list view has five. Shipping three is the most common admin defect.

| State | What renders |
|---|---|
| Loading | Skeleton rows matching the final shape |
| Empty | What this is, and what to do next |
| Error | What failed, and a retry button |
| Populated | The table |
| Partial | Rows plus an inline error when a mutation fails |

```jsx
{loading    ? <LoadingRows />
 : error    ? <ErrorRow message={error} onRetry={fetchRows} />
 : !rows.length ? <EmptyRow>{emptyState}</EmptyRow>
 : rows.map(renderRow)}
```

**Skeletons, not spinners.** A centred spinner sits in a collapsed container and
the whole page jumps when data arrives. Skeleton rows occupy the final height,
so nothing shifts — and the user can see the shape of what is coming.

**Empty states say what to do.** "No data" is a dead end. "No orders yet. Orders
appear here once a customer checks out." tells the user the screen is working.

**Errors offer a retry.** A toast that vanishes leaves a blank table with no way
forward.

## Server-side pagination

```jsx
const { data } = await api.get(endpoint, {
  params: { page, search: search || undefined, page_size: 20 },
});
setRows(data.results);
setCount(data.count);
```

Never fetch the full table and slice client-side. Audit finding **P1** was
exactly this: `ProductContext` fetched every product on mount and each page
filtered the array in the browser. It works with 50 products and collapses at
5,000 — and it ships the entire catalogue, including inactive items, to anyone
who opens DevTools.

Search goes to the server too, with a debounce:

```jsx
const debounced = useDebounce(search, 300);
useEffect(() => { setPage(1); }, [debounced]);
```

Reset to page 1 whenever the filter changes, or a search returning three results
renders an empty page 4.

## Delete

```jsx
const deleteRow = async (id, label) => {
  if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
  try {
    await api.delete(`${endpoint}${id}/`);
    toast.success('Deleted.');
    if (rows.length === 1 && page > 1) setPage((p) => p - 1);
    else await fetchRows();
  } catch (err) {
    toast.error(err.normalized?.message || 'Could not delete.');
  }
};
```

Three things:

- **Name the thing.** "Delete Teak Door 900mm?" not "Are you sure?" People
  click through generic confirmations without reading.
- **Step back a page** when the last row of a page is removed, or the table
  renders empty on a page that no longer exists.
- **`window.confirm` is a placeholder.** It is unstyleable and blocks the thread.
  Replace it with a modal — see `transitions-dev` `06-modal.md`.

A 403 here is normal, not a bug: a staff user who is not a superuser trying to
delete a user. Surface the server's message.

## Do not optimistically update destructive actions

Optimistic UI is right for a toggle. It is wrong for a delete.

Removing the row before the server confirms means a failed delete has to
re-insert it — at the right index, with the right scroll position. Users read
that flicker as data loss. Wait for the response.

## Mutations, not local state edits

After a successful create or update, refetch. Do not patch the local array.

```jsx
// WRONG — the local object drifts from the server's
setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

// RIGHT
await api.patch(`${endpoint}${id}/`, changes);
await fetchRows();
```

The server applies defaults, computes derived fields, normalises slugs, and
updates `updated_at`. A locally-patched row shows none of that, so the UI and
the database disagree until the next reload.

The cost is one extra request. Worth it.

## Forms

Field-level errors come from `error.normalized.fields`, which
`react-vite-frontend-builder/assets/api.js` populates from DRF's
`{field: ["message"]}` response.

```jsx
catch (err) {
  setFieldErrors(err.normalized?.fields ?? {});
  if (err.normalized?.message) toast.error(err.normalized.message);
}
```

Never show a raw 500 message — with `DEBUG` on it contains tracebacks and SQL.

Full form patterns, validation and error display belong to
`forms-and-validation`.

## Bulk actions

If the console has them:

- Selection state is a `Set` of ids, cleared on page change — carrying
  selections across pages leads to deleting rows the user never saw.
- The action bar appears only when selection is non-empty.
- The confirmation states the count: "Delete 12 products?"
- The endpoint takes the whole list in one request. N individual DELETEs is N
  round-trips, N chances to fail halfway, and no atomicity.

## Tables

- Numbers right-aligned with `tabular-nums`; text left-aligned
- Sticky header on tables over ~15 rows: `sticky top-0 z-10` on `<thead>`
- `overflow-x-auto` on the wrapper, never on the table
- Truncate long values with `title` for the full text
- A real `<caption>` or `aria-label` naming the table
- Actions column last, right-aligned, with `aria-label` on every icon button

An icon-only button with no accessible name is invisible to a screen reader —
`aria-label={`Delete ${row.name}`}`, not `aria-label="Delete"`.

## Verification

```bash
# No client-side pagination of a full fetch.
grep -rnE "\.slice\(.*page|filter\(.*search" src/pages/Admin/
# PASS: no output

# Icon buttons are labelled.
grep -rn "<button" src/pages/Admin/ | grep -v "aria-label" | grep -iE "Trash|Edit2|Plus"
# PASS: no output
```

```
Browser, per list view:
1. Throttle to Slow 3G, reload.   PASS: skeleton rows, no layout jump
2. Search for "zzzzz".            PASS: empty state with guidance
3. Stop the API, reload.          PASS: error state with a working Retry
4. Delete the only row on page 2. PASS: lands on page 1 with data
5. Delete as non-superuser.       PASS: 403 surfaced as a readable message
6. Tab through a row.             PASS: both action buttons reachable and labelled
```

## Common mistakes

- Three states instead of five.
- Spinner instead of skeleton, so the layout jumps.
- "No data" as an empty state.
- Fetching everything and paging in the browser (**P1**).
- Not resetting to page 1 on search.
- Generic delete confirmation.
- Optimistic delete.
- Patching local state instead of refetching.
- Unlabelled icon buttons.
