import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'activité" };

const ENTITY_LABELS: Record<string, string> = {
  company: "Client",
  user: "Utilisateur",
  subscription: "Abonnement",
  invoice: "Facture",
  plan: "Offre",
  ticket: "Ticket",
  system: "Système",
};

export default async function ActivityPage() {
  await requireStaff("audit:view");
  const logs = await db.query.auditLogs.findMany({
    orderBy: [desc(schema.auditLogs.createdAt)],
    limit: 200,
    with: { actor: { columns: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Journal d'activité" description="Les 200 dernières actions effectuées sur la plateforme." />
      <Card>
        {logs.length === 0 ? (
          <Empty>Aucune activité.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Auteur</th>
                  <th>Action</th>
                  <th>Objet</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-slate-500">{dateTime(l.createdAt)}</td>
                    <td>{l.actor?.name ?? "Système"}</td>
                    <td className="font-mono text-xs whitespace-nowrap">{l.action}</td>
                    <td>{ENTITY_LABELS[l.entity] ?? l.entity}</td>
                    <td className="text-slate-600">{l.details ?? ""}</td>
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
