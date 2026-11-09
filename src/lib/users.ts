import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";

/** Mot de passe temporaire lisible, communiqué une seule fois à la création. */
export function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);

export async function emailTaken(email: string) {
  const existing = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email.toLowerCase()}`,
    columns: { id: true },
  });
  return Boolean(existing);
}

export async function createUser(input: { email: string; name: string; role: Role; companyId?: string | null }) {
  const password = tempPassword();
  const [user] = await db
    .insert(schema.users)
    .values({
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      companyId: input.companyId ?? null,
      passwordHash: await hashPassword(password),
    })
    .returning({ id: schema.users.id });
  return { id: user.id, password };
}
