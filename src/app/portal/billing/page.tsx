import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { date, INVOICE_STATUS, isOverdue, money, SUBSCRIPTION_STATUS, ttc } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";
import { openBillingPortal, startCheckout } from "../billing-actions";

export const metadata: Metadata = { title: "Abonnement & factures" };

const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  success: { tone: "ok", text: "Merci ! Votre paiement est confirmé. L'abonnement apparaît ici dans quelques secondes." },
  cancel: { tone: "warn", text: "Paiement annulé, rien n'a été prélevé." },
  stripe: { tone: "warn", text: "Le paiement en ligne n'est pas encore disponible. Contactez-nous pour souscrire." },
  plan: { tone: "warn", text: "Cette offre ne peut pas être souscrite en ligne. Contactez-nous." },
  exists: { tone: "warn", text: "Vous avez déjà un abonnement en cours. Gérez-le depuis l'espace de paiement." },
};

export default async function PortalBilling({ searchParams }: PageProps<"/portal/billing">) {
  const user = await requireClient();
  const sp = await searchParams;
  const msgKey = (typeof sp.checkout === "string" && sp.checkout) || (typeof sp.error === "string" && sp.error) || "";
  const msg = MESSAGES[msgKey];

  const [subscription, invoices, plans, company] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: and(eq(schema.subscriptions.companyId, user.companyId), ne(schema.subscriptions.status, "CANCELED")),
      with: { plan: true },
    }),
    db.query.invoices.findMany({
      where: and(eq(schema.invoices.companyId, user.companyId), ne(schema.invoices.status, "DRAFT")),
      orderBy: [desc(schema.invoices.issuedAt)],
    }),
    db.query.plans.findMany({ where: eq(schema.plans.active, true), orderBy: [asc(schema.plans.priceCents)] }),
    db.query.companies.findFirst({
      where: eq(schema.companies.id, user.companyId),
      columns: { stripeCustomerId: true },
    }),
  ]);

  const online = stripeEnabled();

  return (
    <>
      <PageHeader title="Abonnement & factures" />

      {msg && (
        <p className={`mb-6 rounded-lg px-4 py-3 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {msg.text}
        </p>
      )}

      {subscription ? (
        <Card
          title="Mon abonnement"
          className="mb-6"
          actions={
            online &&
            company?.stripeCustomerId && (
              <form action={openBillingPortal}>
                <button className="btn-secondary py-1.5" type="submit">Moyen de paiement</button>
              </form>
            )
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                {subscription.plan.name} <StatusBadge map={SUBSCRIPTION_STATUS} value={subscription.status} />
              </p>
              <p className="text-sm text-slate-500">
                {money(subscription.plan.priceCents)} HT / {subscription.plan.interval === "YEAR" ? "an" : "mois"} · client depuis le {date(subscription.startDate)}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {subscription.cancelAtPeriodEnd ? "Se termine le " : subscription.status === "TRIALING" ? "Fin de l'essai : " : "Prochaine échéance : "}
              <strong>{date(subscription.currentPeriodEnd)}</strong>
            </p>
          </div>
          {subscription.status === "PAST_DUE" && (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-red-700">
              Un paiement est en attente. Merci de régulariser pour éviter une suspension du service.
            </p>
          )}
        </Card>
      ) : (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Choisir une offre</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="card flex flex-col p-5">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {money(p.priceCents)} <span className="text-sm font-normal text-slate-500">HT / {p.interval === "YEAR" ? "an" : "mois"}</span>
                </p>
                {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
                <ul className="mt-3 flex-1 space-y-1 text-sm">
                  {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                {online && p.stripePriceId ? (
                  <form action={startCheckout} className="mt-4">
                    <input type="hidden" name="planId" value={p.id} />
                    <button className="btn-primary w-full" type="submit">Souscrire</button>
                  </form>
                ) : (
                  <Link href="/portal/tickets/new" className="btn-secondary mt-4 w-full">Nous contacter</Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Card title="Mes factures">
        {invoices.length === 0 ? (
          <Empty>Aucune facture pour l&apos;instant.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Libellé</th>
                  <th>Date</th>
                  <th>Échéance</th>
                  <th className="text-right">TTC</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs whitespace-nowrap"><Link href={`/portal/invoices/${inv.id}`} className="link">{inv.number}</Link></td>
                    <td>{inv.label}</td>
                    <td className="text-slate-500">{date(inv.issuedAt)}</td>
                    <td className={isOverdue(inv.status, inv.dueAt) ? "font-medium text-red-600" : "text-slate-500"}>{date(inv.dueAt)}</td>
                    <td className="text-right tabular-nums">{money(ttc(inv.amountCents, inv.vatRate))}</td>
                    <td><StatusBadge map={INVOICE_STATUS} value={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
