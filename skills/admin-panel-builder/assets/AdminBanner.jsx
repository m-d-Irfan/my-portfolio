/**
 * Context-aware admin header banner.
 *
 * Copy to `src/pages/Admin/AdminBanner.jsx`.
 *
 * Adapts icon, title, subtitle and watermark to the current route. Renders
 * inside AdminLayout's main viewport, above the <Outlet />.
 *
 * Colours are var(--color-*) tokens only. A hex literal here welds one brand
 * into every project built from this skill — see references/01-design-language.md.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList, LayoutDashboard, MessageSquare, Package,
  ShoppingBag, Tag, Users, Warehouse,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

const PAGE_META = {
  '/admin': {
    title: 'Dashboard',
    subtitle: 'Live operational metrics and sales performance',
    icon: <LayoutDashboard size={28} />,
    watermark: 'DASHBOARD',
  },
  '/admin/products': {
    title: 'Catalogue & Stock',
    subtitle: 'Products, pricing tiers and variants',
    icon: <ShoppingBag size={28} />,
    watermark: 'CATALOGUE',
  },
  '/admin/orders': {
    title: 'Orders & Dispatch',
    subtitle: 'Customer orders, fulfilment and delivery',
    icon: <ClipboardList size={28} />,
    watermark: 'ORDERS',
  },
  '/admin/categories': {
    title: 'Categories',
    subtitle: 'Catalogue structure and hierarchy',
    icon: <Tag size={28} />,
    watermark: 'CATEGORIES',
  },
  '/admin/users': {
    title: 'Users & Staff',
    subtitle: 'Accounts, roles and access',
    icon: <Users size={28} />,
    watermark: 'USERS',
  },
  '/admin/reviews': {
    title: 'Reviews',
    subtitle: 'Customer feedback and moderation',
    icon: <MessageSquare size={28} />,
    watermark: 'REVIEWS',
  },
  '/inventory': {
    title: 'Godown Overview',
    subtitle: 'Stock levels and recent movements',
    icon: <Warehouse size={28} />,
    watermark: 'INVENTORY',
  },
};

const FALLBACK = {
  title: 'Console',
  subtitle: '',
  icon: <Package size={28} />,
  watermark: '',
};

/** Longest-prefix match, so /admin/products/42/edit resolves to the products entry. */
function metaFor(pathname) {
  const match = Object.keys(PAGE_META)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return PAGE_META[match] ?? FALLBACK;
}

function greeting(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Tick on the minute, not the second. A 1s interval re-renders 60x more
    // often than the display changes, and it keeps the tab awake on mobile.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Explicit timezone: staff may be on laptops set to another zone, and an
  // order cut-off shown in the wrong one causes real dispatch mistakes.
  const opts = { timeZone: 'Asia/Dhaka' };

  return (
    <div className="hidden text-right md:block">
      <time
        dateTime={now.toISOString()}
        className="block font-serif text-xl font-bold tabular-nums tracking-wide text-[var(--color-surface-light)]"
      >
        {now.toLocaleTimeString('en-GB', { ...opts, hour: '2-digit', minute: '2-digit' })}
      </time>
      <div className="mt-0.5 text-xs text-[var(--color-surface-light)]/55">
        {now.toLocaleDateString('en-GB', {
          ...opts, weekday: 'short', day: 'numeric', month: 'short',
        })}
      </div>
    </div>
  );
}

export function AdminBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const meta = metaFor(pathname);
  const firstName = user?.first_name || 'there';

  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)] shadow-[0_8px_40px_-4px_var(--shadow-strong)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* bg-radial requires Tailwind v4. On v3 use an arbitrary
            [background:radial-gradient(...)] value instead. */}
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-radial from-[var(--color-accent-soft)]/15 to-transparent" />
        <div className="absolute -bottom-16 right-20 h-52 w-52 rounded-full bg-radial from-[var(--color-accent)]/20 to-transparent" />

        <div className="absolute right-6 top-1/2 -translate-y-1/2 select-none font-serif text-7xl font-bold text-[var(--color-accent-soft)]/[0.06]">
          {meta.watermark}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent-soft)] to-transparent opacity-80" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-accent-soft)]/25 bg-[var(--color-accent-soft)]/15 text-[var(--color-accent-soft)] shadow-lg backdrop-blur-sm">
            {meta.icon}
          </div>
          <div>
            <p className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-[var(--color-accent-soft)]/80">
              {greeting(new Date().getHours())}, {firstName}
            </p>
            <h1 className="font-serif text-2xl font-bold leading-tight tracking-tight text-[var(--color-surface-light)]">
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="mt-0.5 text-xs text-[var(--color-surface-light)]/55">
                {meta.subtitle}
              </p>
            )}
          </div>
        </div>

        <LiveClock />
      </div>
    </header>
  );
}

export default AdminBanner;
