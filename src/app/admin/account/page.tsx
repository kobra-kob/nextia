import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";
import { Card, DefinitionList, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profil">
          <DefinitionList items={[["Nom", me.name], ["Email", me.email], ["Rôle", ROLE_LABELS[me.role].label]]} />
        </Card>
        <Card title="Mot de passe">
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
