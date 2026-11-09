"use client";

import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { createInvoice, createSubscription } from "../../billing-actions";
import { addClientUser, resetClientPassword } from "../actions";

export function NewSubscriptionForm({
  companyId,
  plans,
}: {
  companyId: string;
  plans: { id: string; name: string; price: string }[];
}) {
  return (
    <ActionForm action={createSubscription} className="space-y-4 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="companyId" value={companyId} />
          <div>
            <label className="label" htmlFor="planId">Offre</label>
            <select id="planId" name="planId" className="input" required defaultValue="">
              <option value="" disabled>Choisir une offre…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.price}</option>
              ))}
            </select>
            <FieldError state={state} name="planId" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="trialDays">Jours d&apos;essai</label>
              <input id="trialDays" name="trialDays" type="number" min={0} max={90} defaultValue={14} className="input" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="invoiceNow" className="h-4 w-4 rounded border-slate-300" />
              Facturer immédiatement (si pas d&apos;essai)
            </label>
          </div>
          <SubmitButton>Démarrer l&apos;abonnement</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function NewInvoiceForm({ companyId }: { companyId: string }) {
  return (
    <ActionForm action={createInvoice} resetOnSuccess className="space-y-4 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="companyId" value={companyId} />
          <div>
            <label className="label" htmlFor="label">Libellé</label>
            <input id="label" name="label" className="input" placeholder="Frais de mise en place" required />
            <FieldError state={state} name="label" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="amount">Montant HT (€)</label>
              <input id="amount" name="amount" inputMode="decimal" className="input" placeholder="150,00" required />
              <FieldError state={state} name="amount" />
            </div>
            <div>
              <label className="label" htmlFor="vatRate">TVA (%)</label>
              <input id="vatRate" name="vatRate" type="number" defaultValue={20} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="dueInDays">Échéance (jours)</label>
              <input id="dueInDays" name="dueInDays" type="number" defaultValue={15} className="input" />
            </div>
          </div>
          <SubmitButton>Créer la facture</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function NewClientUserForm({ companyId }: { companyId: string }) {
  return (
    <ActionForm action={addClientUser} resetOnSuccess className="space-y-3 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="companyId" value={companyId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input name="name" className="input" placeholder="Nom complet" required />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <input name="email" type="email" className="input" placeholder="email@client.fr" required />
              <FieldError state={state} name="email" />
            </div>
          </div>
          <SubmitButton className="btn-secondary">Créer l&apos;accès portail</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <ActionForm action={resetClientPassword} className="inline">
      {(state) => (
        <>
          <input type="hidden" name="userId" value={userId} />
          {state.ok || state.error ? (
            <span className={`text-xs ${state.error ? "text-red-600" : "text-emerald-700"}`}>{state.ok ?? state.error}</span>
          ) : (
            <SubmitButton className="btn-ghost px-2 py-1 text-xs" pendingLabel="…">
              Réinitialiser le mot de passe
            </SubmitButton>
          )}
        </>
      )}
    </ActionForm>
  );
}
