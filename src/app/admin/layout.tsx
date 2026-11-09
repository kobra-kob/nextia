import { IconBuilding, IconChat, IconFile, IconHome, IconList, IconTag, IconUsers } from "@/components/icons";
import { Shell, type NavItem } from "@/components/shell";
import { requireStaff } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { can } from "@/lib/permissions";
import { logout } from "../login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();

  const nav: NavItem[] = [
    { href: "/admin", label: "Tableau de bord", icon: <IconHome />, exact: true },
    { href: "/admin/clients", label: "Clients", icon: <IconBuilding /> },
  ];
  if (can(user.role, "billing:view")) nav.push({ href: "/admin/invoices", label: "Factures", icon: <IconFile /> });
  nav.push({ href: "/admin/tickets", label: "Tickets", icon: <IconChat /> });
  if (can(user.role, "billing:view")) nav.push({ href: "/admin/plans", label: "Offres", icon: <IconTag /> });
  if (can(user.role, "team:manage")) nav.push({ href: "/admin/team", label: "Équipe", icon: <IconUsers /> });
  if (can(user.role, "audit:view")) nav.push({ href: "/admin/activity", label: "Journal", icon: <IconList /> });

  return (
    <Shell brand="Back-office" nav={nav} user={{ name: user.name, subtitle: ROLE_LABELS[user.role].label }} logout={logout} accountHref="/admin/account">
      {children}
    </Shell>
  );
}
