import "server-only";

import { getStore, type Requirement, type Role, type Stage } from "@/lib/db";
import { evaluateStage } from "@/lib/workflow/engine";
import {
  SHIPPED_KEY,
  SHIPPED_LABEL,
  SHIPPING_OPTIONAL_KEYS,
} from "@/lib/workflow/stages";
import { audit } from "./audit";

/*
 * Embarque mais simples: data de embarque, previsão de chegada, navio e BL
 * são opcionais e o "Embarque confirmado" conclui a etapa. Os pedidos criados
 * antes disso (com os três obrigatórios) passam para o mesmo modelo quando a
 * página do pedido abre ou no job diário.
 */

const OPEN_STATUSES: Stage["status"][] = ["pending", "active", "blocked"];

/** Ajusta o Embarque de um pedido antigo. Devolve se mudou algo. */
export async function normalizeShippingStage(stage: Stage): Promise<boolean> {
  if (stage.key !== "SHIPPING" || !OPEN_STATUSES.includes(stage.status))
    return false;
  const store = getStore();
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  if (requirements.some((r) => r.key === SHIPPED_KEY)) return false;
  const order = await store.get("orders", stage.orderId);
  if (!order || order.status === "CANCELLED") return false;

  const optional = (r: Requirement) =>
    (SHIPPING_OPTIONAL_KEYS as readonly string[]).includes(r.key);
  for (const r of requirements)
    if (optional(r) && r.required)
      await store.update("requirements", r.id, { required: false });
  // Mesmo papel dos outros itens (a companhia do pedido, ou a Wellmix).
  const role: Role =
    requirements.find(optional)?.role ??
    (order.shippingLineId ? "shipping_line" : "operator");
  await store.create("requirements", {
    orderId: order.id,
    stageId: stage.id,
    key: SHIPPED_KEY,
    label: SHIPPED_LABEL,
    type: "confirm",
    required: true,
    role,
    status: "pending",
    value: null,
    documentId: null,
    submittedByUserId: null,
    submittedAt: null,
    note: null,
  });
  // Outra passada pode ter criado ao mesmo tempo: fica um só.
  const created = await store.list("requirements", {
    filter: { stageId: stage.id, key: SHIPPED_KEY },
  });
  const keep =
    created.find((r) => r.status === "done") ??
    [...created].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )[0];
  for (const extra of created)
    if (extra !== keep && extra.status !== "done")
      await store.remove("requirements", extra.id);
  await audit(
    null,
    "stage.shipping_optional",
    "stage",
    stage.id,
    `Pedido #${order.number}: data de embarque, chegada e BL opcionais; "Embarque confirmado" conclui a etapa`,
  );
  // Percentual e responsável da etapa aberta acompanham o item novo.
  if (stage.status === "active" || stage.status === "blocked")
    await evaluateStage(null, stage.id);
  return true;
}

/**
 * Pedidos de antes passam para o Embarque novo: um pedido (página do pedido)
 * ou todos os abertos (job diário). Nunca derruba a tela: falha vai para o log.
 */
export async function normalizeShipping(orderId?: string): Promise<number> {
  try {
    const stages = await getStore().list("stages", {
      filter: orderId
        ? { orderId, key: "SHIPPING" }
        : { key: "SHIPPING", status: OPEN_STATUSES },
    });
    let changed = 0;
    for (const stage of stages) {
      try {
        if (await normalizeShippingStage(stage)) changed++;
      } catch (error) {
        console.error("[shipping] etapa não ajustada", stage.id, error);
      }
    }
    return changed;
  } catch (error) {
    console.error("[shipping] pedidos não ajustados", error);
    return 0;
  }
}
