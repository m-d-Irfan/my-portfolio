/**
 * Admin console shell — sidebar, nav, viewport.
 *
 * Copy to `src/pages/Admin/AdminLayout.jsx`.
 *
 * NO AUTH GUARD HERE, deliberately. The route is gated before this mounts:
 *
 *   <Route path="/admin" element={
 *     <ProtectedRoute requireStaff><AdminLayout /></ProtectedRoute>
 *   }>
 *
 * The earlier version of this file read `isAdmin()` from a context hydrated
 * from localStorage and rendered a "Staff Eyes Only" screen on failure. That
 * was audit finding S7/S8: anyone could set is_staff in the console and walk
 * in, and by the time the check ran the child panels had already fired their
 * admin data requests. A role check belongs at the route boundary, backed by
 * GET /auth/me/, and the real control is permission_classes on the API.
 */

import { Home, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import AdminBanner from './AdminBanner';
import { ADMIN_NAV } from './nav';

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--color-background)] md:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col border-r-2 border-[var(--color-accent)]/40 bg-[var(--color-primary)] p-4 text-[var(--color-surface-light)]">
        <div className="mb-4 border-b border-[var(--color-accent)]/20 pb-4">
          <h2 className="font-serif text-xl font-bold tracking-wider text-[var(--color-accent-soft)]">
            Console
          </h2>
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--color-surface-light)]/50">
            Staff area
          </span>
        </div>

        <nav aria-label="Admin sections" className="flex flex-grow flex-col gap-1">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              // `end` on the index route only, or /admin stays highlighted on
              // every child route.
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs transition-all',
                  isActive
                    ? 'border-l-4 border-[var(--color-accent-soft)] bg-[var(--color-accent)] font-semibold text-[var(--color-on-accent)] shadow-md'
                    : 'text-[var(--color-surface-light)]/75 hover:bg-[var(--color-surface-light)]/5 hover:text-[var(--color-accent-soft)]',
                ].join(' ')
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-3 border-t border-[var(--color-accent)]/20 pt-4">
          <div className="flex items-center gap-3">
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt=""
                className="h-9 w-9 rounded-full border border-[var(--color-accent)] object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-xs font-bold"
              >
                {(user?.first_name?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <strong className="truncate text-xs font-semibold">
                {user?.first_name} {user?.last_name}
              </strong>
              <span className="text-[0.65rem] font-medium capitalize text-[var(--color-accent-soft)]">
                {user?.role || 'staff'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              to="/"
              aria-label="Back to storefront"
              className="flex flex-1 items-center justify-center rounded-lg bg-[var(--color-surface-light)]/5 py-1.5 text-[var(--color-surface-light)]/70 transition-colors hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent-soft)]"
            >
              <Home size={15} />
            </Link>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              className="flex flex-1 items-center justify-center rounded-lg bg-[var(--color-surface-light)]/5 py-1.5 text-[var(--color-surface-light)]/70 transition-colors hover:bg-red-900/25 hover:text-red-400"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto p-6">
        <AdminBanner />
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
