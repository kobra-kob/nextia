import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { date, dateTime, isOverdue, money, SUBSCRIPTION_STATUS, TICKET_STATUS, ttc } from "@/lib/format";

export const metadata: Metadata = { title: "Accueil" };

export default async function PortalHome() {
  const user = await requireClient();
  const companyId = user.companyId;

  const [subscription, openInvoices, tickets] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: and(eq(schema.subscriptions.companyId, companyId), ne(schema.subscriptions.status, "CANCELED")),
      with: { plan: true },
    }),
    db.query.invoices.findMany({
      where: and(eq(schema.invoices.companyId, companyId), eq(schema.invoices.status, "OPEN")),
      orderBy: [schema.invoices.dueAt],
    }),
    db.query.tickets.findMany({
      where: and(
        eq(schema.tickets.companyId, companyId),
        inArray(schema.tickets.status, ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"]),
      ),
      orderBy: [desc(schema.tickets.updatedAt)],
      limit: 5,
    }),
  ]);

  const due = openInvoices.reduce((a, i) => a + ttc(i.amountCents, i.vatRate), 0);
  const waiting = tickets.filter((t) => t.status === "WAITING_CLIENT").length;

  return (
    <>
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} description="Votre espace client." />

      {waiting > 0 && (
        <Link href="/portal/tickets" className="mb-6 block rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          {waiting} demande{waiting > 1 ? "s attendent" : " attend"} votre réponse →
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Mon abonnement" actions={<Link href="/portal/billing" className="link text-sm">Gérer</Link>}>
          {subscription ? (
            <div className="p-5">
              <p className="flex items-center gap-2 text-lg font-semibold">
                {subscription.plan.name} <StatusBadge map={SUBSCRIPTION_STATUS} value={subscription.status} />
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {money(subscription.plan.priceCents)} HT / {subscription.plan.interval === "YEAR" ? "an" : "mois"}
              </p>
              <p className="text-sm text-slate-500">
                {subscription.status === "TRIALING" ? "Fin de l'essai" : "Prochaine échéance"} : {date(subscription.currentPeriodEnd)}
              </p>
              {subscription.plan.features.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {subscription.plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
              )}
            </div>
          ) : (
            <Empty>
              Aucun abonnement actif. <Link href="/portal/billing" className="link">Voir les offres</Link>
            </Empty>
          )}
        </Card>

        <Card title="Factures à régler">
          {openInvoices.length === 0 ? (
            <Empty>Vous êtes à jour de vos paiements.</Empty>
          ) : (
            <>
              <table className="table">
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/portal/invoices/${inv.id}`} className="link">{inv.number}</Link>
                        <p className="text-xs text-slate-500">{inv.label}</p>
                      </td>
                      <td className={isOverdue(inv.status, inv.dueAt) ? "text-red-600" : "text-slate-500"}>avant le {date(inv.dueAt)}</td>
                      <td className="text-right tabular-nums">{money(ttc(inv.amountCents, inv.vatRate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-3 text-sm font-medium">Total : {money(due)} TTC</p>
            </>
          )}
        </Card>

        <Card
          title="Mes demandes en cours"
          className="lg:col-span-2"
          actions={<Link href="/portal/tickets/new" className="btn-primary py-1.5">Nouvelle demande</Link>}
        >
          {tickets.length === 0 ? (
            <Empty>Aucune demande en cours.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/tickets/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{t.number} · {t.subject}</p>
                      <p className="text-xs text-slate-500">Mis à jour {dateTime(t.updatedAt)}</p>
                    </div>
                    <StatusBadge map={TICKET_STATUS} value={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
