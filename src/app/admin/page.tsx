import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { Card, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { date, dateTime, money, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Tableau de bord" };

const OPEN_TICKET = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] as const;

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireStaff("dashboard:view");
  const { denied } = await searchParams;
  const showBilling = can(user.role, "billing:view");

  const { subscriptions: s, plans: p, invoices: i, tickets: t, companies: c } = schema;

  // MRR : abonnements actifs ou impayés, ramenés au mois.
  const [mrrRow] = await db
    .select({
      mrr: sql<number>`coalesce(sum(case when ${p.interval} = 'YEAR' then ${p.priceCents} / 12 else ${p.priceCents} end), 0)::int`,
    })
    .from(s)
    .innerJoin(p, eq(s.planId, p.id))
    .where(inArray(s.status, ["ACTIVE", "PAST_DUE"]));

  const [[activeClients], [openTickets], [overdue], recentTickets, overdueInvoices, trials] = await Promise.all([
    db.select({ n: count() }).from(c).where(eq(c.status, "ACTIVE")),
    db.select({ n: count() }).from(t).where(inArray(t.status, [...OPEN_TICKET])),
    db
      .select({ n: count(), total: sql<number>`coalesce(sum(${i.amountCents}), 0)::int` })
      .from(i)
      .where(and(eq(i.status, "OPEN"), lt(i.dueAt, new Date()))),
    db.query.tickets.findMany({
      where: inArray(t.status, [...OPEN_TICKET]),
      orderBy: [desc(t.updatedAt)],
      limit: 6,
      with: { company: { columns: { name: true } } },
    }),
    showBilling
      ? db.query.invoices.findMany({
          where: and(eq(i.status, "OPEN"), lt(i.dueAt, new Date())),
          orderBy: [i.dueAt],
          limit: 6,
          with: { company: { columns: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    db.query.subscriptions.findMany({
      where: eq(s.status, "TRIALING"),
      orderBy: [s.currentPeriodEnd],
      limit: 5,
      with: { company: { columns: { id: true, name: true } }, plan: { columns: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} description="Vue d'ensemble de l'activité." />

      {denied && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Votre rôle ne donne pas accès à cette page.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {showBilling && <Stat label="Revenu mensuel récurrent" value={money(mrrRow.mrr)} hint="HT, abonnements en cours" />}
        <Stat label="Clients actifs" value={activeClients.n} />
        <Stat label="Tickets ouverts" value={openTickets.n} />
        {showBilling && (
          <Stat
            label="Impayés en retard"
            value={money(overdue.total)}
            hint={`${overdue.n} facture${overdue.n > 1 ? "s" : ""}`}
            tone={overdue.n > 0 ? "red" : "default"}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tickets à traiter" actions={<Link href="/admin/tickets" className="link text-sm">Tout voir</Link>}>
          {recentTickets.length === 0 ? (
            <Empty>Aucun ticket ouvert.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTickets.map((tk) => (
                <li key={tk.id}>
                  <Link href={`/admin/tickets/${tk.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{tk.number} · {tk.subject}</p>
                      <p className="text-xs text-slate-500">{tk.company.name} · {dateTime(tk.updatedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <StatusBadge map={TICKET_PRIORITY} value={tk.priority} />
                      <StatusBadge map={TICKET_STATUS} value={tk.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {showBilling && (
          <Card title="Factures en retard" actions={<Link href="/admin/invoices?status=overdue" className="link text-sm">Tout voir</Link>}>
            {overdueInvoices.length === 0 ? (
              <Empty>Aucun retard de paiement.</Empty>
            ) : (
              <table className="table">
                <tbody>
                  {overdueInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/admin/clients/${inv.company.id}`} className="link">{inv.company.name}</Link>
                        <p className="text-xs text-slate-500">{inv.number}</p>
                      </td>
                      <td className="text-red-600">échue le {date(inv.dueAt)}</td>
                      <td className="text-right font-medium tabular-nums">{money(inv.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        <Card title="Essais en cours">
          {trials.length === 0 ? (
            <Empty>Aucun essai en cours.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {trials.map((tr) => (
                  <tr key={tr.id}>
                    <td><Link href={`/admin/clients/${tr.company.id}`} className="link">{tr.company.name}</Link></td>
                    <td className="text-slate-500">{tr.plan.name}</td>
                    <td className="text-right text-slate-500">fin le {date(tr.currentPeriodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
