import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { IconCard, IconChat, IconHome } from "@/components/icons";
import { Shell, type NavItem } from "@/components/shell";
import { requireClient } from "@/lib/auth";
import { logout } from "../login/actions";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireClient();
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, user.companyId),
    columns: { name: true },
  });

  const nav: NavItem[] = [
    { href: "/portal", label: "Accueil", icon: <IconHome />, exact: true },
    { href: "/portal/billing", label: "Abonnement & factures", icon: <IconCard /> },
    { href: "/portal/tickets", label: "Support", icon: <IconChat /> },
  ];

  return (
    <Shell
      brand="Espace client"
      nav={nav}
      user={{ name: user.name, subtitle: company?.name ?? "" }}
      logout={logout}
      accountHref="/portal/account"
    >
      {children}
    </Shell>
  );
}
