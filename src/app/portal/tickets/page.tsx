import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { dateTime, TICKET_STATUS } from "@/lib/format";

export const metadata: Metadata = { title: "Support" };

export default async function PortalTickets() {
  const user = await requireClient();
  const tickets = await db.query.tickets.findMany({
    where: eq(schema.tickets.companyId, user.companyId),
    orderBy: [desc(schema.tickets.updatedAt)],
    with: { createdBy: { columns: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Support"
        description="Vos demandes et nos réponses."
        actions={<Link href="/portal/tickets/new" className="btn-primary">Nouvelle demande</Link>}
      />
      <Card>
        {tickets.length === 0 ? (
          <Empty>Aucune demande. Une question ? Créez une demande, nous répondons rapidement.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Demande</th>
                  <th>Créée par</th>
                  <th>Statut</th>
                  <th>Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/portal/tickets/${t.id}`} className="link">#{t.number} · {t.subject}</Link>
                    </td>
                    <td className="text-slate-600">{t.createdBy.name}</td>
                    <td><StatusBadge map={TICKET_STATUS} value={t.status} /></td>
                    <td className="text-slate-500">{dateTime(t.updatedAt)}</td>
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
