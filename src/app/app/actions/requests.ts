"use server";

import { z } from "zod";
import { deleteRequests } from "@/lib/services/requests";
import { requireUser, run } from "./helpers";

/*
 * Excluir solicitações (uma ou várias) na lista. O serviço cancela só o que o
 * login pode ver e ainda não virou pedido; nada é apagado (auditoria guarda).
 */

const deleteSchema = z.array(z.string().min(1).max(64)).min(1).max(500);

export async function deleteRequestsAction(form: FormData) {
  const user = await requireUser();
  await run("/app/requests", async () => {
    const ids = deleteSchema.parse(
      form.getAll("ids").filter((v): v is string => typeof v === "string"),
    );
    const { deleted, skipped } = await deleteRequests(user, ids);
    if (deleted === 0) throw new Error("nothing_deleted");
    return `/app/requests?deleted=${deleted}${skipped ? `&skipped=${skipped}` : ""}`;
  });
}
