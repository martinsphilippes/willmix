import "server-only";

import {
  getStore,
  type Order,
  type Requirement,
  type Role,
  type Stage,
  type StageKey,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWillmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/services/audit";
import { notify, notifyWillmix } from "@/lib/services/notifications";
import { STAGE_KEYS } from "@/lib/db/schema";
import { ROLE_PARTY_FIELD, STAGE_TEMPLATES, nextStageKey } from "./stages";

export class WorkflowError extends Error {}

/* ------------------------------------------------------------------------ */
/* Criação das etapas de um pedido                                           */
/* ------------------------------------------------------------------------ */

export async function createStagesForOrder(order: Order) {
  const store = getStore();
  const settings = await getSettings();
  const line = order.lineId ? await store.get("product_lines", order.lineId) : null;
  const ctx = {
    order,
    line,
    agencyValidationEnabled: settings.agencyValidationEnabled,
    deliveryConfirmationMode: settings.deliveryConfirmationMode,
  };

  let firstStageId: string | null = null;
  for (const [index, template] of STAGE_TEMPLATES.entries()) {
    const isFirst = index === 0;
    const partyId = template.partyField ? order[template.partyField] : null;
    const templates = template.requirements(ctx);
    const stage = await store.create("stages", {
      orderId: order.id,
      key: template.key,
      sequence: index,
      status: isFirst ? "active" : "pending",
      responsibleRole: templates[0]?.role ?? template.responsibleRole,
      responsiblePartyId: partyId ?? null,
      dueAt: isFirst ? dueDate(settings.stageDueDays[template.key]) : null,
      startedAt: isFirst ? new Date().toISOString() : null,
      completedAt: null,
      percent: 0,
      reminderSentAt: null,
      blockReason: null,
    });
    if (isFirst) firstStageId = stage.id;
    for (const req of templates) {
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: req.key,
        label: req.label,
        type: req.type,
        required: req.required,
        role: req.role,
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
        note: null,
      });
    }
  }
  await store.update("orders", order.id, { currentStageId: firstStageId, status: "ORDER_CREATED" });
  return firstStageId;
}

/* ------------------------------------------------------------------------ */
/* Submissão de requisitos                                                   */
/* ------------------------------------------------------------------------ */

export interface SubmitInput {
  value?: string | null;
  documentId?: string | null;
  note?: string | null;
}

/** Quem pode preencher: Willmix sempre; o papel do requisito quando vinculado ao parceiro certo. */
export function canSubmitRequirement(
  user: User,
  order: Order,
  requirement: Pick<Requirement, "role">,
): boolean {
  if (isWillmix(user)) return true;
  if (user.role !== requirement.role) return false;
  const partyField = ROLE_PARTY_FIELD[user.role];
  if (!partyField) return false;
  return order[partyField] === user.partyId;
}

export async function submitRequirement(user: User, requirementId: string, input: SubmitInput) {
  const store = getStore();
  const requirement = await store.get("requirements", requirementId);
  if (!requirement) throw new WorkflowError("requirement_not_found");
  const stage = await store.get("stages", requirement.stageId);
  const order = await store.get("orders", requirement.orderId);
  if (!stage || !order) throw new WorkflowError("order_not_found");
  if (!canSubmitRequirement(user, order, requirement)) throw new ForbiddenError();
  if (stage.status !== "active" && stage.status !== "blocked") {
    throw new WorkflowError("stage_not_active");
  }

  if (requirement.type === "file" || requirement.type === "photo") {
    if (!input.documentId) throw new WorkflowError("document_required");
  } else if (requirement.type === "number") {
    if (input.value === undefined || input.value === null || Number.isNaN(Number(input.value))) {
      throw new WorkflowError("number_required");
    }
  } else if (requirement.type === "text" || requirement.type === "date") {
    if (!input.value) throw new WorkflowError("value_required");
  }

  const before = { status: requirement.status, value: requirement.value };
  const updated = await store.update("requirements", requirement.id, {
    status: "done",
    value: input.value ?? requirement.value,
    documentId: input.documentId ?? requirement.documentId,
    note: input.note ?? requirement.note,
    submittedByUserId: user.id,
    submittedAt: new Date().toISOString(),
  });
  await audit(user, "requirement.submit", "requirement", requirement.id, `${stage.key}: ${requirement.label}`, before, {
    status: "done",
    value: updated.value,
  });

  // Regra específica: número do ERP informado manualmente.
  if (stage.key === "ORDER_CREATED" && requirement.key === "erp_number" && input.value) {
    await store.update("orders", order.id, { erpNumber: input.value, erpSyncStatus: "manual" });
  }

  // Regra específica: inspeção compara peso medido com peso declarado na preparação.
  if (stage.key === "INSPECTION" && requirement.key === "weight_measured") {
    await checkWeightDivergence(user, order, stage, Number(input.value));
  }

  // Aprovação de requisito pai (ex.: arte): quando o arquivo é reenviado, a aprovação volta a pendente.
  if (requirement.key === "art") {
    const approvals = await store.list("requirements", {
      filter: { stageId: stage.id, key: "art_approval" },
    });
    for (const approval of approvals) {
      if (approval.status !== "pending") {
        await store.update("requirements", approval.id, { status: "pending", value: null, note: null });
      }
    }
  }

  await evaluateStage(user, stage.id);
  return updated;
}

