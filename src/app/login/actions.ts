"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
  next: z.string().optional(),
});

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Email ou mot de passe invalide." };

  const { email, password, next } = parsed.data;
  const user = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email.toLowerCase()}`,
  });

  // Même message dans tous les cas : on ne révèle pas si le compte existe.
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) return { error: "Email ou mot de passe invalide." };

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession({ userId: user.id, role: user.role });
  await audit(user.id, "login", "user", user.id);

  const home = user.role === "CLIENT" ? "/portal" : "/admin";
  const safeNext = next && next.startsWith(home) ? next : home;
  redirect(safeNext);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
