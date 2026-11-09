import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { ReplyForm } from "@/components/ticket-forms";
import { TicketThread } from "@/components/ticket-thread";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui";
import { updateTicket } from "@/app/ticket-actions";
import { requireStaff } from "@/lib/auth";
import { dateTime, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: PageProps<"/admin/tickets/[id]">) {
  const user = await requireStaff("tickets:view");
  const { id } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: eq(schema.tickets.id, id),
    with: {
      company: { columns: { id: true, name: true, email: true, phone: true } },
      createdBy: { columns: { name: true, email: true } },
      messages: {
        orderBy: [asc(schema.ticketMessages.createdAt)],
        with: { author: { columns: { name: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();

  const canEdit = can(user.role, "tickets:edit");
  const staff = canEdit ? await listStaff(["ADMIN", "SUPPORT"]) : [];

  return (
    <>
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        back={{ href: "/admin/tickets", label: "Tickets" }}
        actions={
          <>
            <StatusBadge map={TICKET_PRIORITY} value={ticket.priority} />
            <StatusBadge map={TICKET_STATUS} value={ticket.status} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <TicketThread messages={ticket.messages} viewerIsClient={false} />
          </div>
          {canEdit ? (
            <Card title="Répondre">
              <div className="p-5">
                <ReplyForm ticketId={ticket.id} staff />
              </div>
            </Card>
          ) : (
            <p className="text-sm text-slate-500">Lecture seule : votre rôle ne permet pas de répondre.</p>
          )}
        </div>

        <div className="space-y-6">
          {canEdit && (
            <Card title="Traitement">
              <form action={updateTicket} className="space-y-4 p-5">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <div>
                  <label className="label" htmlFor="status">Statut</label>
                  <select id="status" name="status" defaultValue={ticket.status} className="input">
                    {Object.entries(TICKET_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="priority">Priorité</label>
                  <select id="priority" name="priority" defaultValue={ticket.priority} className="input">
                    {Object.entries(TICKET_PRIORITY).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="assigneeId">Assigné à</label>
                  <select id="assigneeId" name="assigneeId" defaultValue={ticket.assigneeId ?? ""} className="input">
                    <option value="">— Personne —</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-secondary w-full">Mettre à jour</button>
              </form>
            </Card>
          )}

          <Card title="Informations">
            <DefinitionList
              items={[
                ["Client", <Link key="c" href={`/admin/clients/${ticket.company.id}`} className="link">{ticket.company.name}</Link>],
                ["Demandeur", `${ticket.createdBy.name}`],
                ["Contact", ticket.company.phone ?? ticket.company.email],
                ["Catégorie", ticket.category],
                ["Ouvert le", dateTime(ticket.createdAt)],
                ["Résolu le", ticket.resolvedAt ? dateTime(ticket.resolvedAt) : null],
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