/** Aprova ou reprova um requisito do tipo approval (agência, revisão Willmix). */
export async function decideRequirement(
  user: User,
  requirementId: string,
  decision: "approve" | "reject",
  note?: string | null,
) {
  const store = getStore();
  const requirement = await store.get("requirements", requirementId);
  if (!requirement) throw new WorkflowError("requirement_not_found");
  if (requirement.type !== "approval") throw new WorkflowError("not_approval");
  const stage = await store.get("stages", requirement.stageId);
  const order = await store.get("orders", requirement.orderId);
  if (!stage || !order) throw new WorkflowError("order_not_found");
  if (!canSubmitRequirement(user, order, requirement)) throw new ForbiddenError();

  const now = new Date().toISOString();
  if (decision === "approve") {
    await store.update("requirements", requirement.id, {
      status: "done",
      value: "approved",
      note: note ?? null,
      submittedByUserId: user.id,
      submittedAt: now,
    });
    if (stage.status === "blocked") {
      await store.update("stages", stage.id, { status: "active", blockReason: null });
    }
    await audit(user, "requirement.approve", "requirement", requirement.id, `${stage.key}: ${requirement.label}`);
  } else {
    await store.update("requirements", requirement.id, {
      status: "rejected",
      value: "rejected",
      note: note ?? null,
      submittedByUserId: user.id,
      submittedAt: now,
    });
    // O requisito que originou a aprovação volta a pendente para reenvio.
    const sourceKey = requirement.key === "art_approval" ? "art" : null;
    if (sourceKey) {
      const [source] = await store.list("requirements", { filter: { stageId: stage.id, key: sourceKey } });
      if (source) await store.update("requirements", source.id, { status: "rejected", note: note ?? null });
    }
    await audit(user, "requirement.reject", "requirement", requirement.id, `${stage.key}: ${requirement.label}`);
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        subject: `Pedido #${order.number}: ${requirement.label} reprovado`,
        body: note ?? "Revise e reenvie.",
        link: `/app/orders/${order.id}`,
      },
    );
  }
  await evaluateStage(user, stage.id);
}

async function checkWeightDivergence(user: User, order: Order, stage: Stage, measured: number) {
  const store = getStore();
  const settings = await getSettings();
  const stages = await store.list("stages", { filter: { orderId: order.id, key: "PREPARATION" } });
  if (!stages[0]) return;
  const [declared] = await store.list("requirements", {
    filter: { stageId: stages[0].id, key: "weight" },
  });
  const declaredWeight = declared?.value ? Number(declared.value) : null;
  if (!declaredWeight || declaredWeight <= 0) return;
  const divergence = Math.abs(measured - declaredWeight) / declaredWeight;
  const tolerance = settings.weightTolerancePercent / 100;
  const [review] = await store.list("requirements", { filter: { stageId: stage.id, key: "inspection_review" } });

  if (divergence > tolerance) {
    const reason = `Peso divergente: declarado ${declaredWeight} kg, medido ${measured} kg (${(divergence * 100).toFixed(1)}% > ${settings.weightTolerancePercent}%). REVISÃO NECESSÁRIA.`;
    await store.update("stages", stage.id, { status: "blocked", blockReason: reason });
    if (!review) {
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: "inspection_review",
        label: "Revisão da divergência de peso (Willmix)",
        type: "approval",
        required: true,
        role: "operator",
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
        note: reason,
      });
    } else if (review.status !== "pending") {
      await store.update("requirements", review.id, { status: "pending", value: null, note: reason });
    }
    await audit(user, "inspection.divergence", "order", order.id, reason);
    await notifyWillmix({
      subject: `Pedido #${order.number}: revisão necessária na inspeção`,
      body: reason,
      link: `/app/orders/${order.id}`,
    });
  } else if (review && review.status === "pending" && stage.status === "blocked") {
    // Novo peso dentro da tolerância: libera sem exigir revisão.
    await store.update("requirements", review.id, { status: "done", value: "auto", note: "Dentro da tolerância após nova medição." });
    await store.update("stages", stage.id, { status: "active", blockReason: null });
  }
}

