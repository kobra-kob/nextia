import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { can, isStaff, type Permission } from "./permissions";
import { readSession } from "./session";

/**
 * Couche d'accès (DAL) : toute page ou action serveur passe par ici.
 * La session est re-vérifiée en base à chaque requête (compte désactivé = déconnecté).
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { id: true, name: true, email: true, role: true, companyId: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Membre de l'équipe interne (back-office). */
export async function requireStaff(permission?: Permission) {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/portal");
  if (permission && !can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

/** Utilisateur d'une entreprise cliente (portail). */
export async function requireClient() {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.companyId) redirect("/admin");
  return user as CurrentUser & { companyId: string };
}

/** Variante pour les actions serveur : lève une erreur au lieu de rediriger. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !can(user.role, permission)) {
    throw new Error("Action non autorisée.");
  }
  return user;
}
