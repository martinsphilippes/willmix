"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { deleteRequests } from "@/lib/services/requests";
import { requireUser, run } from "./helpers";

/*
 * Excluir solicitações (uma ou várias) na lista. O serviço cancela só o que o
 * login pode ver e ainda não virou pedido; nada é apagado (auditoria guarda).
 */

const deleteSchema = z.array(z.string().min(1).max(64)).min(1).max(500);
/** Lote de onde veio a exclusão (página do lote): a tela volta para ele. */
const groupSchema = z
  .string()
  .regex(/^[\w-]{1,64}$/)
  .optional();

export async function deleteRequestsAction(form: FormData) {
  const user = await requireUser();
  const rawGroup = form.get("groupId");
  const groupId = groupSchema.safeParse(
    typeof rawGroup === "string" && rawGroup ? rawGroup : undefined,
  );
  const back =
    groupId.success && groupId.data
      ? `/app/requests/batch/${encodeURIComponent(groupId.data)}`
      : "/app/requests";
  await run(back, async () => {
    const ids = deleteSchema.parse(
      form.getAll("ids").filter((v): v is string => typeof v === "string"),
    );
    const { deleted, skipped } = await deleteRequests(user, ids);
    if (deleted === 0) throw new Error("nothing_deleted");
    return `${back}?deleted=${deleted}${skipped ? `&skipped=${skipped}` : ""}`;
  });
}

/**
 * RFQ do lote inteiro (Wellmix): os fornecedores marcados uma vez valem para
 * todos os produtos do lote ainda em cotação. Volta para a página do lote.
 */
export async function openBatchRfqAction(form: FormData) {
  const user = await requireUser();
  const rawGroup = form.get("groupId");
  const groupId = groupSchema.safeParse(
    typeof rawGroup === "string" && rawGroup ? rawGroup : undefined,
  );
  const back =
    groupId.success && groupId.data
      ? `/app/requests/batch/${encodeURIComponent(groupId.data)}`
      : "/app/requests";
  await run(back, async () => {
    assertWellmix(user);
    if (!groupId.success || !groupId.data) throw new Error("invalid_input");
    const parsed = z
      .array(z.string().min(1).max(64))
      .max(100)
      .safeParse(
        form
          .getAll("supplierIds")
          .filter((v): v is string => typeof v === "string" && !!v),
      );
    // Código próprio: "invalid_input" na página do lote fala do formulário de produtos.
    if (!parsed.success) throw new Error("invalid_supplier");
    const supplierIds = parsed.data;
    const { openBatchRfq } = await import("@/lib/services/requests");
    const result = await openBatchRfq(user, groupId.data, supplierIds);
    return `${back}?rfq=${result.requests}`;
  });
}