/* ------------------------------------------------------------------------ */
/* Avaliação e avanço                                                        */
/* ------------------------------------------------------------------------ */

/** Recalcula percentual e responsável; conclui a etapa e ativa a próxima quando tudo obrigatório está feito. */
export async function evaluateStage(user: User | null, stageId: string) {
  const store = getStore();
  const stage = await store.get("stages", stageId);
  if (!stage || stage.status === "done" || stage.status === "pending") return;
  const requirements = await store.list("requirements", { filter: { stageId } });
  const required = requirements.filter((r) => r.required);
  const done = required.filter((r) => r.status === "done").length;
  const percent = required.length === 0 ? 100 : Math.round((done / required.length) * 100);
  const nextPending = required.find((r) => r.status !== "done");
  const responsibleRole: Role = nextPending?.role ?? stage.responsibleRole;

  if (stage.status === "blocked") {
    await store.update("stages", stageId, { percent, responsibleRole });
    return;
  }
  if (nextPending) {
    await store.update("stages", stageId, { percent, responsibleRole });
    return;
  }
  await completeStage(user, stage);
}

async function completeStage(user: User | null, stage: Stage) {
  const store = getStore();
  const now = new Date().toISOString();
  await store.update("stages", stage.id, { status: "done", percent: 100, completedAt: now, blockReason: null });
  await audit(user, "stage.complete", "stage", stage.id, `${stage.key} concluída`);

  const order = await store.get("orders", stage.orderId);
  if (!order) return;
  const next = nextStageKey(stage.key);
  if (!next) {
    await store.update("orders", order.id, { status: "CLOSED", closedAt: now, currentStageId: null });
    return;
  }
  await activateStage(user, order, next);
}

async function activateStage(user: User | null, order: Order, key: StageKey) {
  const store = getStore();
  const settings = await getSettings();
  const [stage] = await store.list("stages", { filter: { orderId: order.id, key } });
  if (!stage) return;
  const now = new Date().toISOString();
  const requirements = await store.list("requirements", { filter: { stageId: stage.id } });
  const required = requirements.filter((r) => r.required);

  await store.update("stages", stage.id, {
    status: "active",
    startedAt: now,
    dueAt: dueDate(settings.stageDueDays[key]),
    responsibleRole: required[0]?.role ?? stage.responsibleRole,
  });
  await store.update("orders", order.id, { status: key, currentStageId: stage.id });
  await audit(user, "stage.activate", "stage", stage.id, `${key} iniciada`);

  if (required.length === 0) {
    // Etapa sem requisitos (CLOSED) conclui na hora.
    const fresh = await store.get("stages", stage.id);
    if (fresh) await completeStage(user, fresh);
    return;
  }

  const role = required[0].role;
  const partyField = ROLE_PARTY_FIELD[role];
  await notify(
    { role: role === "operator" ? ["admin", "operator"] : role, partyId: partyField ? order[partyField] : null },
    {
      subject: `Pedido #${order.number}: etapa ${key} aguarda sua ação`,
      body: `Pendências: ${required.map((r) => r.label).join(", ")}.`,
      link: `/app/orders/${order.id}`,
    },
  );
}

/** Willmix pode reabrir a etapa ativa após uma revisão (ex.: inspeção). */
export async function unblockStage(user: User, stageId: string) {
  if (!isWillmix(user)) throw new ForbiddenError();
  const store = getStore();
  await store.update("stages", stageId, { status: "active", blockReason: null });
  await audit(user, "stage.unblock", "stage", stageId, "Etapa desbloqueada");
  await evaluateStage(user, stageId);
}

function dueDate(days: number | undefined) {
  const d = new Date();
  d.setDate(d.getDate() + (days ?? 7));
  return d.toISOString();
}

/* ------------------------------------------------------------------------ */
/* Consultas de apoio                                                        */
/* ------------------------------------------------------------------------ */

export interface OrderProgress {
  order: Order;
  stages: Stage[];
  requirements: Requirement[];
}

export async function loadOrderProgress(orderId: string): Promise<OrderProgress | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) return null;
  const stages = await store.list("stages", { filter: { orderId }, orderBy: "sequence" });
  const requirements = await store.list("requirements", { filter: { orderId } });
  return { order, stages, requirements };
}

export const STAGE_ORDER = STAGE_KEYS;
