"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { ticketPriorityEnum, ticketStatusEnum } from "@/db/schema";
import { formObject, fromZod, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { can, isStaff } from "@/lib/permissions";

/**
 * Charge un ticket en vérifiant que l'utilisateur y a accès :
 * l'équipe (droit tickets:view) voit tout, un client ne voit que ceux de son entreprise.
 */
async function loadTicketFor(user: CurrentUser, ticketId: string) {
  const ticket = await db.query.tickets.findFirst({ where: eq(schema.tickets.id, ticketId) });
  if (!ticket) return null;
  if (isStaff(user.role)) return can(user.role, "tickets:view") ? ticket : null;
  return ticket.companyId === user.companyId ? ticket : null;
}

function refresh(ticketId: string) {
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath(`/portal/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  revalidatePath("/admin");
}

const NewTicketSchema = z.object({
  subject: z.string().min(4, "Sujet trop court.").max(200),
  body: z.string().min(5, "Décrivez votre demande."),
  category: z.string().optional(),
  priority: z.enum(ticketPriorityEnum.enumValues).default("NORMAL"),
  companyId: z.string().optional(),
});

export async function createTicket(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée." };

  const parsed = NewTicketSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const data = parsed.data;

  let companyId: string;
  if (user.role === "CLIENT") {
    if (!user.companyId) return { error: "Compte non rattaché à une entreprise." };
    companyId = user.companyId; // jamais celui du formulaire
    if (data.priority === "URGENT") data.priority = "HIGH"; // l'urgence est qualifiée par l'équipe
  } else {
    if (!can(user.role, "tickets:edit") || !data.companyId) return { error: "Action non autorisée." };
    companyId = data.companyId;
  }

  const ticketId = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.tickets)
      .values({
        subject: data.subject,
        category: data.category ?? null,
        priority: data.priority,
        companyId,
        createdById: user.id,
      })
      .returning({ id: schema.tickets.id });
    await tx.insert(schema.ticketMessages).values({ ticketId: t.id, authorId: user.id, body: data.body });
    return t.id;
  });

  await audit(user.id, "create", "ticket", ticketId, data.subject);
  refresh(ticketId);
  redirect(user.role === "CLIENT" ? `/portal/tickets/${ticketId}` : `/admin/tickets/${ticketId}`);
}

const ReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Message vide."),
  internal: z.literal("on").optional(),
  nextStatus: z.enum(ticketStatusEnum.enumValues).optional(),
});

export async function replyTicket(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée." };
  const parsed = ReplySchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { ticketId, body, internal, nextStatus } = parsed.data;

  const ticket = await loadTicketFor(user, ticketId);
  if (!ticket) return { error: "Ticket introuvable." };

  const staff = isStaff(user.role);
  if (staff && !can(user.role, "tickets:edit")) return { error: "Votre rôle ne permet pas de répondre aux tickets." };

  // Statut automatique : une réponse client relance le ticket, une réponse équipe attend le client.
  let status = ticket.status;
  if (staff) {
    if (nextStatus) status = nextStatus;
    else if (!internal && (status === "OPEN" || status === "IN_PROGRESS")) status = "WAITING_CLIENT";
  } else if (status !== "OPEN") {
    status = "IN_PROGRESS";
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.ticketMessages).values({
      ticketId,
      authorId: user.id,
      body,
      internal: staff && Boolean(internal),
    });
    await tx
      .update(schema.tickets)
      .set({
        status,
        updatedAt: new Date(),
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        // Premier membre de l'équipe qui répond = assigné par défaut
        assigneeId: staff && !ticket.assigneeId ? user.id : ticket.assigneeId,
      })
      .where(eq(schema.tickets.id, ticketId));
  });

  refresh(ticketId);
  return { ok: internal ? "Note interne ajoutée." : "Message envoyé." };
}

const UpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(ticketStatusEnum.enumValues),
  priority: z.enum(ticketPriorityEnum.enumValues),
  assigneeId: z.string().optional(),
});

export async function updateTicket(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !can(user.role, "tickets:edit")) throw new Error("Action non autorisée.");
  const { ticketId, status, priority, assigneeId } = UpdateSchema.parse(formObject(formData));
  await db
    .update(schema.tickets)
    .set({
      status,
      priority,
      assigneeId: assigneeId ?? null,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
    })
    .where(eq(schema.tickets.id, ticketId));
  await audit(user.id, "update", "ticket", ticketId, `${status} / ${priority}`);
  refresh(ticketId);
}

/** Le client clôt lui-même sa demande. */
export async function resolveOwnTicket(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENT" || !user.companyId) throw new Error("Action non autorisée.");
  const ticketId = String(formData.get("ticketId"));
  await db
    .update(schema.tickets)
    .set({ status: "RESOLVED", resolvedAt: new Date() })
    .where(and(eq(schema.tickets.id, ticketId), eq(schema.tickets.companyId, user.companyId)));
  refresh(ticketId);
}
