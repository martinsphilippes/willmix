import "server-only";
import type {
  ImportStep,
  Order,
  ProductionTrack,
  Receiving,
  Requirement,
  Stage,
} from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { flowStepOfImportKey, flowStepsOf, stepId } from "@/lib/flow";
import {
  orderMilestones,
  type MilestoneView,
  type Subtask,
} from "@/lib/milestones";
import { baseKeyOf, LANE_KEYS, SAMPLE_ORDER_KEY } from "@/lib/purchase-lanes";
import { parseSampleOrder } from "@/lib/sample-order";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import {
  IMPORT_STEPS,
  groupOf,
  importStepDone,
  lpcoApplies,
  stepApplies,
} from "./import-flow";

/*
 * Subtarefas de um pedido para os marcos (dono, 14/11/2026; fase 2,
 * docs/MILESTONES.md): os itens do pedido (pelo passo do menu de cada um),
 * os passos do embarque, da origem, da certificação e das amostras que valem
 * para ele, a produção (dados e ETD; começo da inspeção) e o recebimento no
 * CD. A situação dos marcos sai da regra pura (`orderMilestones`).
 */

export interface MilestoneInput {
  order: Order;
  stages: Stage[];
  /** Todos os itens do pedido, de qualquer situação. */
  requirements: Requirement[];
  importSteps: ImportStep[];
  track: ProductionTrack | null;
  receiving: Receiving | null;
  /** O pedido tem produto de NCM que exige LPCO. */
  lpco: boolean;
}

/** As subtarefas do pedido, cada uma no passo do menu dela (função pura). */
export function orderSubtasks(input: MilestoneInput): Subtask[] {
  const { order } = input;
  const stageById = new Map(input.stages.map((s) => [s.id, s]));
  const out: Subtask[] = [];
  // Itens do pedido (etapa cancelada não conta).
  for (const r of input.requirements) {
    const stage = stageById.get(r.stageId);
    if (!stage || stage.status === "cancelled") continue;
    for (const step of flowStepsOf({
      kind: "requirement",
      stageKey: stage.key,
      items: [{ key: r.key }],
    }))
      out.push({
        step: stepId(step),
        key: r.key,
        done: r.status === "done",
        dueAt: r.status === "done" ? null : (stage.dueAt ?? null),
      });
  }
  // Passos do embarque, da origem, da certificação e das amostras.
  const saved = new Map(input.importSteps.map((s) => [s.key, s]));
  const certification =
    input.importSteps.some((s) => s.key.startsWith("cert_")) ||
    input.requirements.some((r) => baseKeyOf(r.key) === LANE_KEYS.certificate);
  const sampleDoc = parseSampleOrder(
    input.requirements.find((r) => r.key === SAMPLE_ORDER_KEY)?.value,
  );
  const samples =
    isPurchaseFlow(order) &&
    sampleDoc?.status === "ordered" &&
    !!sampleDoc.lines?.length;
  for (const tpl of IMPORT_STEPS) {
    const group = groupOf(tpl);
    if (group === "certification" && !certification) continue;
    if (group === "samples" && !samples) continue;
    if (!stepApplies(order, tpl.key, input.lpco)) continue;
    if (tpl.key === "bl" && isPurchaseFlow(order)) continue;
    const step = flowStepOfImportKey(tpl.key);
    if (!step) continue;
    out.push({
      step: stepId(step),
      key: tpl.key,
      done: importStepDone(saved.get(tpl.key)),
    });
  }
  // Produção: dados e ETD depois do sinal; a produção conclui quando a
  // inspeção começa.
  const paid = input.requirements.some(
    (r) => r.key === "down_payment" && r.status === "done",
  );
  const inspection = input.stages.find((s) => s.key === "INSPECTION");
  const inspecting = !!inspection && inspection.status !== "pending";
  if (paid || input.track || inspecting)
    out.push({
      step: "production/pre-production",
      key: "production_plan",
      done: !!input.track?.etd || inspecting,
    });
  if (inspection && inspection.status !== "cancelled")
    out.push({
      step: "production/production",
      key: "production",
      done: inspecting,
    });
  // Recebimento no CD (descarga, contagem, RIC e fechamento).
  if (
    input.receiving ||
    order.status === "DELIVERED" ||
    order.status === "CLOSED"
  )
    out.push({
      step: "delivery/storage",
      key: "receiving",
      done: !!input.receiving?.closedAt || order.status === "CLOSED",
    });
  return out;
}

/** Os marcos de um pedido, lendo o que ele tem (leituras pelo pedido). */
export async function milestonesOf(input: Order): Promise<MilestoneView[]> {
  const store = getStore();
  // A situação de agora (o pedido pode ter mudado depois de lido).
  const order = (await store.get("orders", input.id)) ?? input;
  const filter = { orderId: order.id };
  const [stages, requirements, importSteps, tracks, receivings, lpco] =
    await Promise.all([
      store.list("stages", { filter }),
      store.list("requirements", { filter }),
      store.list("import_steps", { filter }).catch(() => []),
      store.list("production_tracks", { filter }).catch(() => []),
      store.list("receivings", { filter }).catch(() => []),
      lpcoApplies(order).catch(() => false),
    ]);
  return orderMilestones(
    orderSubtasks({
      order,
      stages,
      requirements,
      importSteps,
      track: tracks[0] ?? null,
      receiving: receivings[0] ?? null,
      lpco,
    }),
    order.status,
  );
}
