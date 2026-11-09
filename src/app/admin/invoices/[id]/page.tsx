import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { InvoiceDocument } from "@/components/invoice-document";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Facture" };

export default async function AdminInvoicePage({ params }: PageProps<"/admin/invoices/[id]">) {
  await requireStaff("billing:view");
  const { id } = await params;
  const invoice = await db.query.invoices.findFirst({
    where: eq(schema.invoices.id, id),
    with: { company: true },
  });
  if (!invoice) notFound();

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={`Facture ${invoice.number}`} back={{ href: `/admin/clients/${invoice.companyId}`, label: invoice.company.name }} />
      </div>
      <InvoiceDocument invoice={invoice} />
    </>
  );
}
