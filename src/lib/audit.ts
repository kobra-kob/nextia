import "server-only";
import { db, schema } from "@/db";

export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string,
) {
  try {
    await db.insert(schema.auditLogs).values({ actorId, action, entity, entityId: entityId ?? null, details });
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'action métier.
    console.error("audit log failed", e);
  }
}
