import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/form";
import { ReplyForm } from "@/components/ticket-forms";
import { TicketThread } from "@/components/ticket-thread";
import { PageHeader, StatusBadge } from "@/components/ui";
import { resolveOwnTicket } from "@/app/ticket-actions";
import { requireClient } from "@/lib/auth";
import { TICKET_STATUS } from "@/lib/format";

export const metadata: Metadata = { title: "Demande" };

export default async function PortalTicket({ params }: PageProps<"/portal/tickets/[id]">) {
  const user = await requireClient();
  const { id } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(schema.tickets.id, id), eq(schema.tickets.companyId, user.companyId)),
    with: {
      // Les notes internes de l'équipe ne sortent jamais de la base pour un client.
      messages: {
        where: eq(schema.ticketMessages.internal, false),
        orderBy: [asc(schema.ticketMessages.createdAt)],
        with: { author: { columns: { name: true, role: true } } },
      },
    },
  });
  if (!ticket) notFound();

  const closed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <>
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        back={{ href: "/portal/tickets", label: "Support" }}
        actions={
          <>
            <StatusBadge map={TICKET_STATUS} value={ticket.status} />
            {!closed && (
              <ConfirmButton
                action={resolveOwnTicket}
                hidden={{ ticketId: ticket.id }}
                confirm="Marquer cette demande comme résolue ?"
              >
                Ma demande est résolue
              </ConfirmButton>
            )}
          </>
        }
      />

      <div className="card mb-6 p-5">
        <TicketThread messages={ticket.messages} viewerIsClient />
      </div>

      <div className="card p-5">
        {closed && (
          <p className="mb-3 text-sm text-slate-500">Cette demande est close. Écrire un message la rouvrira.</p>
        )}
        <ReplyForm ticketId={ticket.id} staff={false} />
      </div>
    </>
  );
}
