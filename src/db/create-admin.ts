/**
 * Crée le premier compte gérant (ou réinitialise son mot de passe s'il existe).
 *   npm run db:create-admin -- email@domaine.fr "Prénom Nom"
 * En Docker :
 *   docker compose --env-file .env.production run --rm migrate npx tsx src/db/create-admin.ts email@domaine.fr "Prénom Nom"
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || "Gérant";

if (!email || !email.includes("@")) {
  console.error('Usage : npm run db:create-admin -- email@domaine.fr "Prénom Nom"');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  const password = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email.toLowerCase()}`,
  });

  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash, role: "ADMIN", active: true, companyId: null })
      .where(sql`${schema.users.id} = ${existing.id}`);
    console.log(`Compte existant passé gérant et mot de passe réinitialisé : ${email}`);
  } else {
    await db.insert(schema.users).values({ email: email.toLowerCase(), name, role: "ADMIN", passwordHash });
    console.log(`Compte gérant créé : ${email}`);
  }
  console.log(`Mot de passe temporaire : ${password}`);
  console.log("Changez-le après la première connexion (Mon compte).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
