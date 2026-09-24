import "server-only";

import { getStore, type User } from "@/lib/db";

/** Registro mínimo de auditoria: quem, o quê, em qual entidade, quando. */
export async function audit(
  user: User | null,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
  before: unknown = null,
  after: unknown = null,
) {
  await getStore().create("audit_log", {
    userId: user?.id ?? null,
    action,
    entity,
    entityId,
    summary: summary.slice(0, 255),
    before,
    after,
  });
}
