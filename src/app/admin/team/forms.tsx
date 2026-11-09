"use client";

import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { createStaff, resetStaffPassword } from "./actions";

export function NewStaffForm() {
  return (
    <ActionForm action={createStaff} resetOnSuccess className="space-y-4 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="name">Nom</label>
              <input id="name" name="name" className="input" required />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" required />
              <FieldError state={state} name="email" />
            </div>
            <div>
              <label className="label" htmlFor="role">Rôle</label>
              <select id="role" name="role" className="input" defaultValue="SUPPORT">
                <option value="ADMIN">Gérant (accès total)</option>
                <option value="SALES">Commercial</option>
                <option value="SUPPORT">Support</option>
              </select>
            </div>
          </div>
          <SubmitButton>Ajouter le membre</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResetStaffPassword({ userId }: { userId: string }) {
  return (
    <ActionForm action={resetStaffPassword} className="inline">
      {(state) => (
        <>
          <input type="hidden" name="userId" value={userId} />
          {state.ok || state.error ? (
            <span className={`text-xs ${state.error ? "text-red-600" : "text-emerald-700"}`}>{state.ok ?? state.error}</span>
          ) : (
            <SubmitButton className="btn-ghost px-2 py-1 text-xs" pendingLabel="…">
              Nouveau mot de passe
            </SubmitButton>
          )}
        </>
      )}
    </ActionForm>
  );
}
