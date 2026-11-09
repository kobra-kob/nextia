"use client";

import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={login}>
      {(state) => (
        <>
          <FormMessage state={state} />
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn-primary w-full" pendingLabel="Connexion…">
            Se connecter
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
