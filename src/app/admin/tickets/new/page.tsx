import { asc, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { NewTicketForm } from "@/components/ticket-forms";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Nouveau ticket" };

export default async function NewTicketPage() {
  await requireStaff("tickets:edit");
  const companies = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(ne(schema.companies.status, "CHURNED"))
    .orderBy(asc(schema.companies.name));

  return (
    <>
      <PageHeader
        title="Nouveau ticket"
        description="Pour une demande reçue par téléphone ou email."
        back={{ href: "/admin/tickets", label: "Tickets" }}
      />
      <NewTicketForm companies={companies} />
    </>
  );
}
