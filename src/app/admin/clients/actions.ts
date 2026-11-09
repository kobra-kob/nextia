"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { companyStatusEnum } from "@/db/schema";
import { formObject, fromZod, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth";
import { createUser, emailTaken, hashPassword, tempPassword } from "@/lib/users";

const CompanySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nom requis (2 caractères min.)."),
  email: z.email("Email invalide."),
  phone: z.string().optional(),
  siret: z.string().optional(),
  address: z.string().optional(),
  sector: z.string().optional(),
  status: z.enum(companyStatusEnum.enumValues).default("ONBOARDING"),
  accountManagerId: z.string().optional(),
  notes: z.string().optional(),
});

export async function saveCompany(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("clients:edit");
  const parsed = CompanySchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const { id, ...data } = parsed.data;
  const values = {
    ...data,
    phone: data.phone ?? null,
    siret: data.siret ?? null,
    address: data.address ?? null,
    sector: data.sector ?? null,
    notes: data.notes ?? null,
    accountManagerId: data.accountManagerId ?? null,
  };

  let companyId = id;
  if (id) {
    await db.update(schema.companies).set(values).where(eq(schema.companies.id, id));
    await audit(user.id, "update", "company", id);
  } else {
    const [row] = await db.insert(schema.companies).values(values).returning({ id: schema.companies.id });
    companyId = row.id;
    await audit(user.id, "create", "company", companyId, data.name);
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${companyId}`);
}

export async function deleteCompany(formData: FormData) {
  const user = await assertPermission("clients:delete");
  const id = String(formData.get("id"));
  await db.delete(schema.companies).where(eq(schema.companies.id, id));
  await audit(user.id, "delete", "company", id);
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

// ---------- Utilisateurs du portail client ----------

const ClientUserSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(2, "Nom requis."),
  email: z.email("Email invalide."),
});

export async function addClientUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("clients:edit");
  const parsed = ClientUserSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);

  if (await emailTaken(parsed.data.email)) {
    return { error: "Cet email est déjà utilisé.", fieldErrors: { email: "Email déjà utilisé." } };
  }

  const created = await createUser({ ...parsed.data, role: "CLIENT" });
  await audit(user.id, "create", "user", created.id, `accès portail ${parsed.data.email}`);
  revalidatePath(`/admin/clients/${parsed.data.companyId}`);
  return {
    ok: `Accès créé pour ${parsed.data.email}. Mot de passe temporaire : ${created.password} (à transmettre au client, il ne sera plus affiché).`,
  };
}

export async function toggleClientUser(formData: FormData) {
  const user = await assertPermission("clients:edit");
  const id = String(formData.get("userId"));
  const companyId = String(formData.get("companyId"));
  const target = await db.query.users.findFirst({
    where: and(eq(schema.users.id, id), eq(schema.users.role, "CLIENT")),
  });
  if (!target) throw new Error("Utilisateur introuvable.");
  await db.update(schema.users).set({ active: !target.active }).where(eq(schema.users.id, id));
  await audit(user.id, target.active ? "deactivate" : "activate", "user", id);
  revalidatePath(`/admin/clients/${companyId}`);
}

export async function resetClientPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("clients:edit");
  const id = String(formData.get("userId"));
  const target = await db.query.users.findFirst({
    where: and(eq(schema.users.id, id), eq(schema.users.role, "CLIENT")),
  });
  if (!target) return { error: "Utilisateur introuvable." };
  const password = tempPassword();
  await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, id));
  await audit(user.id, "reset_password", "user", id);
  return { ok: `Nouveau mot de passe pour ${target.email} : ${password}` };
}
