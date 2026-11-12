import "server-only";

import { isRoundsParent } from "@/lib/purchase-rounds";
import { can } from "@/lib/auth/function-access";

import {
  getStore,
  type Order,
  type Requirement,
  type Role,
  type Stage,
  type StageKey,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/services/audit";
import {
  requesterTarget,
  notify,
  notifyWellmix,
} from "@/lib/services/notifications";
import { STAGE_KEYS } from "@/lib/db/schema";
import { requirementLabel } from "@/i18n";
import {
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  artRole,
  canCompleteLater,
  isOffFlowStage,
  isOrderDocumentKey,
  isOrderSignatureKey,
  ORDER_SIGN_SEND,
  ORDER_SIGNED_WELLMIX,
  nextStageKey,
  isPurchaseFlow,
} from "./stages";
import {
  compareInspection,
  isInspectionMeasureKey,
} from "@/lib/services/inspection";
import { openReview, resolveReviews } from "@/lib/services/reviews";
import { openAfterSales } from "@/lib/services/after-sales";

import { isMoneyRequirement, parseMoneyValue } from "./money";
import {
  approvalSourceOf,
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  prerequisitesOf,
  type LaneItem,
} from "@/lib/purchase-lanes";

export class WorkflowError extends Error {}

/*
 * Datas que precisam vir em ordem: a previsão de chegada não pode ser antes
 * da data de embarque, nem a previsão de entrega antes da chegada. Vale nos
 * dois sentidos (mudar o embarque para depois da chegada também é recusado).
 * Na mesma etapa, a primeira data vem antes (`first`): a chegada só é aceita
 * com o embarque informado, para sempre ser conferida com ele.
 */
const DATE_ORDER: Array<{
  before: { stage: string; key: string };
  after: { stage: string; key: string };
  /** Código do erro quando "after" < "before", e quando "before" > "after". */
  errors: [string, string];
  /** "after" só depois de "before" informado (código do erro e do aviso). */
  first?: string;
}> = [
  {
    before: { stage: "SHIPPING", key: "ship_date" },
    after: { stage: "SHIPPING", key: "eta" },
    errors: ["eta_before_ship_date", "ship_date_after_eta"],
    first: "ship_date_first",
  },
  {
    before: { stage: "SHIPPING", key: "eta" },
    after: { stage: "TRANSPORT", key: "eta" },
    errors: ["delivery_before_eta", "eta_after_delivery"],
  },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

export interface DateBounds {
  min?: string;
  max?: string;
  /** Código do erro quando a data fica antes de `min` / depois de `max`. */
  minError?: string;
  maxError?: string;
}

/** Limites (min/max) de um requisito de data a partir dos outros já informados. */
export function dateBoundsFor(
  stageKey: string,
  requirementKey: string,
  valueOf: (stageKey: string, key: string) => string | null | undefined,
): DateBounds {
  const out: DateBounds = {};
  for (const rule of DATE_ORDER) {
    if (rule.after.stage === stageKey && rule.after.key === requirementKey) {
      const v = valueOf(rule.before.stage, rule.before.key);
      if (v && ISO_DAY.test(v)) {
        out.min = v.slice(0, 10);
        out.minError = rule.errors[0];
      }
    }
    // Com a regra `first`, a chegada só existe antes do embarque em pedidos de
    // antes da regra: aí o embarque real vale e a chegada volta a ser pedida
    // (sem limite máximo, para não travar a etapa).
    if (
      !rule.first &&
      rule.before.stage === stageKey &&
      rule.before.key === requirementKey
    ) {
      const v = valueOf(rule.after.stage, rule.after.key);
      if (v && ISO_DAY.test(v)) {
        out.max = v.slice(0, 10);
        out.maxError = rule.errors[1];
      }
    }
  }
  return out;
}

/**
 * Data da mesma etapa que precisa ser informada antes desta (ex.: a previsão
 * de chegada espera a data de embarque): a chave dela e o código do aviso.
 */
export function datePrerequisite(
  stageKey: string,
  requirementKey: string,
): { key: string; code: string } | null {
  const rule = DATE_ORDER.find(
    (r) =>
      r.first &&
      r.after.stage === stageKey &&
      r.after.key === requirementKey &&
      r.before.stage === stageKey,
  );
  return rule?.first ? { key: rule.before.key, code: rule.first } : null;
}

/**
 * Confere a ordem das datas. Devolve as datas que voltam a ser pedidas: a
 * chegada enviada antes do embarque (pedido de antes da regra) quando o
 * embarque real vem depois dela — em vez de recusar o embarque e travar a etapa.
 */
async function assertDateOrder(
  orderId: string,
  stageKey: string,
  requirementKey: string,
  value: string,
): Promise<Requirement[]> {
  if (!ISO_DAY.test(value) || Number.isNaN(Date.parse(value)))
    throw new WorkflowError("date_invalid");
  const store = getStore();
  const [stages, reqs] = await Promise.all([
    store.list("stages", { filter: { orderId } }),
    store.list("requirements", { filter: { orderId } }),
  ]);
  const stageKeyOf = new Map(stages.map((s) => [s.id, s.key as string]));
  const valueOf = (sk: string, key: string) =>
    reqs.find(
      (r) =>
        r.key === key &&
        r.status === "done" &&
        stageKeyOf.get(r.stageId) === sk,
    )?.value ?? null;
  const exists = (sk: string, key: string) =>
    reqs.some((r) => r.key === key && stageKeyOf.get(r.stageId) === sk);
  const day = value.slice(0, 10);
  const reopen: Requirement[] = [];
  for (const rule of DATE_ORDER) {
    if (rule.after.stage === stageKey && rule.after.key === requirementKey) {
      const before = valueOf(rule.before.stage, rule.before.key);
      // Sem a primeira data (que existe neste pedido), não há com o que conferir.
      if (!before && rule.first && exists(rule.before.stage, rule.before.key))
        throw new WorkflowError(rule.first);
      if (before && day < before.slice(0, 10))
        throw new WorkflowError(rule.errors[0]);
    }
    if (rule.before.stage === stageKey && rule.before.key === requirementKey) {
      const after = valueOf(rule.after.stage, rule.after.key);
      if (after && day > after.slice(0, 10)) {
        const self = reqs.find(
          (r) =>
            r.key === requirementKey && stageKeyOf.get(r.stageId) === stageKey,
        );
        const afterReq = reqs.find(
          (r) =>
            r.key === rule.after.key &&
            r.status === "done" &&
            stageKeyOf.get(r.stageId) === rule.after.stage,
        );
        if (rule.first && self && self.status !== "done" && afterReq) {
          reopen.push(afterReq);
          continue;
        }
        throw new WorkflowError(rule.errors[1]);
      }
    }
  }
  return reopen;
}

/* ------------------------------------------------------------------------ */
/* Criação das etapas de um pedido                                           */
/* ------------------------------------------------------------------------ */

/**
 * Cria as etapas e os itens do pedido. Pode ser chamada de novo no mesmo
 * pedido: o que já existe (etapa pela chave, item pela chave dentro da etapa)
 * é mantido e só o que falta é criado. Assim uma criação interrompida no
 * meio (tempo esgotado) é retomada sem duplicar nada.
 */
export async function createStagesForOrder(
  order: Order,
  /**
   * Roda depois de criar etapas e itens e antes de a 1ª etapa andar (a rodada
   * de uma programação de compra copia ali os itens já feitos no pai).
   */
  beforeStart?: () => Promise<void>,
) {
  const store = getStore();
  const settings = await getSettings();
  const [existingStages, existingRequirements] = await Promise.all([
    store.list("stages", { filter: { orderId: order.id } }),
    store.list("requirements", { filter: { orderId: order.id } }),
  ]);
  const line = order.lineId
    ? await store.get("product_lines", order.lineId)
    : null;
  // Pedido de compra: as raias são produto a produto, com o checklist da
  // linha de cada produto (docs/PURCHASE_ORDER.md).
  const items = isPurchaseFlow(order)
    ? await purchaseLaneItems(order.id)
    : undefined;
  const ctx = {
    order,
    line,
    agencyValidationEnabled: settings.agencyValidationEnabled,
    deliveryConfirmationMode: settings.deliveryConfirmationMode,
    inspectionExtendedChecks: settings.inspectionExtendedChecks,
    items,
  };

  let firstStageId: string | null = null;
  for (const [index, template] of STAGE_TEMPLATES.entries()) {
    const isFirst = index === 0;
    const partyId = template.partyField ? order[template.partyField] : null;
    const templates = template.requirements(ctx);
    const stage =
      existingStages.find((s) => s.key === template.key) ??
      (await store.create("stages", {
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
      }));
    if (isFirst) firstStageId = stage.id;
    const have = new Set(
      existingRequirements
        .filter((r) => r.stageId === stage.id)
        .map((r) => r.key),
    );
    for (const req of templates) {
      if (have.has(req.key)) continue;
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: req.key,
        label: req.label,
        type: req.type,
        // Foto é sempre obrigatória (evidência do pedido).
        required: req.type === "photo" ? true : req.required,
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
  await store.update("orders", order.id, {
    currentStageId: firstStageId,
    status: "ORDER_CREATED",
  });
  if (beforeStart && !existingStages.length) await beforeStart();
  // Pedido de compra: "Pedido criado" não tem itens e conclui na hora; as
  // raias abrem em seguida.
  if (isPurchaseFlow(order) && firstStageId && !existingStages.length)
    await evaluateStage(null, firstStageId);
  return firstStageId;
}

/** Produtos do pedido de compra, com o checklist da linha de cada um. */
async function purchaseLaneItems(orderId: string): Promise<LaneItem[]> {
  const store = getStore();
  const items = await store.list("order_items", { filter: { orderId } });
  const productIds = [
    ...new Set(items.map((i) => i.productId).filter((x): x is string => !!x)),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const lineIds = [...new Set(products.map((p) => p.lineId))];
  const lines = lineIds.length
    ? await store.list("product_lines", { filter: { id: lineIds } })
    : [];
  return [...items]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const line = product
        ? lines.find((l) => l.id === product.lineId)
        : undefined;
      return {
        id: item.id,
        name: item.name,
        lineRequirements: line?.requirements ?? null,
      };
    });
}

/* ------------------------------------------------------------------------ */
/* Submissão de requisitos                                                   */
/* ------------------------------------------------------------------------ */

export interface SubmitInput {
  value?: string | null;
  documentId?: string | null;
  note?: string | null;
  /**
   * Só o serviço da assinatura do documento do pedido marca: os itens de
   * assinatura não são concluídos pelo "Confirmar" comum.
   */
  signature?: boolean;
}

/** Quem pode preencher: Wellmix sempre; o papel do requisito quando vinculado ao parceiro certo. */
export function canSubmitRequirement(
  user: User,
  order: Order,
  requirement: Pick<Requirement, "role"> & Partial<Pick<Requirement, "key">>,
): boolean {
  if (isWellmix(user)) {
    // Ações que dependem de permissão (Equipe → Funções e acessos): validar
    // a arte do pedido de compra e assinar o contrato pela Wellmix.
    const key = requirement.key ?? "";
    if (baseKeyOf(key) === LANE_KEYS.artReview)
      return can(user, "art.validate");
    if (key === ORDER_SIGNED_WELLMIX) return can(user, "contract.sign");
    return true;
  }
  if (user.role !== requirement.role) return false;
  // Cliente: só o login solicitante do pedido.
  if (user.role === "customer" && order.requestedByUserId !== user.id)
    return false;
  const partyField = ROLE_PARTY_FIELD[user.role];
  // Login sem empresa não casa com pedido que ainda não tem esse parceiro.
  if (!partyField || !user.partyId) return false;
  return order[partyField] === user.partyId;
}

export async function submitRequirement(
  user: User,
  requirementId: string,
  input: SubmitInput,
) {
  const store = getStore();
  const requirement = await store.get("requirements", requirementId);
  if (!requirement) throw new WorkflowError("requirement_not_found");
  const stage = await store.get("stages", requirement.stageId);
  const order = await store.get("orders", requirement.orderId);
  if (!stage || !order) throw new WorkflowError("order_not_found");
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  // Validação da ficha pelo comprador: antes, a programação de compra
  // (que é da Wellmix) tem de estar feita.
  if (requirement.key === "sheet_validated") {
    const { scheduleDone } = await import("@/lib/services/purchase-sheet");
    if (!(await scheduleDone(order.id)))
      throw new WorkflowError("schedule_required");
  }
  // Assinatura do documento do pedido: só pela página do documento.
  if (isOrderSignatureKey(requirement.key) && !input.signature)
    throw new WorkflowError("signature_required");
  // Pedido de compra: a ordem dentro das raias (validar só a arte enviada;
  // arte final só com a arte validada e o certificado).
  if (isPurchaseFlow(order) && prerequisitesOf(requirement.key).length) {
    const siblings = await store.list("requirements", {
      filter: { stageId: stage.id },
    });
    if (blockedBy(requirement.key, siblings).length)
      throw new WorkflowError("lane_prerequisite");
  }
  if (
    stage.status !== "active" &&
    stage.status !== "blocked" &&
    // Embarque confirmado: BL, datas e navio ainda podem chegar depois.
    !canCompleteLater(stage, requirement, order)
  ) {
    throw new WorkflowError("stage_not_active");
  }
  // "Enviar para assinatura": só com a arte enviada e o selo da certificadora
  // já aplicado nela (decisão do dono). A recusa diz o que falta.
  if (requirement.key === ORDER_SIGN_SEND) {
    const { signSendBlockers } = await import("@/lib/services/order-signature");
    const [missing] = await signSendBlockers(order.id, stage.id);
    if (missing) throw new WorkflowError(`sign_send_${missing}_required`);
  }

  if (requirement.type === "file" || requirement.type === "photo") {
    if (!input.documentId) throw new WorkflowError("document_required");
  } else if (requirement.type === "number") {
    // Custos (dinheiro): "BRL 1234.56"; um número simples continua aceito.
    const money =
      isMoneyRequirement(requirement) && parseMoneyValue(input.value) !== null;
    if (
      !money &&
      (input.value === undefined ||
        input.value === null ||
        Number.isNaN(Number(input.value)))
    ) {
      throw new WorkflowError("number_required");
    }
  } else if (requirement.type === "text" || requirement.type === "date") {
    if (!input.value) throw new WorkflowError("value_required");
  }
  // Datas em ordem; uma chegada antiga, antes do embarque real, volta a ser pedida.
  const reopen =
    requirement.type === "date"
      ? await assertDateOrder(
          order.id,
          stage.key,
          requirement.key,
          String(input.value),
        )
      : [];

  const before = { status: requirement.status, value: requirement.value };
  const updated = await store.update("requirements", requirement.id, {
    status: "done",
    value: input.value ?? requirement.value,
    documentId: input.documentId ?? requirement.documentId,
    note: input.note ?? requirement.note,
    submittedByUserId: user.id,
    submittedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "requirement.submit",
    "requirement",
    requirement.id,
    `${stage.key}: ${requirement.label}`,
    before,
    {
      status: "done",
      value: updated.value,
    },
  );
  for (const r of reopen) {
    await store.update("requirements", r.id, {
      status: "pending",
      value: null,
      submittedByUserId: null,
      submittedAt: null,
      note: `Refazer: a data informada antes (${String(r.value ?? "").slice(0, 10)}) era anterior à ${requirement.label.toLowerCase()} (${String(input.value).slice(0, 10)}).`,
    });
    await audit(
      user,
      "requirement.reopen",
      "requirement",
      r.id,
      `${stage.key}: ${r.label} antes de ${requirement.label}`,
      { status: r.status, value: r.value },
      { status: "pending", value: null },
    );
  }

  // Pedido de compra: o passo seguinte da raia é avisado (validar a arte,
  // fazer a arte final com o certificado).
  if (isPurchaseFlow(order)) {
    const { afterLaneStep } = await import("@/lib/services/purchase-order");
    await afterLaneStep(order, requirement.key);
  }

  // Documento enviado para assinatura: a vez é da Wellmix (assina primeiro).
  if (requirement.key === ORDER_SIGN_SEND) {
    await notifyWellmix({
      kind: "action",
      subject: `Pedido #${order.number}: documento pronto para a assinatura da Wellmix`,
      body: `${user.name} enviou o documento do pedido para assinatura (arte enviada e selo aplicado). A Wellmix assina primeiro; o fornecedor assina em seguida.`,
      link: `/app/orders/${order.id}/purchase-order`,
    });
  }
  // Regra específica: número do ERP informado manualmente.
  if (
    stage.key === "ORDER_CREATED" &&
    requirement.key === "erp_number" &&
    input.value
  ) {
    await store.update("orders", order.id, {
      erpNumber: input.value,
      erpSyncStatus: "manual",
    });
  }

  // Regra específica: inspeção compara peso medido com peso declarado na preparação.
  if (stage.key === "INSPECTION" && requirement.key === "weight_measured") {
    await checkWeightDivergence(user, order, stage, Number(input.value));
  }
  // Inspeção cega: compara o que foi encontrado com o snapshot da compra (quando existe).
  if (stage.key === "INSPECTION" && isInspectionMeasureKey(requirement.key)) {
    const fresh = await store.get("stages", stage.id);
    await compareInspection(user, order, fresh ?? stage);
  }

  // Pedido de compra: a arte reenviada volta para a validação da Wellmix.
  if (isPurchaseFlow(order) && baseKeyOf(requirement.key) === "art") {
    const reviewKey = requirement.key.replace(/^art__/, "art_review__");
    const [review] = await store.list("requirements", {
      filter: { stageId: stage.id, key: reviewKey },
      limit: 1,
    });
    if (review && review.status !== "pending")
      await store.update("requirements", review.id, {
        status: "pending",
        value: null,
      });
  }
  // Aprovação de requisito pai (ex.: arte): quando o arquivo é reenviado, a aprovação volta a pendente.
  if (requirement.key === "art") {
    const approvals = await store.list("requirements", {
      filter: { stageId: stage.id, key: "art_approval" },
    });
    for (const approval of approvals) {
      if (approval.status !== "pending") {
        await store.update("requirements", approval.id, {
          status: "pending",
          value: null,
          note: null,
        });
      }
    }
    // A arte chegou: o fornecedor confere e aprova para produzir.
    if (approvals.length)
      await notify(
        { role: "supplier", partyId: order.supplierId },
        {
          kind: "action",
          link: `/app/orders/${order.id}`,
          text: (t) => ({
            subject: t("notif.artwork.subject", { n: order.number }),
            body: t("notif.artwork.body"),
          }),
        },
      );
  }

  // Regra específica: o fornecedor confirmar o recebimento é a prova do
  // pagamento. O registro da Wellmix (comprovante, câmbio) não trava a etapa:
  // conclui junto, marcado como concluído pela confirmação do fornecedor.
  if (
    stage.key === "SUPPLIER_PAYMENT" &&
    requirement.key === "payment_received"
  ) {
    const pending = await store.list("requirements", {
      filter: {
        stageId: stage.id,
        key: "payment_registered",
        status: "pending",
      },
    });
    for (const sibling of pending) {
      await store.update("requirements", sibling.id, {
        status: "done",
        value: "supplier_confirmed",
        note: "Concluído pela confirmação de recebimento do fornecedor",
        submittedByUserId: user.id,
        submittedAt: new Date().toISOString(),
      });
      await audit(
        user,
        "requirement.submit",
        "requirement",
        sibling.id,
        `${stage.key}: ${sibling.label} (confirmação do fornecedor)`,
        { status: "pending" },
        { status: "done", value: "supplier_confirmed" },
      );
    }
  }

  await evaluateStage(user, stage.id);
  return updated;
}

/**
 * Exclui a foto/arquivo enviado num requisito para mandar outro: o requisito
 * volta a pendente (a etapa recalcula o percentual). Só com a etapa aberta e
 * por quem pode enviar.
 */
export async function clearRequirementDocument(
  user: User,
  requirementId: string,
) {
  const store = getStore();
  const requirement = await store.get("requirements", requirementId);
  if (!requirement) throw new WorkflowError("requirement_not_found");
  const [stage, order] = await Promise.all([
    store.get("stages", requirement.stageId),
    store.get("orders", requirement.orderId),
  ]);
  if (!stage || !order) throw new WorkflowError("order_not_found");
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  if (
    stage.status !== "active" &&
    stage.status !== "blocked" &&
    !canCompleteLater(stage, requirement, order)
  )
    throw new WorkflowError("stage_not_active");
  if (requirement.type !== "photo" && requirement.type !== "file")
    throw new WorkflowError("not_a_file");
  const documentId = requirement.documentId;
  await store.update("requirements", requirement.id, {
    status: "pending",
    value: null,
    documentId: null,
    submittedByUserId: null,
    submittedAt: null,
  });
  if (documentId) {
    const doc = await store.get("documents", documentId);
    if (doc && doc.requirementId === requirement.id) {
      await store.remove("documents", doc.id);
      await store.removeFile(doc.storageKey).catch((error) => {
        console.error("clearRequirementDocument: arquivo não apagado", error);
      });
    }
  }
  // Arte excluída: a aprovação do fornecedor volta a pendente (como no reenvio).
  if (requirement.key === "art") {
    const approvals = await store.list("requirements", {
      filter: { stageId: stage.id, key: "art_approval" },
    });
    for (const approval of approvals)
      if (approval.status !== "pending")
        await store.update("requirements", approval.id, {
          status: "pending",
          value: null,
          note: null,
        });
  }
  await audit(
    user,
    "requirement.clear",
    "requirement",
    requirement.id,
    `${stage.key}: ${requirement.label} (arquivo excluído)`,
  );
  await evaluateStage(user, stage.id);
}

/** Aprova ou reprova um requisito do tipo approval (agência, revisão Wellmix). */
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
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  if (order.status === "CANCELLED" || stage.status === "cancelled")
    throw new WorkflowError("stage_not_active");
  // Como no envio: só na etapa aberta. Decisão já tomada só a Wellmix refaz
  // (a aprovação do fornecedor é a prova de que a arte foi aceita).
  if (stage.status !== "active" && stage.status !== "blocked")
    throw new WorkflowError("stage_not_active");
  if (requirement.status === "done" && !isWellmix(user))
    throw new WorkflowError("already_decided");
  // Aprovação da arte: só depois de a arte ser enviada (nada a aprovar antes).
  // Pedido de compra: a validação da arte de cada produto confere a arte dele.
  const sourceKey =
    requirement.key === "art_approval"
      ? "art"
      : approvalSourceOf(requirement.key);
  const [source] = sourceKey
    ? await store.list("requirements", {
        filter: { stageId: stage.id, key: sourceKey },
        limit: 1,
      })
    : [];
  if (sourceKey && (!source || source.status !== "done"))
    throw new WorkflowError("art_missing");

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
      await store.update("stages", stage.id, {
        status: "active",
        blockReason: null,
      });
    }
    if (requirement.key === "inspection_review") {
      await resolveReviews(user, "order", order.id, {
        rulePrefix: "inspection.",
        note: note ?? "Divergência aprovada pela Wellmix.",
      });
    }
    await audit(
      user,
      "requirement.approve",
      "requirement",
      requirement.id,
      `${stage.key}: ${requirement.label}`,
    );
    if (isPurchaseFlow(order)) {
      const { afterLaneStep } = await import("@/lib/services/purchase-order");
      await afterLaneStep(order, requirement.key);
    }
  } else {
    await store.update("requirements", requirement.id, {
      status: "rejected",
      value: "rejected",
      note: note ?? null,
      submittedByUserId: user.id,
      submittedAt: now,
    });
    // Inspeção reprovada: as medidas voltam para o fornecedor medir de novo.
    if (requirement.key === "inspection_review")
      await reopenInspectionMeasures(user, stage, note ?? null);
    // O requisito que originou a aprovação volta para quem o refaz: a arte,
    // para quem faz a arte hoje (a agência do pedido ou, sem ela, a Wellmix).
    const redoRoleNow: Role | null =
      source?.key === "art" || (source && baseKeyOf(source.key) === "art")
        ? artRole(order, (await getSettings()).agencyValidationEnabled)
        : (source?.role ?? null);
    if (source)
      await store.update("requirements", source.id, {
        status: "rejected",
        note: note ?? null,
        ...(redoRoleNow && redoRoleNow !== source.role
          ? { role: redoRoleNow }
          : {}),
      });
    await audit(
      user,
      "requirement.reject",
      "requirement",
      requirement.id,
      `${stage.key}: ${requirement.label}`,
    );
    // Avisa quem refaz (arte: agência ou Wellmix); sem origem, o fornecedor
    // (como antes). Parceiro sem empresa no pedido: avisa a Wellmix, nunca
    // todas as empresas daquele papel.
    const redoRole: Role = redoRoleNow ?? "supplier";
    const redoField = ROLE_PARTY_FIELD[redoRole];
    const redoParty = redoField ? order[redoField] : null;
    await notify(
      redoRole === "operator" || redoRole === "admin" || !redoParty
        ? { role: ["admin", "operator"] }
        : { role: redoRole, partyId: redoParty },
      {
        kind: "action",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t("notif.rejected.subject", {
            n: order.number,
            item: requirementLabel(t, requirement),
          }),
          body: note ?? t("notif.rejected.body"),
        }),
      },
    );
  }
  await evaluateStage(user, stage.id);
}

