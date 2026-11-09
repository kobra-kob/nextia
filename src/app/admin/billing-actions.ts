"use server";

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { billingIntervalEnum, subscriptionStatusEnum } from "@/db/schema";
import { formObject, fromZod, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth";

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addPeriod = (d: Date, interval: "MONTH" | "YEAR") => {
  const out = new Date(d);
  if (interval === "YEAR") out.setFullYear(out.getFullYear() + 1);
  else out.setMonth(out.getMonth() + 1);
  return out;
};

function refresh(companyId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/invoices");
  if (companyId) revalidatePath(`/admin/clients/${companyId}`);
  revalidatePath("/portal", "layout");
}

/** Prochain numéro de facture : F-AAAA-0001, séquentiel par année. */
async function nextInvoiceNumber(tx: Pick<typeof db, "select">) {
  const year = new Date().getFullYear();
  const prefix = `F-${year}-`;
  const [row] = await tx
    .select({ max: sql<string | null>`max(${schema.invoices.number})` })
    .from(schema.invoices)
    .where(like(schema.invoices.number, `${prefix}%`));
  const last = row?.max ? parseInt(row.max.slice(prefix.length), 10) : 0;
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

// ---------- Abonnements ----------

const SubscriptionSchema = z.object({
  companyId: z.string().min(1),
  planId: z.string().min(1, "Choisissez une offre."),
  trialDays: z.coerce.number().int().min(0).max(90).default(0),
  invoiceNow: z.literal("on").optional(),
});

export async function createSubscription(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("billing:edit");
  const parsed = SubscriptionSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { companyId, planId, trialDays, invoiceNow } = parsed.data;

  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, planId) });
  if (!plan || !plan.active) return { error: "Offre introuvable ou désactivée." };

  const live = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.companyId, companyId),
      inArray(schema.subscriptions.status, ["TRIALING", "ACTIVE", "PAST_DUE"]),
    ),
  });
  if (live) return { error: "Ce client a déjà un abonnement en cours. Résiliez-le ou changez d'offre." };

  const now = new Date();
  const trial = trialDays > 0;

  await db.transaction(async (tx) => {
    const [sub] = await tx
      .insert(schema.subscriptions)
      .values({
        companyId,
        planId,
        status: trial ? "TRIALING" : "ACTIVE",
        startDate: now,
        currentPeriodEnd: trial ? addDays(now, trialDays) : addPeriod(now, plan.interval),
      })
      .returning();

    if (!trial && invoiceNow) {
      await tx.insert(schema.invoices).values({
        number: await nextInvoiceNumber(tx),
        companyId,
        subscriptionId: sub.id,
        label: `Abonnement ${plan.name}`,
        amountCents: plan.priceCents,
        dueAt: addDays(now, 15),
      });
    }

    await tx
      .update(schema.companies)
      .set({ status: "ACTIVE" })
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.status, "ONBOARDING")));
  });

  await audit(user.id, "create", "subscription", companyId, plan.name);
  refresh(companyId);
  return { ok: trial ? `Essai de ${trialDays} jours démarré sur l'offre ${plan.name}.` : `Abonnement ${plan.name} activé.` };
}

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(subscriptionStatusEnum.enumValues),
});

export async function setSubscriptionStatus(formData: FormData) {
  const user = await assertPermission("billing:edit");
  const { id, status } = StatusSchema.parse(formObject(formData));
  const [sub] = await db
    .update(schema.subscriptions)
    .set({ status, canceledAt: status === "CANCELED" ? new Date() : null })
    .where(eq(schema.subscriptions.id, id))
    .returning();
  await audit(user.id, `status:${status}`, "subscription", id);
  refresh(sub?.companyId);
}

export async function changePlan(formData: FormData) {
  const user = await assertPermission("billing:edit");
  const id = String(formData.get("id"));
  const planId = String(formData.get("planId"));
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, planId) });
  if (!plan) throw new Error("Offre introuvable.");
  const [sub] = await db
    .update(schema.subscriptions)
    .set({ planId })
    .where(eq(schema.subscriptions.id, id))
    .returning();
  await audit(user.id, "change_plan", "subscription", id, plan.name);
  refresh(sub?.companyId);
}

/** Facture la période en cours et avance l'échéance (renouvellement manuel). */
export async function renewSubscription(formData: FormData) {
  const user = await assertPermission("billing:edit");
  const id = String(formData.get("id"));
  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.id, id),
    with: { plan: true },
  });
  if (!sub || sub.status === "CANCELED") throw new Error("Abonnement introuvable ou résilié.");

  const start = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const end = addPeriod(start, sub.plan.interval);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(start);

  await db.transaction(async (tx) => {
    await tx.insert(schema.invoices).values({
      number: await nextInvoiceNumber(tx),
      companyId: sub.companyId,
      subscriptionId: sub.id,
      label: `Abonnement ${sub.plan.name} — ${month}`,
      amountCents: sub.plan.priceCents,
      dueAt: addDays(new Date(), 15),
    });
    await tx
      .update(schema.subscriptions)
      .set({ currentPeriodEnd: end, status: sub.status === "TRIALING" ? "ACTIVE" : sub.status })
      .where(eq(schema.subscriptions.id, id));
  });

  await audit(user.id, "renew", "subscription", id);
  refresh(sub.companyId);
}

