"use server";

import { z } from "zod";
import {
  assertWellmix,
  canViewOrder,
  ForbiddenError,
  isWellmix,
} from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import {
  confirmSupplierPaymentReceipt,
  recordAck,
} from "@/lib/services/acknowledgements";
import { canAccessDocument } from "@/lib/services/documents";
import { isInspectionMeasureKey } from "@/lib/services/inspection";
import { ensureSnapshot } from "@/lib/services/snapshots";
import { submitRequirement } from "@/lib/workflow/engine";
import { requireUser, run, str } from "./helpers";

/*
 * Ações do módulo "pedido" (evolução incremental): snapshot retroativo,
 * nova medição na inspeção cega e trilha visualizado/confirmado.
 * As ações antigas continuam em src/app/app/actions.ts.
 */

/** O campo "back" vem do formulário: só aceita caminhos internos do app (sem redirecionamento aberto). */
function safeBack(value: string, fallback: string) {
  return value.startsWith("/app") && !value.startsWith("//") ? value : fallback;
}

/** Pedidos anteriores ao snapshot: gera a partir do cadastro atual (marcado como retroativo). */
export async function ensureSnapshotAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`/app/orders/${orderId}`, async () => {
    assertWellmix(user);
    const order = await getStore().get("orders", orderId);
    if (!order) throw new Error("not_found");
    await ensureSnapshot(user, order);
    return `/app/orders/${orderId}#snapshot`;
  });
}

const remeasureSchema = z.object({
  orderId: z.string().min(1),
  requirementId: z.string().min(1),
  value: z.string().min(1).max(200),
});

/**
 * Nova medição: reenvio de um requisito de medida da inspeção mesmo já concluído,
 * enquanto a etapa está aberta (bloqueada ou em andamento). A comparação com o snapshot roda de novo no
 * motor; se tudo ficar dentro da tolerância a etapa é liberada sozinha.
 */
export async function remeasureAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = `/app/orders/${orderId}?remeasure=1`;
  await run(back, async () => {
    const parsed = remeasureSchema.parse({
      orderId,
      requirementId: str(form, "requirementId"),
      value: str(form, "value"),
    });
    const store = getStore();
    const requirement = await store.get("requirements", parsed.requirementId);
    if (!requirement || requirement.orderId !== orderId)
      throw new Error("not_found");
    if (!isInspectionMeasureKey(requirement.key))
      throw new Error("not_measure");
    const stage = await store.get("stages", requirement.stageId);
    // Nova medição vale enquanto a inspeção está aberta (bloqueada ou em andamento).
    if (
      !stage ||
      stage.key !== "INSPECTION" ||
      (stage.status !== "blocked" && stage.status !== "active")
    )
      throw new Error("stage_not_blocked");
    // Papel e parceiro são checados no motor (canSubmitRequirement).
    await submitRequirement(user, requirement.id, { value: parsed.value });
    const fresh = await store.get("stages", stage.id);
    return fresh?.status === "blocked"
      ? `${back}#stage-${stage.id}`
      : `/app/orders/${orderId}#stage-${stage.id}`;
  });
}

/**
 * Confirmação de recebimento do pagamento ao fornecedor com registro na trilha
 * (evento "confirmed"). Mesmo efeito da ação antiga `confirmSupplierPaymentAction`,
 * via serviço compartilhado; o botão e o rótulo continuam os mesmos.
 */
export async function acknowledgePaymentAction(form: FormData) {
  const user = await requireUser();
  const paymentId = str(form, "paymentId");
  const back = safeBack(str(form, "back"), "/app/account");
  await run(back, async () => {
    await confirmSupplierPaymentReceipt(user, paymentId);
  });
}

/** "Confirmar leitura" de um documento: ato explícito, distinto de visualizar. */
export async function acknowledgeDocumentAction(form: FormData) {
  const user = await requireUser();
  const documentId = str(form, "documentId");
  const back = safeBack(str(form, "back"), "/app/orders");
  await run(back, async () => {
    const store = getStore();
    const doc = await store.get("documents", documentId);
    if (!doc) throw new Error("not_found");
    if (!(await canAccessDocument(user, doc))) throw new ForbiddenError();
    if (doc.orderId) {
      const order = await store.get("orders", doc.orderId);
      if (!order || !(isWellmix(user) || canViewOrder(user, order)))
        throw new ForbiddenError();
    }
    await recordAck(user, "document", documentId, "confirmed");
  });
}
