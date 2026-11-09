import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditClientPage({ params }: PageProps<"/admin/clients/[id]/edit">) {
  await requireStaff("clients:edit");
  const { id } = await params;
  const [company, staff] = await Promise.all([
    db.query.companies.findFirst({ where: eq(schema.companies.id, id) }),
    listStaff(["ADMIN", "SALES"]),
  ]);
  if (!company) notFound();

  return (
    <>
      <PageHeader title={`Modifier ${company.name}`} back={{ href: `/admin/clients/${id}`, label: company.name }} />
      <CompanyForm company={company} staff={staff} />
    </>
  );
}
