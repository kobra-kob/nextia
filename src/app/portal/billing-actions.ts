"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireClient } from "@/lib/auth";
import { appUrl, getStripe } from "@/lib/stripe";

/** Récupère (ou crée) le client Stripe de l'entreprise. */
async function ensureStripeCustomer(companyId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Paiement en ligne non configuré.");
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.id, companyId) });
  if (!company) throw new Error("Entreprise introuvable.");
  if (company.stripeCustomerId) return company.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: company.name,
    email: company.email,
    metadata: { companyId: company.id },
  });
  await db.update(schema.companies).set({ stripeCustomerId: customer.id }).where(eq(schema.companies.id, company.id));
  return customer.id;
}

/** Souscription en ligne : redirige vers Stripe Checkout. */
export async function startCheckout(formData: FormData) {
  const user = await requireClient();
  const stripe = getStripe();
  if (!stripe) redirect("/portal/billing?error=stripe");

  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, String(formData.get("planId"))) });
  if (!plan || !plan.active || !plan.stripePriceId) redirect("/portal/billing?error=plan");

  const live = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.companyId, user.companyId),
      inArray(schema.subscriptions.status, ["ACTIVE", "PAST_DUE", "TRIALING"]),
    ),
  });
  if (live?.stripeSubscriptionId) redirect("/portal/billing?error=exists");

  const customer = await ensureStripeCustomer(user.companyId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl()}/portal/billing?checkout=success`,
    cancel_url: `${appUrl()}/portal/billing?checkout=cancel`,
    metadata: { companyId: user.companyId, planId: plan.id },
    subscription_data: { metadata: { companyId: user.companyId, planId: plan.id } },
    locale: "fr",
  });
  await audit(user.id, "checkout_start", "subscription", user.companyId, plan.name);
  redirect(session.url!);
}

/** Espace Stripe du client : moyen de paiement, factures Stripe, résiliation. */
export async function openBillingPortal() {
  const user = await requireClient();
  const stripe = getStripe();
  if (!stripe) redirect("/portal/billing?error=stripe");
  const customer = await ensureStripeCustomer(user.companyId);
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/portal/billing`,
    locale: "fr",
  });
  redirect(session.url);
}
