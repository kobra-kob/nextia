import { and, asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/form";
import { Card, DefinitionList, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import {
  COMPANY_STATUS,
  date,
  dateTime,
  INVOICE_STATUS,
  isOverdue,
  money,
  SUBSCRIPTION_STATUS,
  TICKET_STATUS,
  ttc,
} from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  changePlan,
  markInvoicePaid,
  renewSubscription,
  setSubscriptionStatus,
  voidInvoice,
} from "../../billing-actions";
import { deleteCompany, toggleClientUser } from "../actions";
import { NewClientUserForm, NewInvoiceForm, NewSubscriptionForm, ResetPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Fiche client" };

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  const user = await requireStaff("clients:view");
  const { id } = await params;

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, id),
    with: {
      accountManager: { columns: { name: true } },
      users: { orderBy: [asc(schema.users.name)] },
      subscriptions: { orderBy: [desc(schema.subscriptions.createdAt)], with: { plan: true } },
      invoices: { orderBy: [desc(schema.invoices.issuedAt)] },
      tickets: { orderBy: [desc(schema.tickets.updatedAt)], limit: 8 },
    },
  });
  if (!company) notFound();

  const canEdit = can(user.role, "clients:edit");
  const canBill = can(user.role, "billing:edit");
  const showBilling = can(user.role, "billing:view");

  const plans = canBill
    ? await db.query.plans.findMany({ where: eq(schema.plans.active, true), orderBy: [asc(schema.plans.priceCents)] })
    : [];
  const live = company.subscriptions.find((s) => s.status !== "CANCELED");
  const history = company.subscriptions.filter((s) => s !== live);
  const outstanding = company.invoices.filter((i) => i.status === "OPEN").reduce((a, i) => a + ttc(i.amountCents, i.vatRate), 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {company.name} <StatusBadge map={COMPANY_STATUS} value={company.status} />
          </span>
        }
        description={company.sector ?? undefined}
        back={{ href: "/admin/clients", label: "Clients" }}
        actions={
          <>
            {canEdit && <Link href={`/admin/clients/${company.id}/edit`} className="btn-secondary">Modifier</Link>}
            {can(user.role, "clients:delete") && (
              <ConfirmButton
                action={deleteCompany}
                hidden={{ id: company.id }}
                className="btn-danger"
                confirm={`Supprimer définitivement ${company.name} et toutes ses données (factures, tickets, accès) ?`}
              >
                Supprimer
              </ConfirmButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche : infos */}
        <div className="space-y-6">
          <Card title="Coordonnées">
            <DefinitionList
              items={[
                ["Email", <a key="e" href={`mailto:${company.email}`} className="link">{company.email}</a>],
                ["Téléphone", company.phone],
                ["SIRET", company.siret],
                ["Adresse", company.address],
                ["Responsable", company.accountManager?.name],
                ["Client depuis", date(company.createdAt)],
              ]}
            />
            {company.notes && (
              <div className="border-t border-slate-100 px-5 py-3">
                <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Notes internes</p>
                <p className="text-sm whitespace-pre-line text-slate-700">{company.notes}</p>
              </div>
            )}
          </Card>

          <Card title="Accès au portail client">
            {company.users.length === 0 ? (
              <Empty>Aucun accès créé.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {company.users.map((u) => (
                  <li key={u.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${u.active ? "" : "text-slate-400 line-through"}`}>{u.name}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                      {canEdit && (
                        <ConfirmButton
                          action={toggleClientUser}
                          hidden={{ userId: u.id, companyId: company.id }}
                          className="btn-ghost px-2 py-1 text-xs"
                        >
                          {u.active ? "Désactiver" : "Réactiver"}
                        </ConfirmButton>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Dernière connexion : {dateTime(u.lastLoginAt)}</p>
                    {canEdit && u.active && <ResetPasswordForm userId={u.id} />}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="border-t border-slate-100">
                <NewClientUserForm companyId={company.id} />
              </div>
            )}
          </Card>
        </div>

        {/* Colonne droite : abonnement, factures, tickets */}
        <div className="space-y-6 lg:col-span-2">
          {showBilling && (
            <Card title="Abonnement">
              {live ? (
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold">
                        {live.plan.name} <StatusBadge map={SUBSCRIPTION_STATUS} value={live.status} />
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {money(live.plan.priceCents)} HT / {live.plan.interval === "YEAR" ? "an" : "mois"} · depuis le {date(live.startDate)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {live.status === "TRIALING" ? "Fin d'essai" : "Prochaine échéance"} : {date(live.currentPeriodEnd)}
                      </p>
                    </div>
                    {canBill && (
                      <div className="flex flex-wrap gap-2">
                        <ConfirmButton
                          action={renewSubscription}
                          hidden={{ id: live.id }}
                          confirm="Émettre la facture de la prochaine période et avancer l'échéance ?"
                        >
                          Facturer la période
                        </ConfirmButton>
                        {live.status !== "PAST_DUE" && live.status !== "TRIALING" && (
                          <ConfirmButton action={setSubscriptionStatus} hidden={{ id: live.id, status: "PAST_DUE" }}>
                            Marquer impayé
                          </ConfirmButton>
                        )}
                        {live.status === "PAST_DUE" && (
                          <ConfirmButton action={setSubscriptionStatus} hidden={{ id: live.id, status: "ACTIVE" }}>
                            Repasser actif
                          </ConfirmButton>
                        )}
                        <ConfirmButton
                          action={setSubscriptionStatus}
                          hidden={{ id: live.id, status: "CANCELED" }}
                          className="btn-danger"
                          confirm="Résilier cet abonnement ?"
                        >
                          Résilier
                        </ConfirmButton>
                      </div>
                    )}
                  </div>

                  {canBill && plans.length > 1 && (
                    <form action={changePlan} className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <input type="hidden" name="id" value={live.id} />
                      <label htmlFor="planId" className="text-sm text-slate-600">Changer d&apos;offre :</label>
                      <select id="planId" name="planId" defaultValue={live.planId} className="input w-auto">
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {money(p.priceCents)}</option>
                        ))}
                      </select>
                      <button className="btn-secondary" type="submit">Appliquer</button>
                    </form>
                  )}
                </div>
              ) : canBill ? (
                <NewSubscriptionForm
                  companyId={company.id}
                  plans={plans.map((p) => ({ id: p.id, name: p.name, price: `${money(p.priceCents)} HT/${p.interval === "YEAR" ? "an" : "mois"}` }))}
                />
              ) : (
                <Empty>Aucun abonnement en cours.</Empty>
              )}
              {history.length > 0 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                  Historique : {history.map((h) => `${h.plan.name} (${date(h.startDate)} → ${date(h.canceledAt ?? h.currentPeriodEnd)})`).join(" · ")}
                </p>
              )}
            </Card>
          )}

          {showBilling && (
            <Card
              title="Factures"
              actions={outstanding > 0 && <span className="text-sm text-amber-700">Reste à payer : {money(outstanding)} TTC</span>}
            >
              {company.invoices.length === 0 ? (
                <Empty>Aucune facture.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Libellé</th>
                        <th>Échéance</th>
                        <th className="text-right">TTC</th>
                        <th>Statut</th>
                        {canBill && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {company.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="font-mono text-xs whitespace-nowrap"><Link href={`/admin/invoices/${inv.id}`} className="link">{inv.number}</Link></td>
                          <td>{inv.label}</td>
                          <td className={isOverdue(inv.status, inv.dueAt) ? "font-medium text-red-600" : "text-slate-600"}>{date(inv.dueAt)}</td>
                          <td className="text-right tabular-nums">{money(ttc(inv.amountCents, inv.vatRate))}</td>
                          <td><StatusBadge map={INVOICE_STATUS} value={inv.status} /></td>
                          {canBill && (
                            <td>
                              {inv.status === "OPEN" && (
                                <div className="flex justify-end gap-1">
                                  <ConfirmButton action={markInvoicePaid} hidden={{ id: inv.id }} className="btn-ghost px-2 py-1 text-xs">
                                    Payée
                                  </ConfirmButton>
                                  <ConfirmButton
                                    action={voidInvoice}
                                    hidden={{ id: inv.id }}
                                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                                    confirm={`Annuler la facture ${inv.number} ?`}
                                  >
                                    Annuler
                                  </ConfirmButton>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canBill && (
                <details className="border-t border-slate-100">
                  <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-600">+ Facture ponctuelle</summary>
                  <NewInvoiceForm companyId={company.id} />
                </details>
              )}
            </Card>
          )}

          <Card title="Tickets récents" actions={<Link href={`/admin/tickets?company=${company.id}`} className="link text-sm">Tout voir</Link>}>
            {company.tickets.length === 0 ? (
              <Empty>Aucun ticket.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {company.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <span className="truncate text-sm">#{t.number} · {t.subject}</span>
                      <StatusBadge map={TICKET_STATUS} value={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ActivityCard companyId={company.id} show={can(user.role, "audit:view")} />
        </div>
      </div>
    </>
  );
}

async function ActivityCard({ companyId, show }: { companyId: string; show: boolean }) {
  if (!show) return null;
  const logs = await db.query.auditLogs.findMany({
    where: and(eq(schema.auditLogs.entity, "company"), eq(schema.auditLogs.entityId, companyId)),
    orderBy: [desc(schema.auditLogs.createdAt)],
    limit: 5,
    with: { actor: { columns: { name: true } } },
  });
  if (logs.length === 0) return null;
  return (
    <Card title="Historique de la fiche">
      <ul className="divide-y divide-slate-100 text-sm">
        {logs.map((l) => (
          <li key={l.id} className="flex justify-between px-5 py-2.5">
            <span>{l.actor?.name ?? "Système"} · {l.action}</span>
            <span className="text-slate-500">{dateTime(l.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
