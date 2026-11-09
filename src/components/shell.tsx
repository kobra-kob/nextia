"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean };

export function Shell({
  brand,
  nav,
  user,
  logout,
  accountHref,
  children,
}: {
  accountHref: string;
  brand: string;
  nav: NavItem[];
  user: { name: string; subtitle: string };
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">N</div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Nextia</p>
          <p className="text-xs text-slate-500">{brand}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              isActive(item) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <span className="h-4 w-4 shrink-0">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <Link href={accountHref} onClick={() => setOpen(false)} className="block truncate text-sm font-medium hover:underline">
          {user.name}
        </Link>
        <p className="truncate text-xs text-slate-500">{user.subtitle}</p>
        <form action={logout} className="mt-3">
          <button className="btn-ghost -ml-2 px-2 py-1 text-xs" type="submit">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden print:hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:block">{sidebar}</aside>

      {/* Mobile */}
      <div className="sticky top-0 z-20 print:hidden flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold">Nextia · {brand}</span>
        <button className="btn-ghost px-2 py-1" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
          ☰
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <main className="flex-1 lg:pl-60 print:pl-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
