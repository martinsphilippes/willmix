"use server";

import { z } from "zod";
import { field, requireUser, run, str } from "./helpers";

/*
 * Aprovação do pré-custo (docs/APPROVALS.md): decidir o nível atual
 * (aprovar ou reprovar com motivo) e cancelar. O serviço confere quem pode.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

function back(form: FormData) {
  const requestId = ID.safeParse(str(form, "requestId"));
  return requestId.success
    ? `/app/requests/${requestId.data}`
    : "/app/requests";
}

export async function decideApprovalAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#approval`, async () => {
    const approvalId = ID.parse(str(form, "approvalId"));
    const decision = z
      .enum(["approved", "rejected"])
      .parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(1000));
    const { decideApproval } = await import("@/lib/services/approvals");
    await decideApproval(user, approvalId, decision, note || null);
    return `${to}?decided=${decision}#approval`;
  });
}

export async function cancelApprovalAction(form: FormData) {
  const user = await requireUser();
  const to = back(form);
  await run(`${to}#approval`, async () => {
    const approvalId = ID.parse(str(form, "approvalId"));
    const { cancelApproval } = await import("@/lib/services/approvals");
    await cancelApproval(user, approvalId);
    return `${to}#approval`;
  });
}
