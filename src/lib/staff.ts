import "server-only";
import { and, asc, inArray, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Membres actifs de l'équipe (pour les listes de responsables / assignation). */
export function listStaff(roles: ("ADMIN" | "SALES" | "SUPPORT")[] = ["ADMIN", "SALES", "SUPPORT"]) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
    .from(schema.users)
    .where(and(inArray(schema.users.role, roles), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));
}
