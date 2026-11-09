"use client";

import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { savePlan } from "../billing-actions";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: "MONTH" | "YEAR";
  features: string[];
  stripePriceId: string | null;
};

export function PlanForm({ plan }: { plan?: Plan }) {
  return (
    <ActionForm action={savePlan} resetOnSuccess={!plan} className="space-y-4 p-5">
      {(state) => (
        <>
          <FormMessage state={state} />
          {plan && <input type="hidden" name="id" value={plan.id} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Nom</label>
              <input name="name" className="input" defaultValue={plan?.name} required />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <label className="label">Prix HT (€)</label>
              <input
                name="price"
                inputMode="decimal"
                className="input"
                defaultValue={plan ? (plan.priceCents / 100).toFixed(2).replace(".", ",") : ""}
                required
              />
              <FieldError state={state} name="price" />
            </div>
            <div>
              <label className="label">Périodicité</label>
              <select name="interval" className="input" defaultValue={plan?.interval ?? "MONTH"}>
                <option value="MONTH">Mensuelle</option>
                <option value="YEAR">Annuelle</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" defaultValue={plan?.description ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Inclus (une ligne par élément)</label>
              <textarea name="features" rows={4} className="input" defaultValue={plan?.features.join("\n")} />
            </div>
            <div>
              <label className="label">ID de prix Stripe (optionnel)</label>
              <input name="stripePriceId" className="input font-mono" placeholder="price_…" defaultValue={plan?.stripePriceId ?? ""} />
              <p className="mt-1 text-xs text-slate-500">Requis pour que le client puisse souscrire en ligne depuis son portail.</p>
            </div>
          </div>
          <SubmitButton>{plan ? "Enregistrer" : "Créer l'offre"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
