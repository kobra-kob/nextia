import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listStaff } from "@/lib/staff";
import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  await requireStaff("clients:edit");
  const staff = await listStaff(["ADMIN", "SALES"]);
  return (
    <>
      <PageHeader title="Nouveau client" back={{ href: "/admin/clients", label: "Clients" }} />
      <CompanyForm staff={staff} />
    </>
  );
}
