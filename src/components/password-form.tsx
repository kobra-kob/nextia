"use client";

import { changeOwnPassword } from "@/app/account-actions";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "./form";

export function PasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} resetOnSuccess className="max-w-md space-y-4 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          <div>
            <label className="label" htmlFor="current">Mot de passe actuel</label>
            <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
            <FieldError state={state} name="current" />
          </div>
          <div>
            <label className="label" htmlFor="next">Nouveau mot de passe</label>
            <input id="next" name="next" type="password" autoComplete="new-password" className="input" required minLength={10} />
            <FieldError state={state} name="next" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirmation</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required />
            <FieldError state={state} name="confirm" />
          </div>
          <SubmitButton>Changer le mot de passe</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
