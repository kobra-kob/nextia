"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { formObject, fromZod, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/users";

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis."),
    next: z.string().min(10, "10 caractères minimum."),
    confirm: z.string().min(1, "Confirmation requise."),
  })
  .refine((d) => d.next === d.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] });

/** Changement de mot de passe par l'utilisateur connecté (équipe ou client). */
export async function changeOwnPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Session expirée, reconnectez-vous." };

  const parsed = PasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const full = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!full || !(await bcrypt.compare(parsed.data.current, full.passwordHash))) {
    return { error: "Mot de passe actuel incorrect.", fieldErrors: { current: "Incorrect." } };
  }
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(schema.users.id, me.id));
  await audit(me.id, "change_password", "user", me.id);
  return { ok: "Mot de passe modifié." };
}
