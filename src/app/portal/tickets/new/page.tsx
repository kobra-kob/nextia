import type { Metadata } from "next";
import { NewTicketForm } from "@/components/ticket-forms";
import { PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";

export const metadata: Metadata = { title: "Nouvelle demande" };

export default async function PortalNewTicket() {
  await requireClient();
  return (
    <>
      <PageHeader title="Nouvelle demande" back={{ href: "/portal/tickets", label: "Support" }} />
      <NewTicketForm />
    </>
  );
}
