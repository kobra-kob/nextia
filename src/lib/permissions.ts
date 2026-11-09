import type { Role } from "@/db/schema";

/**
 * Matrice des droits. Ajouter un rôle ou un droit se fait ici uniquement.
 * Les pages ET les actions serveur vérifient ces droits (jamais seulement l'UI).
 */
export const PERMISSIONS = {
  "dashboard:view": ["ADMIN", "SALES", "SUPPORT"],
  "clients:view": ["ADMIN", "SALES", "SUPPORT"],
  "clients:edit": ["ADMIN", "SALES"],
  "clients:delete": ["ADMIN"],
  "billing:view": ["ADMIN", "SALES"],
  "billing:edit": ["ADMIN", "SALES"],
  "plans:edit": ["ADMIN"],
  "tickets:view": ["ADMIN", "SALES", "SUPPORT"],
  "tickets:edit": ["ADMIN", "SUPPORT"],
  "team:manage": ["ADMIN"],
  "audit:view": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const STAFF_ROLES: Role[] = ["ADMIN", "SALES", "SUPPORT"];
export const isStaff = (role: Role) => STAFF_ROLES.includes(role);
