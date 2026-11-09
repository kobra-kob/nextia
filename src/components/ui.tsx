import Link from "next/link";
import type { ReactNode } from "react";

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: keyof typeof TONES }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "default" }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 px-5 py-2.5">
          <dt className="text-slate-500">{k}</dt>
          <dd className="col-span-2 break-words">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filtres en onglets basés sur un paramètre d'URL. */
export function FilterTabs({
  base,
  param,
  current,
  options,
  keep = {},
}: {
  base: string;
  param: string;
  current?: string;
  options: { value?: string; label: string; count?: number }[];
  /** Autres paramètres d'URL à conserver (ex. filtre client). */
  keep?: Record<string, string | undefined>;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = (o.value ?? "") === (current ?? "");
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(keep)) if (v) qs.set(k, v);
        if (o.value) qs.set(param, o.value);
        const href = qs.size ? `${base}?${qs}` : base;
        return (
          <Link
            key={o.label}
            href={href}
            className={`rounded-full px-3 py-1 text-sm ${
              active ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 opacity-70">{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