// ---------- Factures ----------

const InvoiceSchema = z.object({
  companyId: z.string().min(1),
  label: z.string().min(2, "Libellé requis."),
  amount: z.coerce.number({ error: "Montant invalide." }).positive("Montant invalide."),
  vatRate: z.coerce.number().int().min(0).max(100).default(20),
  dueInDays: z.coerce.number().int().min(0).max(120).default(15),
});

export async function createInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("billing:edit");
  const raw = formObject(formData);
  const parsed = InvoiceSchema.safeParse({ ...raw, amount: raw.amount?.replace(",", ".") });
  if (!parsed.success) return fromZod(parsed.error);
  const { companyId, label, amount, vatRate, dueInDays } = parsed.data;

  const number = await db.transaction(async (tx) => {
    const n = await nextInvoiceNumber(tx);
    await tx.insert(schema.invoices).values({
      number: n,
      companyId,
      label,
      amountCents: Math.round(amount * 100),
      vatRate,
      dueAt: addDays(new Date(), dueInDays),
    });
    return n;
  });

  await audit(user.id, "create", "invoice", number, label);
  refresh(companyId);
  return { ok: `Facture ${number} créée.` };
}

export async function markInvoicePaid(formData: FormData) {
  const user = await assertPermission("billing:edit");
  const id = String(formData.get("id"));
  const [inv] = await db
    .update(schema.invoices)
    .set({ status: "PAID", paidAt: new Date() })
    .where(and(eq(schema.invoices.id, id), eq(schema.invoices.status, "OPEN")))
    .returning();
  if (inv) {
    // Plus aucun impayé → l'abonnement repasse actif.
    const stillOpen = await db.query.invoices.findFirst({
      where: and(eq(schema.invoices.companyId, inv.companyId), eq(schema.invoices.status, "OPEN"), sql`${schema.invoices.dueAt} < now()`),
    });
    if (!stillOpen) {
      await db
        .update(schema.subscriptions)
        .set({ status: "ACTIVE" })
        .where(and(eq(schema.subscriptions.companyId, inv.companyId), eq(schema.subscriptions.status, "PAST_DUE")));
    }
    await audit(user.id, "mark_paid", "invoice", inv.number);
  }
  refresh(inv?.companyId);
}

export async function voidInvoice(formData: FormData) {
  const user = await assertPermission("billing:edit");
  const id = String(formData.get("id"));
  const [inv] = await db
    .update(schema.invoices)
    .set({ status: "VOID" })
    .where(and(eq(schema.invoices.id, id), eq(schema.invoices.status, "OPEN")))
    .returning();
  if (inv) await audit(user.id, "void", "invoice", inv.number);
  refresh(inv?.companyId);
}

// ---------- Offres ----------

const PlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nom requis."),
  description: z.string().optional(),
  price: z.coerce.number({ error: "Prix invalide." }).min(0, "Prix invalide."),
  interval: z.enum(billingIntervalEnum.enumValues),
  features: z.string().optional(),
  stripePriceId: z.string().optional(),
});

export async function savePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission("plans:edit");
  const raw = formObject(formData);
  const parsed = PlanSchema.safeParse({ ...raw, price: raw.price?.replace(",", ".") });
  if (!parsed.success) return fromZod(parsed.error);
  const { id, price, features, ...rest } = parsed.data;

  const values = {
    ...rest,
    description: rest.description ?? null,
    stripePriceId: rest.stripePriceId ?? null,
    priceCents: Math.round(price * 100),
    features: (features ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
  };

  if (id) {
    await db.update(schema.plans).set(values).where(eq(schema.plans.id, id));
    await audit(user.id, "update", "plan", id, rest.name);
  } else {
    const [p] = await db.insert(schema.plans).values(values).returning({ id: schema.plans.id });
    await audit(user.id, "create", "plan", p.id, rest.name);
  }
  revalidatePath("/admin/plans");
  return { ok: id ? "Offre mise à jour." : "Offre créée." };
}

export async function togglePlan(formData: FormData) {
  const user = await assertPermission("plans:edit");
  const id = String(formData.get("id"));
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, id) });
  if (!plan) return;
  await db.update(schema.plans).set({ active: !plan.active }).where(eq(schema.plans.id, id));
  await audit(user.id, plan.active ? "archive" : "unarchive", "plan", id);
  revalidatePath("/admin/plans");
}
