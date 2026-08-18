/**
 * Entity management view — list, search, create, edit, delete.
 *
 * Copy to `src/pages/Admin/Products.jsx` (or Brands.jsx, Categories.jsx, …).
 *
 * This is the CRUD standard. It wires loading / empty / error states, server
 * pagination, search, optimistic-free mutations with toast feedback, and
 * delete confirmation. Style it with the tokens in
 * references/01-design-language.md — no hex literals.
 *
 * NOT included on purpose: the auth guard. The route is gated by
 * <ProtectedRoute roles={['admin','staff']}> before this mounts (see the
 * auth-flows skill). Checking roles again here would be both redundant and
 * too late — this component has already fetched by the time it renders.
 */

import { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/services/api';

const PAGE_SIZE = 20;

function LoadingRows() {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="p-4"><div className="h-3 w-24 rounded bg-[var(--color-text-muted)]/20" /></td>
          <td className="p-4"><div className="h-3 w-16 rounded bg-[var(--color-text-muted)]/20" /></td>
          <td className="p-4"><div className="ml-auto h-3 w-14 rounded bg-[var(--color-text-muted)]/20" /></td>
        </tr>
      ))}
    </tbody>
  );
}

export function EntityManage({
  endpoint,            // '/admin/products'
  columns,             // [{ key, label, render?(row) }]
  newRow,              // () => { name: 'New entry', ... }
  emptyState = 'No entries yet.',
}) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(endpoint, {
        params: { page, search: search || undefined, page_size: PAGE_SIZE },
      });
      setRows(data.results ?? data);
      setCount(data.count ?? data.length);
    } catch (err) {
      setError(err.normalized?.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const createRow = async () => {
    try {
      const { data } = await api.post(endpoint, newRow());
      toast.success('Created.');
      await fetchRows();
      return data;
    } catch (err) {
      toast.error(err.normalized?.message || 'Could not create.');
    }
  };

  const deleteRow = async (id, label = 'this entry') => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api.delete(`${endpoint}${id}/`);
      toast.success('Deleted.');
      // If we just emptied the last row of the last page, step back — otherwise
      // we render an empty page that says "loading" forever.
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else await fetchRows();
    } catch (err) {
      toast.error(err.normalized?.message || 'Could not delete.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search…"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-light)] py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>

        <button
          onClick={createRow}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-xs font-semibold text-[var(--color-on-accent)] shadow-md transition-all hover:shadow-lg"
        >
          <Plus size={16} /> Add new
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface-light)] to-[var(--color-surface-dark)] shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)] font-serif text-xs uppercase tracking-wider text-[var(--color-surface-light)]">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="p-4">{col.label}</th>
                ))}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            {loading ? (
              <LoadingRows />
            ) : error ? (
              <tbody>
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-sm text-[var(--color-text-muted)]">
                    {error}
                    <button
                      onClick={fetchRows}
                      className="ml-2 text-[var(--color-accent)] underline"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              </tbody>
            ) : rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-sm text-[var(--color-text-muted)]">
                    {emptyState}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--color-surface-light)]/80">
                    {columns.map((col) => (
                      <td key={col.key} className="p-4 font-semibold text-[var(--color-text-primary)]">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${row.id}`}
                          className="rounded-lg p-2 text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          aria-label={`Delete ${row.id}`}
                          onClick={() => deleteRow(row.id, row.name)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-500/15"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* Server-side paging. The payload for page 1 is ~20 rows; loading the
            whole catalogue and paging client-side is the P1 audit finding. */}
        {!loading && totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
            <span>{count} entries</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

export default EntityManage;
