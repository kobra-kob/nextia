import { asc, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/form";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { dateTime, ROLE_LABELS } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { toggleStaffActive, updateStaffRole } from "./actions";
import { NewStaffForm, ResetStaffPassword } from "./forms";

export const metadata: Metadata = { title: "Équipe" };

const PERMISSION_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  "dashboard:view": "Tableau de bord",
  "clients:view": "Voir les clients",
  "clients:edit": "Créer / modifier les clients",
  "clients:delete": "Supprimer un client",
  "billing:view": "Voir abonnements et factures",
  "billing:edit": "Gérer abonnements et factures",
  "plans:edit": "Modifier le catalogue d'offres",
  "tickets:view": "Voir les tickets",
  "tickets:edit": "Traiter les tickets",
  "team:manage": "Gérer l'équipe",
  "audit:view": "Journal d'activité",
};

export default async function TeamPage() {
  const me = await requireStaff("team:manage");
  const members = await db.query.users.findMany({
    where: inArray(schema.users.role, ["ADMIN", "SALES", "SUPPORT"]),
    orderBy: [asc(schema.users.name)],
  });

  return (
    <>
      <PageHeader title="Équipe" description="Comptes de vos employés et droits associés à chaque rôle." />

      <Card title={`Membres (${members.length})`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
                <th>Dernière connexion</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <p className="font-medium">{m.name} {m.id === me.id && <span className="text-xs text-slate-400">(vous)</span>}</p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </td>
                  <td>
                    {m.id === me.id ? (
                      <StatusBadge map={ROLE_LABELS} value={m.role} />
                    ) : (
                      <form action={updateStaffRole} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input w-auto py-1">
                          <option value="ADMIN">Gérant</option>
                          <option value="SALES">Commercial</option>
                          <option value="SUPPORT">Support</option>
                        </select>
                        <button type="submit" className="btn-ghost px-2 py-1 text-xs">OK</button>
                      </form>
                    )}
                  </td>
                  <td className="text-slate-500">{dateTime(m.lastLoginAt)}</td>
                  <td>{m.active ? <Badge tone="green">Actif</Badge> : <Badge>Désactivé</Badge>}</td>
                  <td>
                    {m.id !== me.id && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {m.active && <ResetStaffPassword userId={m.id} />}
                        <ConfirmButton
                          action={toggleStaffActive}
                          hidden={{ id: m.id }}
                          className="btn-ghost px-2 py-1 text-xs"
                          confirm={m.active ? `Désactiver le compte de ${m.name} ?` : undefined}
                        >
                          {m.active ? "Désactiver" : "Réactiver"}
                        </ConfirmButton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100">
          <NewStaffForm />
        </div>
      </Card>

      <Card title="Droits par rôle">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Droit</th>
                <th className="text-center">Gérant</th>
                <th className="text-center">Commercial</th>
                <th className="text-center">Support</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([perm, roles]) => (
                <tr key={perm}>
                  <td>{PERMISSION_LABELS[perm as keyof typeof PERMISSIONS]}</td>
                  {(["ADMIN", "SALES", "SUPPORT"] as const).map((r) => (
                    <td key={r} className="text-center">
                      {(roles as readonly string[]).includes(r) ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Les droits se modifient dans <code className="font-mono">src/lib/permissions.ts</code>.
        </p>
      </Card>
    </>
  );
}
