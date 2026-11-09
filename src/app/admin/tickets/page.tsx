import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db, schema } from "@/db";
import type { TicketStatus } from "@/db/schema";
import { Card, Empty, FilterTabs, PageHeader, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { dateTime, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Tickets" };

const ACTIVE: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"];

export default async function TicketsPage({ searchParams }: PageProps<"/admin/tickets">) {
  const user = await requireStaff("tickets:view");
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "active";
  const companyId = typeof sp.company === "string" ? sp.company : undefined;
  const t = schema.tickets;

  const filters: SQL[] = [];
  if (companyId) filters.push(eq(t.companyId, companyId));
  if (view === "active") filters.push(inArray(t.status, ACTIVE));
  else if (view === "mine") filters.push(and(eq(t.assigneeId, user.id), inArray(t.status, ACTIVE))!);
  else if (view === "unassigned") filters.push(inArray(t.status, ACTIVE));
  else if (view in TICKET_STATUS) filters.push(eq(t.status, view as TicketStatus));

  const [rows, counts] = await Promise.all([
    db.query.tickets.findMany({
      where: filters.length ? and(...filters) : undefined,
      orderBy: [desc(t.updatedAt)],
      limit: 200,
      with: {
        company: { columns: { id: true, name: true } },
        assignee: { columns: { name: true } },
      },
    }),
    db.select({ status: t.status, n: count() }).from(t).groupBy(t.status),
  ]);

  const list = view === "unassigned" ? rows.filter((r) => !r.assigneeId) : rows;
  const activeCount = counts.filter((c) => ACTIVE.includes(c.status)).reduce((a, c) => a + c.n, 0);
  const companyName = companyId ? rows[0]?.company.name : undefined;

  return (
    <>
      <PageHeader
        title="Tickets"
        description={companyName ? `Filtré sur ${companyName}` : "Demandes de support des clients."}
        actions={can(user.role, "tickets:edit") && <Link href="/admin/tickets/new" className="btn-primary">Nouveau ticket</Link>}
      />

      <FilterTabs
        base="/admin/tickets"
        param="view"
        keep={{ company: companyId }}
        current={view === "active" ? undefined : view}
        options={[
          { label: "À traiter", count: activeCount },
          { value: "mine", label: "Assignés à moi" },
          { value: "unassigned", label: "Non assignés" },
          { value: "RESOLVED", label: "Résolus" },
          { value: "CLOSED", label: "Fermés" },
          { value: "all", label: "Tous" },
        ]}
      />

      <Card>
        {list.length === 0 ? (
          <Empty>Aucun ticket dans cette vue.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Client</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Assigné</th>
                  <th>Activité</th>
                </tr>
              </thead>
              <tbody>
                {list.map((tk) => (
                  <tr key={tk.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/admin/tickets/${tk.id}`} className="link">#{tk.number} · {tk.subject}</Link>
                      {tk.category && <p className="text-xs text-slate-500">{tk.category}</p>}
                    </td>
                    <td><Link href={`/admin/clients/${tk.company.id}`} className="text-slate-700 hover:underline">{tk.company.name}</Link></td>
                    <td><StatusBadge map={TICKET_PRIORITY} value={tk.priority} /></td>
                    <td><StatusBadge map={TICKET_STATUS} value={tk.status} /></td>
                    <td className="text-slate-600">{tk.assignee?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap text-slate-500">{dateTime(tk.updatedAt)}</td>
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
