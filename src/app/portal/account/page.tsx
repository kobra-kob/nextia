import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { PasswordForm } from "@/components/password-form";
import { Card, DefinitionList, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";

export const metadata: Metadata = { title: "Mon compte" };

export default async function PortalAccount() {
  const user = await requireClient();
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.id, user.companyId) });

  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profil">
          <DefinitionList
            items={[
              ["Nom", user.name],
              ["Email", user.email],
              ["Entreprise", company?.name],
              ["Adresse de facturation", company?.address],
              ["SIRET", company?.siret],
            ]}
          />
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Une information à corriger ? Envoyez-nous une demande depuis l&apos;onglet Support.
          </p>
        </Card>
        <Card title="Mot de passe">
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
