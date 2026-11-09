import { and, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { InvoiceDocument } from "@/components/invoice-document";
import { PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";

export const metadata: Metadata = { title: "Facture" };

export default async function PortalInvoicePage({ params }: PageProps<"/portal/invoices/[id]">) {
  const user = await requireClient();
  const { id } = await params;
  // Filtré sur l'entreprise du client : impossible d'ouvrir la facture d'un autre.
  const invoice = await db.query.invoices.findFirst({
    where: and(
      eq(schema.invoices.id, id),
      eq(schema.invoices.companyId, user.companyId),
      ne(schema.invoices.status, "DRAFT"),
    ),
    with: { company: true },
  });
  if (!invoice) notFound();

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={`Facture ${invoice.number}`} back={{ href: "/portal/billing", label: "Mes factures" }} />
      </div>
      <InvoiceDocument invoice={invoice} />
    </>
  );
}
