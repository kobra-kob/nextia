import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import type { CompanyStatus } from "@/db/schema";
import { Card, Empty, FilterTabs, PageHeader, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { COMPANY_STATUS, date, SUBSCRIPTION_STATUS } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const user = await requireStaff("clients:view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" && sp.status in COMPANY_STATUS ? (sp.status as CompanyStatus) : undefined;

  const c = schema.companies;
  const filters: SQL[] = [];
  if (status) filters.push(eq(c.status, status));
  if (q) filters.push(or(ilike(c.name, `%${q}%`), ilike(c.email, `%${q}%`), ilike(c.sector, `%${q}%`))!);

  const [rows, counts] = await Promise.all([
    db.query.companies.findMany({
      where: filters.length ? and(...filters) : undefined,
      orderBy: [asc(c.name)],
      with: {
        accountManager: { columns: { name: true } },
        subscriptions: {
          where: sql`${schema.subscriptions.status} <> 'CANCELED'`,
          with: { plan: { columns: { name: true } } },
          limit: 1,
        },
      },
    }),
    db.select({ status: c.status, n: count() }).from(c).groupBy(c.status),
  ]);

  const countOf = (s?: CompanyStatus) =>
    s ? (counts.find((r) => r.status === s)?.n ?? 0) : counts.reduce((a, r) => a + r.n, 0);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Entreprises clientes, abonnements et responsables de compte."
        actions={can(user.role, "clients:edit") && <Link href="/admin/clients/new" className="btn-primary">Nouveau client</Link>}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterTabs
          base="/admin/clients"
          param="status"
          current={status}
          keep={{ q: q || undefined }}
          options={[
            { label: "Tous", count: countOf() },
            ...Object.entries(COMPANY_STATUS).map(([v, s]) => ({ value: v, label: s.label, count: countOf(v as CompanyStatus) })),
          ]}
        />
        <form className="mb-4 flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Rechercher…" className="input w-56" />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty>Aucun client ne correspond.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Abonnement</th>
                  <th>Responsable</th>
                  <th>Créé le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sub = row.subscriptions[0];
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td>
                        <Link href={`/admin/clients/${row.id}`} className="link">{row.name}</Link>
                        <p className="text-xs text-slate-500">{row.sector ?? row.email}</p>
                      </td>
                      <td><StatusBadge map={COMPANY_STATUS} value={row.status} /></td>
                      <td>
                        {sub ? (
                          <span className="flex items-center gap-2">
                            {sub.plan.name} <StatusBadge map={SUBSCRIPTION_STATUS} value={sub.status} />
                          </span>
                        ) : (
                          <span className="text-slate-400">Aucun</span>
                        )}
                      </td>
                      <td className="text-slate-600">{row.accountManager?.name ?? "—"}</td>
                      <td className="text-slate-500">{date(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
