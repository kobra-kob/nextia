import { eq, like, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db, schema } from "@/db";
import type { SubscriptionStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";

/**
 * Webhook Stripe : synchronise abonnements et factures.
 * Événements à activer dans Stripe : checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted,
 * invoice.paid, invoice.payment_failed.
 * En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe non configuré", { status: 501 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const companyId = session.metadata?.companyId;
        const planId = session.metadata?.planId;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (companyId && planId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub, companyId, planId);
          await db.update(schema.companies).set({ status: "ACTIVE" }).where(eq(schema.companies.id, companyId));
          await audit(null, "stripe:checkout_completed", "subscription", companyId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const existing = await db.query.subscriptions.findFirst({
          where: eq(schema.subscriptions.stripeSubscriptionId, sub.id),
        });
        const companyId = existing?.companyId ?? sub.metadata?.companyId;
        const planId = existing?.planId ?? sub.metadata?.planId;
        if (companyId && planId) await upsertSubscription(sub, companyId, planId);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        await syncInvoice(event.data.object);
        break;
      }
    }
  } catch (e) {
    console.error("Erreur webhook Stripe", event.type, e);
    return new Response("Erreur de traitement", { status: 500 });
  }

  return Response.json({ received: true });
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  incomplete: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "CANCELED",
  paused: "PAST_DUE",
};

/** Fin de période : sur l'abonnement (anciennes API) ou sur ses lignes (API récentes). */
function periodEnd(sub: Stripe.Subscription) {
  const s = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
  return new Date(ts * 1000);
}

async function upsertSubscription(sub: Stripe.Subscription, companyId: string, planId: string) {
  const values = {
    companyId,
    planId,
    status: STATUS_MAP[sub.status] ?? "ACTIVE",
    startDate: new Date(sub.start_date * 1000),
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    stripeSubscriptionId: sub.id,
  };
  await db
    .insert(schema.subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.subscriptions.stripeSubscriptionId, set: values });
}

async function syncInvoice(inv: Stripe.Invoice) {
  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
  if (!customerId || !inv.id) return;
  const company = await db.query.companies.findFirst({ where: eq(schema.companies.stripeCustomerId, customerId) });
  if (!company) return;

  const raw = inv as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  };
  const subRef = raw.subscription ?? raw.parent?.subscription_details?.subscription;
  const stripeSubId = typeof subRef === "string" ? subRef : subRef?.id;
  const sub = stripeSubId
    ? await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, stripeSubId) })
    : undefined;

  const paid = inv.status === "paid";
  const amountHt = inv.total_excluding_tax ?? inv.subtotal ?? inv.total;
  const vatRate = amountHt > 0 ? Math.round(((inv.total - amountHt) / amountHt) * 100) : 0;

  const existing = await db.query.invoices.findFirst({ where: eq(schema.invoices.stripeInvoiceId, inv.id) });
  if (existing) {
    await db
      .update(schema.invoices)
      .set({ status: paid ? "PAID" : "OPEN", paidAt: paid ? new Date() : null })
      .where(eq(schema.invoices.id, existing.id));
  } else {
    const year = new Date().getFullYear();
    const prefix = `F-${year}-`;
    const [row] = await db
      .select({ max: sql<string | null>`max(${schema.invoices.number})` })
      .from(schema.invoices)
      .where(like(schema.invoices.number, `${prefix}%`));
    const next = (row?.max ? parseInt(row.max.slice(prefix.length), 10) : 0) + 1;

    await db.insert(schema.invoices).values({
      number: `${prefix}${String(next).padStart(4, "0")}`,
      companyId: company.id,
      subscriptionId: sub?.id ?? null,
      label: inv.lines?.data?.[0]?.description ?? "Abonnement",
      amountCents: amountHt,
      vatRate,
      status: paid ? "PAID" : "OPEN",
      issuedAt: new Date(inv.created * 1000),
      dueAt: new Date((inv.due_date ?? inv.created) * 1000),
      paidAt: paid ? new Date() : null,
      stripeInvoiceId: inv.id,
    });
  }

  if (sub && !paid) {
    await db.update(schema.subscriptions).set({ status: "PAST_DUE" }).where(eq(schema.subscriptions.id, sub.id));
  }
}
