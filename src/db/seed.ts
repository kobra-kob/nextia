/**
 * Données de démonstration : `npm run db:seed`
 * Remet la base à zéro (tables applicatives) puis insère une équipe,
 * des offres, des clients, des abonnements, des factures et des tickets.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error("Seed refusé en production (définir ALLOW_SEED=1 pour forcer).");
  }

  await db.execute(
    `TRUNCATE audit_logs, ticket_messages, tickets, invoices, subscriptions, plans, users, companies RESTART IDENTITY CASCADE`,
  );

  const hash = (p: string) => bcrypt.hash(p, 10);

  // --- Équipe interne ---
  const [admin, sales, support] = await db
    .insert(schema.users)
    .values([
      { email: "admin@nextia.local", name: "Louis (gérant)", role: "ADMIN", passwordHash: await hash("Admin123!") },
      { email: "commercial@nextia.local", name: "Camille Martin", role: "SALES", passwordHash: await hash("Sales123!") },
      { email: "support@nextia.local", name: "Hugo Bernard", role: "SUPPORT", passwordHash: await hash("Support123!") },
    ])
    .returning();

  // --- Offres ---
  const [decouverte, pro, business] = await db
    .insert(schema.plans)
    .values([
      {
        name: "Découverte",
        description: "1 agent métier, idéal pour démarrer",
        priceCents: 4900,
        features: ["1 agent", "500 actions / mois", "Support par email"],
      },
      {
        name: "Pro",
        description: "Standard téléphonique + facturation/relance",
        priceCents: 12900,
        features: ["3 agents", "3 000 actions / mois", "Intégrations métier", "Onboarding humain"],
      },
      {
        name: "Business",
        description: "Tous les agents, volume élevé",
        priceCents: 24900,
        features: ["Agents illimités", "15 000 actions / mois", "Support prioritaire", "Marque blanche"],
      },
    ])
    .returning();

  // --- Clients ---
  const [garage, cabinet, plomberie] = await db
    .insert(schema.companies)
    .values([
      {
        name: "Garage Durand",
        email: "contact@garage-durand.fr",
        phone: "05 61 00 00 01",
        address: "12 rue des Lilas, 31000 Toulouse",
        sector: "Automobile",
        siret: "812 345 678 00011",
        status: "ACTIVE",
        accountManagerId: sales.id,
      },
      {
        name: "Cabinet Lefèvre Comptabilité",
        email: "accueil@lefevre-compta.fr",
        phone: "05 61 00 00 02",
        address: "4 allée Jean Jaurès, 31000 Toulouse",
        sector: "Expertise comptable",
        status: "ACTIVE",
        accountManagerId: sales.id,
      },
      {
        name: "Plomberie Moreau",
        email: "moreau.plomberie@email.fr",
        phone: "06 00 00 00 03",
        sector: "Artisan BTP",
        status: "ONBOARDING",
        accountManagerId: admin.id,
      },
    ])
    .returning();

  // --- Utilisateurs clients (portail) ---
  const [clientGarage, clientCabinet] = await db
    .insert(schema.users)
    .values([
      { email: "client@garage-durand.fr", name: "Paul Durand", role: "CLIENT", companyId: garage.id, passwordHash: await hash("Client123!") },
      { email: "client@lefevre-compta.fr", name: "Sophie Lefèvre", role: "CLIENT", companyId: cabinet.id, passwordHash: await hash("Client123!") },
      { email: "jean@moreau-plomberie.fr", name: "Jean Moreau", role: "CLIENT", companyId: plomberie.id, passwordHash: await hash("Client123!") },
    ])
    .returning();

  // --- Abonnements ---
  const [subGarage, subCabinet] = await db
    .insert(schema.subscriptions)
    .values([
      { companyId: garage.id, planId: pro.id, status: "ACTIVE", startDate: days(-75), currentPeriodEnd: days(15) },
      { companyId: cabinet.id, planId: business.id, status: "PAST_DUE", startDate: days(-40), currentPeriodEnd: days(-10) },
      { companyId: plomberie.id, planId: decouverte.id, status: "TRIALING", startDate: days(-3), currentPeriodEnd: days(11) },
    ])
    .returning();

  // --- Factures ---
  await db.insert(schema.invoices).values([
    { number: "F-2026-0001", companyId: garage.id, subscriptionId: subGarage.id, label: "Abonnement Pro — août 2026", amountCents: 12900, status: "PAID", issuedAt: days(-75), dueAt: days(-60), paidAt: days(-70) },
    { number: "F-2026-0002", companyId: garage.id, subscriptionId: subGarage.id, label: "Abonnement Pro — septembre 2026", amountCents: 12900, status: "PAID", issuedAt: days(-45), dueAt: days(-30), paidAt: days(-41) },
    { number: "F-2026-0003", companyId: garage.id, subscriptionId: subGarage.id, label: "Abonnement Pro — octobre 2026", amountCents: 12900, status: "OPEN", issuedAt: days(-15), dueAt: days(0) },
    { number: "F-2026-0004", companyId: cabinet.id, subscriptionId: subCabinet.id, label: "Abonnement Business — octobre 2026", amountCents: 24900, status: "OPEN", issuedAt: days(-40), dueAt: days(-25) },
  ]);

  // --- Tickets ---
  const [t1, t2] = await db
    .insert(schema.tickets)
    .values([
      { subject: "Ajouter un second numéro de téléphone", companyId: garage.id, createdById: clientGarage.id, assigneeId: support.id, status: "IN_PROGRESS", priority: "NORMAL", category: "Configuration" },
      { subject: "Question sur ma facture d'octobre", companyId: cabinet.id, createdById: clientCabinet.id, status: "OPEN", priority: "HIGH", category: "Facturation" },
    ])
    .returning();

  await db.insert(schema.ticketMessages).values([
    { ticketId: t1.id, authorId: clientGarage.id, body: "Bonjour, nous voudrions que l'atelier ait aussi son propre numéro." },
    { ticketId: t1.id, authorId: support.id, body: "Bien reçu, je prépare la configuration et je reviens vers vous demain." },
    { ticketId: t1.id, authorId: support.id, body: "Vérifier l'option multi-numéros dans l'offre Pro.", internal: true },
    { ticketId: t2.id, authorId: clientCabinet.id, body: "Le montant ne correspond pas à notre devis, pouvez-vous vérifier ?" },
  ]);

  await db.insert(schema.auditLogs).values({ actorId: admin.id, action: "seed", entity: "system", details: "Données de démonstration" });

  console.log("Seed terminé.\n");
  console.log("Comptes de démonstration :");
  console.log("  admin@nextia.local       / Admin123!    (gérant)");
  console.log("  commercial@nextia.local  / Sales123!    (commercial)");
  console.log("  support@nextia.local     / Support123!  (support)");
  console.log("  client@garage-durand.fr  / Client123!   (portail client)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