/**
 * Reprovação da revisão da inspeção = pedido de nova medição: as medidas e a
 * foto na balança já enviadas voltam a "reprovado" (com formulário para o
 * fornecedor) e a etapa fica em andamento. Os valores antigos ficam no item e
 * na auditoria; a comparação usa só o que for reenviado.
 */
async function reopenInspectionMeasures(
  user: User,
  stage: Stage,
  note: string | null,
) {
  const store = getStore();
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  const reopenNote = note
    ? `Nova medição solicitada pela Wellmix: ${note}`
    : "Nova medição solicitada pela Wellmix.";
  for (const r of requirements) {
    if (r.status !== "done") continue;
    if (!isInspectionMeasureKey(r.key) && r.key !== "photo_scale") continue;
    await store.update("requirements", r.id, {
      status: "rejected",
      note: reopenNote,
    });
  }
  if (stage.status === "blocked")
    await store.update("stages", stage.id, {
      status: "active",
      blockReason: null,
    });
  await audit(
    user,
    "inspection.remeasure_requested",
    "stage",
    stage.id,
    reopenNote,
  );
}

/** Itens de revisão da inspeção abertos além do peso declarado × medido. */
async function otherInspectionReviewsOpen(orderId: string) {
  const open = await getStore().list("review_items", {
    filter: { entity: "order", entityId: orderId, status: "open" },
  });
  return open.some(
    (r) =>
      r.rule.startsWith("inspection.") &&
      r.rule !== "inspection.weightDeclared" &&
      r.rule !== "inspection.netWeightKg",
  );
}

