"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { formObject, fromZod, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth";
import { createUser, emailTaken, hashPassword, tempPassword } from "@/lib/users";

const StaffRole = z.enum(["ADMIN", "SALES", "SUPPORT"]);

const NewStaffSchema = z.object({
  name: z.string().min(2, "Nom requis."),
  email: z.email("Email invalide."),
  role: StaffRole,
});

export async function createStaff(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await assertPermission("team:manage");
  const parsed = NewStaffSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  if (await emailTaken(parsed.data.email)) {
    return { error: "Cet email est déjà utilisé.", fieldErrors: { email: "Email déjà utilisé." } };
  }
  const created = await createUser(parsed.data);
  await audit(me.id, "create", "user", created.id, `${parsed.data.email} (${parsed.data.role})`);
  revalidatePath("/admin/team");
  return {
    ok: `Compte créé pour ${parsed.data.email}. Mot de passe temporaire : ${created.password} (affiché une seule fois).`,
  };
}

/** Garde-fou : il doit toujours rester au moins un gérant actif. */
async function otherActiveAdmins(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.users)
    .where(and(eq(schema.users.role, "ADMIN"), eq(schema.users.active, true), ne(schema.users.id, userId)));
  return row.n;
}

export async function updateStaffRole(formData: FormData) {
  const me = await assertPermission("team:manage");
  const { id, role } = z.object({ id: z.string(), role: StaffRole }).parse(formObject(formData));
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!target || target.role === "CLIENT") throw new Error("Membre introuvable.");
  if (target.role === "ADMIN" && role !== "ADMIN" && (await otherActiveAdmins(id)) === 0) {
    throw new Error("Impossible : il doit rester au moins un gérant.");
  }
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, id));
  await audit(me.id, `role:${role}`, "user", id);
  revalidatePath("/admin/team");
}

export async function toggleStaffActive(formData: FormData) {
  const me = await assertPermission("team:manage");
  const id = String(formData.get("id"));
  if (id === me.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!target || target.role === "CLIENT") throw new Error("Membre introuvable.");
  if (target.active && target.role === "ADMIN" && (await otherActiveAdmins(id)) === 0) {
    throw new Error("Impossible : il doit rester au moins un gérant.");
  }
  await db.update(schema.users).set({ active: !target.active }).where(eq(schema.users.id, id));
  await audit(me.id, target.active ? "deactivate" : "activate", "user", id);
  revalidatePath("/admin/team");
}

export async function resetStaffPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await assertPermission("team:manage");
  const id = String(formData.get("userId"));
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!target || target.role === "CLIENT") return { error: "Membre introuvable." };
  const password = tempPassword();
  await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, id));
  await audit(me.id, "reset_password", "user", id);
  return { ok: `Nouveau mot de passe : ${password}` };
}
