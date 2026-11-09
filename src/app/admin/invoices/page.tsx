import { and, desc, eq, lt, gte, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/form";
import { Card, Empty, FilterTabs, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { date, INVOICE_STATUS, isOverdue, money, ttc } from "@/lib/format";
import { can } from "@/lib/permissions";
import { markInvoicePaid } from "../billing-actions";

export const metadata: Metadata = { title: "Factures" };

const FILTERS = {
  open: { label: "À payer", where: () => eq(schema.invoices.status, "OPEN") },
  overdue: {
    label: "En retard",
    where: () => and(eq(schema.invoices.status, "OPEN"), lt(schema.invoices.dueAt, new Date()))!,
  },
  paid: { label: "Payées", where: () => eq(schema.invoices.status, "PAID") },
  void: { label: "Annulées", where: () => eq(schema.invoices.status, "VOID") },
} satisfies Record<string, { label: string; where: () => SQL }>;

export default async function InvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  const user = await requireStaff("billing:view");
  const sp = await searchParams;
  const key = typeof sp.status === "string" && sp.status in FILTERS ? (sp.status as keyof typeof FILTERS) : undefined;
  const i = schema.invoices;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, [totals]] = await Promise.all([
    db.query.invoices.findMany({
      where: key ? FILTERS[key].where() : undefined,
      orderBy: [desc(i.issuedAt)],
      limit: 200,
      with: { company: { columns: { id: true, name: true } } },
    }),
    db
      .select({
        open: sql<number>`coalesce(sum(case when ${i.status} = 'OPEN' then ${i.amountCents} * (100 + ${i.vatRate}) / 100 end), 0)::int`,
        overdue: sql<number>`coalesce(sum(case when ${i.status} = 'OPEN' and ${i.dueAt} < now() then ${i.amountCents} * (100 + ${i.vatRate}) / 100 end), 0)::int`,
        paidMonth: sql<number>`coalesce(sum(case when ${i.status} = 'PAID' and ${gte(i.paidAt, startOfMonth)} then ${i.amountCents} * (100 + ${i.vatRate}) / 100 end), 0)::int`,
      })
      .from(i),
  ]);

  const canBill = can(user.role, "billing:edit");

  return (
    <>
      <PageHeader title="Factures" description="Toutes les factures émises, montants TTC." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Encaissé ce mois-ci" value={money(totals.paidMonth)} />
        <Stat label="Reste à encaisser" value={money(totals.open)} />
        <Stat label="Dont en retard" value={money(totals.overdue)} tone={totals.overdue > 0 ? "red" : "default"} />
      </div>

      <FilterTabs
        base="/admin/invoices"
        param="status"
        current={key}
        options={[{ label: "Toutes" }, ...Object.entries(FILTERS).map(([v, f]) => ({ value: v, label: f.label }))]}
      />

      <Card>
        {rows.length === 0 ? (
          <Empty>Aucune facture.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Libellé</th>
                  <th>Émise</th>
                  <th>Échéance</th>
                  <th className="text-right">TTC</th>
                  <th>Statut</th>
                  {canBill && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs whitespace-nowrap"><Link href={`/admin/invoices/${inv.id}`} className="link">{inv.number}</Link></td>
                    <td><Link href={`/admin/clients/${inv.company.id}`} className="link">{inv.company.name}</Link></td>
                    <td className="text-slate-600">{inv.label}</td>
                    <td className="text-slate-500">{date(inv.issuedAt)}</td>
                    <td className={isOverdue(inv.status, inv.dueAt) ? "font-medium text-red-600" : "text-slate-500"}>{date(inv.dueAt)}</td>
                    <td className="text-right tabular-nums">{money(ttc(inv.amountCents, inv.vatRate))}</td>
                    <td><StatusBadge map={INVOICE_STATUS} value={inv.status} /></td>
                    {canBill && (
                      <td className="text-right">
                        {inv.status === "OPEN" && (
                          <ConfirmButton action={markInvoicePaid} hidden={{ id: inv.id }} className="btn-ghost px-2 py-1 text-xs">
                            Marquer payée
                          </ConfirmButton>
                        )}
                      </td>
                    )}
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
