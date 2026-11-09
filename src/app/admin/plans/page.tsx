import { asc, count, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/form";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import { can } from "@/lib/permissions";
import { togglePlan } from "../billing-actions";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Offres" };

export default async function PlansPage() {
  const user = await requireStaff("billing:view");
  const canEdit = can(user.role, "plans:edit");

  const [plans, usage] = await Promise.all([
    db.query.plans.findMany({ orderBy: [asc(schema.plans.priceCents)] }),
    db
      .select({ planId: schema.subscriptions.planId, n: count() })
      .from(schema.subscriptions)
      .where(inArray(schema.subscriptions.status, ["TRIALING", "ACTIVE", "PAST_DUE"]))
      .groupBy(schema.subscriptions.planId),
  ]);
  const used = (id: string) => usage.find((u) => u.planId === id)?.n ?? 0;

  return (
    <>
      <PageHeader title="Offres" description="Catalogue des abonnements proposés aux clients." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {plans.length === 0 && <Empty>Aucune offre.</Empty>}
        {plans.map((p) => (
          <div key={p.id} className={`card flex flex-col p-5 ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{p.name}</h2>
              {p.active ? <Badge tone="green">Active</Badge> : <Badge>Archivée</Badge>}
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {money(p.priceCents)} <span className="text-sm font-normal text-slate-500">HT / {p.interval === "YEAR" ? "an" : "mois"}</span>
            </p>
            {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
            <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-700">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {used(p.id)} abonnement(s) en cours · {p.stripePriceId ? "Stripe relié" : "Stripe non relié"}
            </p>
            {canEdit && (
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <a href={`#edit-${p.id}`} className="link flex-1 self-center text-sm">Modifier</a>
                <ConfirmButton action={togglePlan} hidden={{ id: p.id }} className="btn-ghost px-2 py-1 text-xs">
                  {p.active ? "Archiver" : "Réactiver"}
                </ConfirmButton>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="space-y-6">
          {plans.map((p) => (
            <details key={p.id} id={`edit-${p.id}`} className="card scroll-mt-6">
              <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Modifier « {p.name} »</summary>
              <div className="border-t border-slate-100"><PlanForm plan={p} /></div>
            </details>
          ))}
          <Card title="Nouvelle offre">
            <PlanForm />
          </Card>
        </div>
      )}
    </>
  );
}
