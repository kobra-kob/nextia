"use client";

import { createTicket, replyTicket } from "@/app/ticket-actions";
import { TICKET_STATUS } from "@/lib/format";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "./form";

export function ReplyForm({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  return (
    <ActionForm action={replyTicket} resetOnSuccess className="space-y-3">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="ticketId" value={ticketId} />
          <textarea name="body" rows={4} required className="input" placeholder="Votre message…" />
          <FieldError state={state} name="body" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {staff ? (
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="internal" className="h-4 w-4 rounded border-slate-300" />
                  Note interne (invisible du client)
                </label>
                <label className="flex items-center gap-2">
                  Puis passer à
                  <select name="nextStatus" defaultValue="" className="input w-auto py-1">
                    <option value="">Automatique</option>
                    {Object.entries(TICKET_STATUS).map(([v, s]) => (
                      <option key={v} value={v}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <span />
            )}
            <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function NewTicketForm({
  companies,
  categories = ["Configuration", "Facturation", "Question", "Problème technique", "Autre"],
}: {
  companies?: { id: string; name: string }[];
  categories?: string[];
}) {
  const staff = Boolean(companies);
  return (
    <ActionForm action={createTicket} className="card space-y-4 p-6">
      {(state) => (
        <>
          <FormMessage state={state} />
          {companies && (
            <div>
              <label className="label" htmlFor="companyId">Client</label>
              <select id="companyId" name="companyId" className="input" required defaultValue="">
                <option value="" disabled>Choisir…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="subject">Sujet</label>
            <input id="subject" name="subject" className="input" required maxLength={200} />
            <FieldError state={state} name="subject" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="category">Catégorie</label>
              <select id="category" name="category" className="input" defaultValue={categories[0]}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="priority">Priorité</label>
              <select id="priority" name="priority" className="input" defaultValue="NORMAL">
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                {staff && <option value="URGENT">Urgente</option>}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="body">Description</label>
            <textarea id="body" name="body" rows={6} className="input" required />
            <FieldError state={state} name="body" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Envoi…">Créer le ticket</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