async function checkWeightDivergence(
  user: User,
  order: Order,
  stage: Stage,
  measured: number,
) {
  const store = getStore();
  const settings = await getSettings();
  const stages = await store.list("stages", {
    filter: { orderId: order.id, key: "PREPARATION" },
  });
  if (!stages[0]) return;
  // Com ficha de compra, o peso entra na comparação comprado × inspecionado
  // (compareInspection). Esta regra fica para pedidos antigos, que usam o item
  // "Peso (kg)" da Preparação.
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId: order.id },
    limit: 1,
  });
  if (sheet?.netWeightPcKg) return;
  const [declared] = await store.list("requirements", {
    filter: { stageId: stages[0].id, key: "weight" },
  });
  const declaredWeight = declared?.value ? Number(declared.value) : null;
  if (!declaredWeight || declaredWeight <= 0) return;
  const divergence = Math.abs(measured - declaredWeight) / declaredWeight;
  const tolerance = settings.weightTolerancePercent / 100;
  const [review] = await store.list("requirements", {
    filter: { stageId: stage.id, key: "inspection_review" },
  });

  if (divergence > tolerance) {
    const reason = `Peso divergente: declarado ${declaredWeight} kg, medido ${measured} kg (${(divergence * 100).toFixed(1)}% > ${settings.weightTolerancePercent}%). REVISÃO NECESSÁRIA.`;
    await store.update("stages", stage.id, {
      status: "blocked",
      blockReason: reason,
    });
    if (!review) {
      await store.create("requirements", {
        orderId: order.id,
        stageId: stage.id,
        key: "inspection_review",
        label: "Revisão da divergência de peso (Wellmix)",
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
      await store.update("requirements", review.id, {
        status: "pending",
        value: null,
        note: reason,
      });
    }
    await audit(user, "inspection.divergence", "order", order.id, reason);
    await openReview(user, {
      orderId: order.id,
      entity: "order",
      entityId: order.id,
      rule: "inspection.weightDeclared",
      problem: `Peso medido divergente do declarado na preparação (tolerância ${settings.weightTolerancePercent}%)`,
      expected: declaredWeight,
      found: measured,
      responsibleRole: "operator",
      action:
        "Revisar com o fornecedor; aprovar a divergência ou pedir nova medição.",
      link: `/app/orders/${order.id}`,
    });
    await notifyWellmix({
      kind: "alert",
      actor: "recipient",
      subject: `Pedido #${order.number}: revisão necessária na inspeção`,
      body: reason,
      link: `/app/orders/${order.id}`,
    });
  } else if (
    review &&
    ((review.status === "pending" && stage.status === "blocked") ||
      (review.status === "rejected" &&
        !(await otherInspectionReviewsOpen(order.id))))
  ) {
    // Novo peso dentro da tolerância: libera sem exigir revisão.
    await store.update("requirements", review.id, {
      status: "done",
      value: "auto",
      note: "Dentro da tolerância após nova medição.",
    });
    await store.update("stages", stage.id, {
      status: "active",
      blockReason: null,
    });
    await resolveReviews(user, "order", order.id, {
      rulePrefix: "inspection.weightDeclared",
      note: "Dentro da tolerância após nova medição.",
    });
  }
}

/* ------------------------------------------------------------------------ */
/* Avaliação e avanço                                                        */
/* ------------------------------------------------------------------------ */

/** Recalcula percentual e responsável; conclui a etapa e ativa a próxima quando tudo obrigatório está feito. */
export async function evaluateStage(user: User | null, stageId: string) {
  const store = getStore();
  const stage = await store.get("stages", stageId);
  if (
    !stage ||
    stage.status === "done" ||
    stage.status === "pending" ||
    stage.status === "cancelled"
  )
    return;
  const requirements = await store.list("requirements", {
    filter: { stageId },
  });
  // Etapa fora do fluxo (pagamento ao fornecedor): nada nela segura o pedido,
  // nem os itens que os pedidos antigos ainda têm.
  const required = isOffFlowStage(stage.key)
    ? []
    : requirements.filter((r) => r.required);
  const done = required.filter((r) => r.status === "done").length;
  const percent =
    required.length === 0 ? 100 : Math.round((done / required.length) * 100);
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

/** Regras de processo do evento de etapa (docs/PROCESSES.md). Nunca lança. */
async function emitStageEvent(
  user: User | null,
  orderId: string,
  event: `stage:${StageKey}:${"start" | "done"}`,
) {
  const { emitProcessEvent } = await import("@/lib/services/process-engine");
  await emitProcessEvent(user, event, { orderId });
}

async function completeStage(user: User | null, stage: Stage) {
  const store = getStore();
  const now = new Date().toISOString();
  await store.update("stages", stage.id, {
    status: "done",
    percent: 100,
    completedAt: now,
    blockReason: null,
  });
  await audit(
    user,
    "stage.complete",
    "stage",
    stage.id,
    `${stage.key} concluída`,
  );
  await emitStageEvent(user, stage.orderId, `stage:${stage.key}:done`);

  const order = await store.get("orders", stage.orderId);
  // Pedido cancelado não avança.
  if (!order || order.status === "CANCELLED") return;
  // Entregue: o processo continua no pós-venda (entidade própria; as etapas não mudam).
  if (stage.key === "DELIVERED") await openAfterSales(user, order);
  // Pedido pai de uma programação de compra (docs/PURCHASE_SCHEDULE.md): para
  // depois da Preparação (artes e certificado prontos). Contrato e produção
  // são de cada rodada; as que já chegaram ao dia nascem agora.
  if (stage.key === "PREPARATION" && isRoundsParent(order)) {
    const { spawnDueRounds } = await import("@/lib/services/purchase-rounds");
    await spawnDueRounds(user, { orderId: order.id }).catch((error) =>
      console.error("spawnDueRounds", error),
    );
    return;
  }
  const next = nextStageKey(stage.key);
  if (!next) {
    await store.update("orders", order.id, {
      status: "CLOSED",
      closedAt: now,
      currentStageId: null,
    });
    return;
  }
  await activateStage(user, order, next);
}

async function activateStage(user: User | null, order: Order, key: StageKey) {
  const store = getStore();
  const settings = await getSettings();
  const [stage] = await store.list("stages", {
    filter: { orderId: order.id, key },
  });
  if (!stage) return;
  const now = new Date().toISOString();
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  const required = isOffFlowStage(key)
    ? []
    : requirements.filter((r) => r.required);
  // Obrigatórios já concluídos antes de a etapa abrir (ex.: arte enviada no
  // briefing de embalagem da RFQ): o responsável e o aviso são do próximo
  // pendente, e o percentual já conta o que está feito.
  const pendingRequired = required.filter((r) => r.status !== "done");
  const percent =
    required.length === 0
      ? 0
      : Math.round(
          ((required.length - pendingRequired.length) / required.length) * 100,
        );

  await store.update("stages", stage.id, {
    status: "active",
    startedAt: now,
    dueAt: dueDate(settings.stageDueDays[key]),
    responsibleRole:
      pendingRequired[0]?.role ?? required[0]?.role ?? stage.responsibleRole,
    ...(percent > 0 ? { percent } : {}),
  });
  await store.update("orders", order.id, {
    status: key,
    currentStageId: stage.id,
  });
  await audit(user, "stage.activate", "stage", stage.id, `${key} iniciada`);
  await emitStageEvent(user, order.id, `stage:${key}:start`);

  // Pedido de compra: as três raias começam juntas, cada uma com o seu aviso.
  if (
    key === "PREPARATION" &&
    isPurchaseFlow(order) &&
    pendingRequired.length > 0
  ) {
    const { notifyLanesOpen } = await import("@/lib/services/purchase-order");
    await notifyLanesOpen(order, pendingRequired);
    return;
  }

  // Preparação com a ficha completa desde a cotação: conclui sem pedir nada ao fornecedor.
  if (
    key === "PREPARATION" &&
    user &&
    required.length > 0 &&
    !isPurchaseFlow(order)
  ) {
    const { syncPreparationFromSheet } =
      await import("@/lib/services/purchase-sheet");
    await syncPreparationFromSheet(user, order.id);
    const fresh = await store.get("stages", stage.id);
    if (fresh?.status === "done") return;
  }

  if (required.length === 0) {
    // Etapa sem requisitos (CLOSED) ou fora do fluxo conclui na hora.
    const fresh = await store.get("stages", stage.id);
    if (fresh) await completeStage(user, fresh);
    return;
  }
  if (pendingRequired.length === 0) {
    // Tudo já estava feito: conclui e segue (mesma regra de evaluateStage).
    await evaluateStage(user, stage.id);
    return;
  }

  const role = pendingRequired[0].role;
  const partyField = ROLE_PARTY_FIELD[role];
  const firstSteps = pendingRequired.filter((r) => !isOrderDocumentKey(r.key));
  await notify(
    role === "customer"
      ? requesterTarget(order.requestedByUserId)
      : {
          role: role === "operator" ? ["admin", "operator"] : role,
          partyId: partyField ? order[partyField] : null,
        },
    {
      kind: "action",
      link: `/app/orders/${order.id}`,
      text: (t) => ({
        subject: t("notif.stage.subject", {
          n: order.number,
          stage: t(`stage.${key}`),
        }),
        body: t("notif.stage.body", {
          // O envio para assinatura e as assinaturas vêm depois, cada um com
          // o seu aviso: aqui vai só o que já dá para fazer.
          items: (firstSteps.length ? firstSteps : pendingRequired)
            .map((r) => requirementLabel(t, r))
            .join(", "),
        }),
      }),
    },
  );
}

/** Wellmix pode reabrir a etapa ativa após uma revisão (ex.: inspeção). */
export async function unblockStage(user: User, stageId: string) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const stage = await store.get("stages", stageId);
  if (stage?.status === "cancelled")
    throw new WorkflowError("stage_not_active");
  await store.update("stages", stageId, {
    status: "active",
    blockReason: null,
  });
  if (stage)
    await resolveReviews(user, "order", stage.orderId, {
      rulePrefix: "inspection.",
      status: "dismissed",
      note: "Etapa liberada manualmente pela Wellmix.",
    });
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

export async function loadOrderProgress(
  orderId: string,
): Promise<OrderProgress | null> {
  const store = getStore();
  // As três leituras dependem só do id: saem juntas (uma rodada de rede).
  const [order, stages, requirements] = await Promise.all([
    store.get("orders", orderId),
    store.list("stages", { filter: { orderId }, orderBy: "sequence" }),
    store.list("requirements", { filter: { orderId } }),
  ]);
  if (!order) return null;
  return { order, stages, requirements };
}

export const STAGE_ORDER = STAGE_KEYS;
