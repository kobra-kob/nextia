"use client";

import Link from "next/link";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { COMPANY_STATUS } from "@/lib/format";
import { saveCompany } from "./actions";

type Company = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  siret: string | null;
  address: string | null;
  sector: string | null;
  status: string;
  accountManagerId: string | null;
  notes: string | null;
};

export function CompanyForm({ company, staff }: { company?: Company; staff: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveCompany} className="card space-y-5 p-6">
      {(state) => (
        <>
          <FormMessage state={state} />
          {company && <input type="hidden" name="id" value={company.id} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Raison sociale *</label>
              <input id="name" name="name" className="input" defaultValue={company?.name} required />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email de contact *</label>
              <input id="email" name="email" type="email" className="input" defaultValue={company?.email} required />
              <FieldError state={state} name="email" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Téléphone</label>
              <input id="phone" name="phone" className="input" defaultValue={company?.phone ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="siret">SIRET</label>
              <input id="siret" name="siret" className="input" defaultValue={company?.siret ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="sector">Secteur</label>
              <input id="sector" name="sector" className="input" placeholder="Garage, cabinet comptable…" defaultValue={company?.sector ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address">Adresse</label>
              <input id="address" name="address" className="input" defaultValue={company?.address ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="status">Statut</label>
              <select id="status" name="status" className="input" defaultValue={company?.status ?? "ONBOARDING"}>
                {Object.entries(COMPANY_STATUS).map(([v, s]) => (
                  <option key={v} value={v}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="accountManagerId">Responsable du compte</label>
              <select id="accountManagerId" name="accountManagerId" className="input" defaultValue={company?.accountManagerId ?? ""}>
                <option value="">— Aucun —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Notes internes</label>
              <textarea id="notes" name="notes" rows={4} className="input" defaultValue={company?.notes ?? ""} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <Link href={company ? `/admin/clients/${company.id}` : "/admin/clients"} className="btn-secondary">
              Annuler
            </Link>
            <SubmitButton>{company ? "Enregistrer" : "Créer le client"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
