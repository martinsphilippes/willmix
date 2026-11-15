import "server-only";

import { can } from "@/lib/auth/function-access";

import {
  getStore,
  type Order,
  type Requirement,
  type Role,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/services/audit";
import { notify, notifyWellmix } from "@/lib/services/notifications";
import { requirementLabel } from "@/i18n";
import { realName, withoutPlaceholder } from "@/lib/placeholder-name";
import {
  ROLE_PARTY_FIELD,
  STAGE_TEMPLATES,
  artRole,
  isOrderSignatureKey,
  ORDER_SIGN_SEND,
  ORDER_SIGNED_WELLMIX,
  isPurchaseFlow,
  purchaseWithoutArt,
  SHIPPED_KEY,
} from "./templates";
import {
  compareInspection,
  isInspectionMeasureKey,
} from "@/lib/services/inspection";
import { openReview, resolveReviews } from "@/lib/services/reviews";

import { isMoneyRequirement, parseMoneyValue } from "./money";
import { requirementFlowFields, stepOfItem } from "@/lib/milestones";
import {
  INSPECTION_BLOCK_MILESTONE,
  milestoneBlockOf,
  orderRelease,
  queueMilestoneSync,
  setMilestoneBlock,
  storedMilestone,
  syncMilestones,
} from "@/lib/services/order-milestones";
import { milestoneOfItem, requirementReleased } from "@/lib/milestone-release";
import {
  approvalSourceOf,
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  isAutoGateKey,
  isRoutedLaneKey,
  isSampleOrderKey,
  prerequisitesOf,
  type LaneItem,
  milestoneApprovalOf,
} from "@/lib/purchase-lanes";

export class WorkflowError extends Error {}

/*
 * Datas que precisam vir em ordem: a previsão de chegada não pode ser antes
 * da data de embarque, nem a previsão de entrega antes da chegada. Vale nos
 * dois sentidos (mudar o embarque para depois da chegada também é recusado).
 * No mesmo passo, a primeira data vem antes (`first`): a chegada só é aceita
 * com o embarque informado, para sempre ser conferida com ele. Fase 5g: o
 * item é identificado pelo passo do menu e pela chave (`eta` existe no
 * Embarque e no Transporte).
 */
export const SHIPMENT_STEP = "production/shipment";
export const TRANSPORT_STEP = "delivery/logistics";

const DATE_ORDER: Array<{
  before: { step: string; key: string };
  after: { step: string; key: string };
  /** Código do erro quando "after" < "before", e quando "before" > "after". */
  errors: [string, string];
  /** "after" só depois de "before" informado (código do erro e do aviso). */
  first?: string;
}> = [
  {
    before: { step: SHIPMENT_STEP, key: "ship_date" },
    after: { step: SHIPMENT_STEP, key: "eta" },
    errors: ["eta_before_ship_date", "ship_date_after_eta"],
    first: "ship_date_first",
  },
  {
    before: { step: SHIPMENT_STEP, key: "eta" },
    after: { step: TRANSPORT_STEP, key: "eta" },
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

/** Limites (min/max) de um item de data (passo e chave) pelos outros já informados. */
export function dateBoundsFor(
  step: string,
  requirementKey: string,
  valueOf: (step: string, key: string) => string | null | undefined,
): DateBounds {
  const out: DateBounds = {};
  for (const rule of DATE_ORDER) {
    if (rule.after.step === step && rule.after.key === requirementKey) {
      const v = valueOf(rule.before.step, rule.before.key);
      if (v && ISO_DAY.test(v)) {
        out.min = v.slice(0, 10);
        out.minError = rule.errors[0];
      }
    }
    // Com a regra `first`, a chegada só existe antes do embarque em pedidos de
    // antes da regra: aí o embarque real vale e a chegada volta a ser pedida
    // (sem limite máximo, para não travar o passo).
    if (
      !rule.first &&
      rule.before.step === step &&
      rule.before.key === requirementKey
    ) {
      const v = valueOf(rule.after.step, rule.after.key);
      if (v && ISO_DAY.test(v)) {
        out.max = v.slice(0, 10);
        out.maxError = rule.errors[1];
      }
    }
  }
  return out;
}

/**
 * Data do mesmo passo que precisa ser informada antes desta (ex.: a previsão
 * de chegada espera a data de embarque): a chave dela e o código do aviso.
 */
export function datePrerequisite(
  step: string,
  requirementKey: string,
): { key: string; code: string } | null {
  const rule = DATE_ORDER.find(
    (r) =>
      r.first &&
      r.after.step === step &&
      r.after.key === requirementKey &&
      r.before.step === step,
  );
  return rule?.first ? { key: rule.before.key, code: rule.first } : null;
}

/**
 * Confere a ordem das datas. Devolve as datas que voltam a ser pedidas: a
 * chegada enviada antes do embarque (pedido de antes da regra) quando o
 * embarque real vem depois dela — em vez de recusar o embarque e travar o passo.
 */
async function assertDateOrder(
  orderId: string,
  step: string,
  requirementKey: string,
  value: string,
): Promise<Requirement[]> {
  if (!ISO_DAY.test(value) || Number.isNaN(Date.parse(value)))
    throw new WorkflowError("date_invalid");
  const reqs = await getStore().list("requirements", { filter: { orderId } });
  const at = (st: string, key: string) =>
    reqs.filter((r) => r.key === key && stepOfItem(r) === st);
  const valueOf = (st: string, key: string) =>
    at(st, key).find((r) => r.status === "done")?.value ?? null;
  const exists = (st: string, key: string) => at(st, key).length > 0;
  const day = value.slice(0, 10);
  const reopen: Requirement[] = [];
  for (const rule of DATE_ORDER) {
    if (rule.after.step === step && rule.after.key === requirementKey) {
      const before = valueOf(rule.before.step, rule.before.key);
      // Sem a primeira data (que existe neste pedido), não há com o que conferir.
      if (!before && rule.first && exists(rule.before.step, rule.before.key))
        throw new WorkflowError(rule.first);
      if (before && day < before.slice(0, 10))
        throw new WorkflowError(rule.errors[0]);
    }
    if (rule.before.step === step && rule.before.key === requirementKey) {
      const after = valueOf(rule.after.step, rule.after.key);
      if (after && day > after.slice(0, 10)) {
        const [self] = at(step, requirementKey);
        const afterReq = at(rule.after.step, rule.after.key).find(
          (r) => r.status === "done",
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
/* Criação dos itens de um pedido                                            */
/* ------------------------------------------------------------------------ */

/**
 * Cria os itens do pedido, cada um com o passo e o marco dele (fase 5g: sem
 * etapas; `stageId` fica nulo). Pode ser chamada de novo no mesmo pedido: o
 * item que já existe (mesmo passo e mesma chave) é mantido e só o que falta
 * é criado. Assim uma criação interrompida no meio (tempo esgotado) é
 * retomada sem duplicar nada. Os marcos que já nascem liberados avisam quem
 * faz os itens deles (`syncMilestones`), que grava também `orders.status`.
 */
export async function createOrderRequirements(
  order: Order,
  /**
   * Roda depois de criar os itens e antes de os marcos andarem (a rodada de
   * uma programação de compra copia ali os itens já feitos no pai).
   */
  beforeStart?: () => Promise<void>,
  /**
   * Carga do histórico do Sankhya: os marcos são gravados em sombra (sem
   * avisos nem eventos), como a carga sempre fez.
   */
  options: { shadow?: boolean } = {},
) {
  const store = getStore();
  const settings = await getSettings();
  const existingRequirements = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const line = order.lineId
    ? await store.get("product_lines", order.lineId)
    : null;
  // Pedido de compra: as raias são produto a produto, com o checklist da
  // linha de cada produto (docs/PURCHASE_ORDER.md).
  // Reposição ou encomenda (ou rodada de uma): sem Material de arte e Arte.
  const parent =
    isPurchaseFlow(order) && order.parentOrderId
      ? await store.get("orders", order.parentOrderId)
      : null;
  const withoutArt = purchaseWithoutArt(order, parent);
  const items = isPurchaseFlow(order)
    ? await purchaseLaneItems(order.id, withoutArt)
    : undefined;
  const ctx = {
    order,
    line,
    agencyValidationEnabled: settings.agencyValidationEnabled,
    deliveryConfirmationMode: settings.deliveryConfirmationMode,
    inspectionExtendedChecks: settings.inspectionExtendedChecks,
    items,
    withoutArt,
  };
  const fresh = !existingRequirements.length;
  // Identidade do item: passo + chave. O checklist de uma linha pode repetir
  // uma chave de outro passo (ex.: a foto na balança): conta quantos o pedido
  // já tem de cada um e cria só os que faltam.
  const have = new Map<string, number>();
  for (const r of existingRequirements) {
    const id = `${stepOfItem(r) ?? ""}|${r.key}`;
    have.set(id, (have.get(id) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  for (const template of STAGE_TEMPLATES) {
    for (const req of template.requirements(ctx)) {
      const fields = requirementFlowFields(template.key, req.key);
      const id = `${fields.step ?? ""}|${req.key}`;
      const n = (seen.get(id) ?? 0) + 1;
      seen.set(id, n);
      if (n <= (have.get(id) ?? 0)) continue;
      await store.create("requirements", {
        orderId: order.id,
        stageId: null,
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
        ...fields,
      });
    }
  }
  if (fresh)
    await store.update("orders", order.id, {
      currentStageId: null,
      status: "ORDER_CREATED",
    });
  queueMilestoneSync(order.id);
  if (beforeStart && fresh) await beforeStart();
  if (isPurchaseFlow(order) && fresh) {
    // O que o sistema já sabe fica feito na hora (NCM validado, ficha
    // completa, certificação válida pelo período); o resto vira aviso.
    const { refreshPurchaseGates } =
      await import("@/lib/services/purchase-gates");
    await refreshPurchaseGates(order.id);
    const { notifyRegistrationOpen } =
      await import("@/lib/services/purchase-order");
    await notifyRegistrationOpen(order);
  }
  // Fase 5d: os marcos que já nascem liberados (pedido novo, certificação,
  // material de arte...) avisam quem faz os itens deles.
  await syncMilestones(order.id, { shadow: options.shadow });
}

/**
 * Produtos do pedido de compra, com o checklist da linha de cada um. Sem arte
 * (reposição e encomenda), também se a certificação válida do produto cobre
 * o período do pedido (sem certificado novo, sem arte final).
 */
async function purchaseLaneItems(
  orderId: string,
  withoutArt = false,
): Promise<LaneItem[]> {
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
  const covered = new Set<string>();
  if (withoutArt) {
    const { certificationCoversHorizon } =
      await import("@/lib/services/purchase-gates");
    for (const id of productIds)
      if ((await certificationCoversHorizon(id)).covered) covered.add(id);
  }
  return [...items]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const line = product
        ? lines.find((l) => l.id === product.lineId)
        : undefined;
      return {
        id: item.id,
        // Nome real do item; se ele ficou com o nome de exemplo, o do produto
        // hoje; sem nenhum, a tarefa nasce só com o título.
        name: realName(item.name) ?? realName(product?.name) ?? "",
        lineRequirements: line?.requirements ?? null,
        // Mapa do processo (P6): certificado e arte final com o selo só
        // quando a linha do produto exige certificação.
        certificationRequired: !!line?.requiredCertifications?.some((k) =>
          k.trim(),
        ),
        certificationCovered: !!item.productId && covered.has(item.productId),
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
  /** Só o serviço do pedido de amostras marca os itens dele (docs/SAMPLE_ORDER.md). */
  sampleOrder?: boolean;
}

/**
 * Arte, validação, certificado e arte final do pedido de compra: só o login
 * que recebe a tarefa (o designer, quem valida a arte, a certificadora do
 * pedido) ou o administrador (src/lib/services/cert-art-routing.ts).
 */
async function assertLaneAssignee(
  user: User,
  order: Order,
  requirement: Pick<Requirement, "key" | "orderId">,
) {
  if (!isPurchaseFlow(order) || !isRoutedLaneKey(requirement.key)) return;
  const { assertLaneActor } = await import("@/lib/services/cert-art-routing");
  await assertLaneActor(user, order, requirement);
}

/**
 * O item está liberado pelo marco (fase 5d, docs/MILESTONES.md)? Recusa com
 * o mesmo código de antes (`stage_not_active`), que as telas já traduzem.
 */
async function assertReleased(order: Order, requirement: Requirement) {
  const found = await orderRelease(order.id);
  if (!found || !requirementReleased(order, requirement, found.release))
    throw new WorkflowError("stage_not_active");
}

/** Quem pode preencher: Wellmix sempre; o papel do requisito quando vinculado ao parceiro certo. */
export function canSubmitRequirement(
  user: User,
  order: Order,
  requirement: Pick<Requirement, "role"> & Partial<Pick<Requirement, "key">>,
): boolean {
  // Itens conferidos pelo sistema (NCM validado, ficha completa, sinal): só
  // concluem pela tela dona deles, nunca à mão.
  if (isAutoGateKey(requirement.key ?? "")) return false;
  if (isWellmix(user)) {
    // Ações que dependem de permissão (Equipe → Funções e acessos): validar
    // a arte do pedido de compra e assinar o contrato pela Wellmix.
    const key = requirement.key ?? "";
    if (baseKeyOf(key) === LANE_KEYS.artReview)
      return can(user, "art.validate");
    if (key === ORDER_SIGNED_WELLMIX) return can(user, "contract.sign");
    // Aprovações do mapa no fim dos marcos (docs/MILESTONES.md).
    const approval = milestoneApprovalOf(key);
    if (approval) return can(user, approval.action);
    return true;
  }
  // Arte, validação, certificado e arte final do pedido de compra (dono,
  // 14/11/2026): o certificado é da certificadora (OCP) do pedido; a arte e
  // a arte final, da agência do pedido quando o designer é dela. O login
  // exato (o designer, a certificadora) é conferido em assertLaneActor.
  if (isRoutedLaneKey(requirement.key ?? "")) {
    if (!user.partyId) return false;
    const base = baseKeyOf(requirement.key ?? "");
    if (base === LANE_KEYS.certificate)
      return user.role === "ocp" && order.ocpId === user.partyId;
    if (base === LANE_KEYS.art || base === LANE_KEYS.artFinal)
      return user.role === "agency" && order.agencyId === user.partyId;
    return false;
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
  const order = await store.get("orders", requirement.orderId);
  if (!order) throw new WorkflowError("order_not_found");
  // Fase 5g: o item é identificado pelo passo e pela chave.
  const step = stepOfItem(requirement) ?? "";
  // Pedido pausado (canal cinza ou vermelho): só depois de o admin retomar.
  if (order.pausedAt) throw new WorkflowError("order_paused");
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  // Fase 5b: marcos do pedido em sombra, depois da resposta.
  queueMilestoneSync(order.id);
  await assertLaneAssignee(user, order, requirement);
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
  // Pedido de amostras: só pela página dele.
  if (isSampleOrderKey(requirement.key) && !input.sampleOrder)
    throw new WorkflowError("sample_order_required");
  // Pedido de compra: a ordem dentro das raias (validar só a arte enviada;
  // arte final só com a arte validada e o certificado).
  if (isPurchaseFlow(order) && prerequisitesOf(requirement.key).length) {
    const siblings = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    if (blockedBy(requirement.key, siblings).length)
      throw new WorkflowError("lane_prerequisite");
  }
  // Embarque confirmado do pedido de compra: só com o container lacrado no
  // porto e o BL conferido com a invoice (docs/SHIPPING_DOCS.md).
  if (isPurchaseFlow(order) && requirement.key === SHIPPED_KEY) {
    const { shipmentBlockers } = await import("@/lib/services/shipping-docs");
    if ((await shipmentBlockers(order.id)).length)
      throw new WorkflowError("shipping_docs_required");
  }
  // "Enviar para assinatura": só com a arte enviada e o selo da certificadora
  // já aplicado nela (decisão do dono). A recusa diz o que falta.
  if (requirement.key === ORDER_SIGN_SEND) {
    const { signSendBlockers } = await import("@/lib/services/order-signature");
    const [missing] = await signSendBlockers(order.id);
    if (missing) throw new WorkflowError(`sign_send_${missing}_required`);
  }
  // Fase 5d: liberado pelo marco (dependências do mapa concluídas), não
  // mais pela etapa em andamento; o dado do Embarque que ainda pode chegar
  // depois continua aceito.
  await assertReleased(order, requirement);

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
          step,
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
    `${step}: ${withoutPlaceholder(requirement.label)}`,
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
      note: `Refazer: a data informada antes (${String(r.value ?? "").slice(0, 10)}) era anterior à ${withoutPlaceholder(requirement.label).toLowerCase()} (${String(input.value).slice(0, 10)}).`,
    });
    await audit(
      user,
      "requirement.reopen",
      "requirement",
      r.id,
      `${step}: ${withoutPlaceholder(r.label)} antes de ${withoutPlaceholder(requirement.label)}`,
      { status: r.status, value: r.value },
      { status: "pending", value: null },
    );
  }

  // Pedido de compra: o passo seguinte da raia é avisado (validar a arte,
  // fazer a arte final com o certificado).
  if (isPurchaseFlow(order)) {
    const { afterLaneStep } = await import("@/lib/services/purchase-order");
    await afterLaneStep(order, requirement.key, before.status);
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
  if (requirement.key === "erp_number" && input.value) {
    await store.update("orders", order.id, {
      erpNumber: input.value,
      erpSyncStatus: "manual",
    });
  }

  // Regra específica: inspeção compara peso medido com peso declarado na preparação.
  if (requirement.key === "weight_measured") {
    await checkWeightDivergence(user, order, Number(input.value));
  }
  // Inspeção cega: compara o que foi encontrado com o snapshot da compra (quando existe).
  if (isInspectionMeasureKey(requirement.key)) {
    await compareInspection(user, order);
  }

  // Pedido de compra: a arte reenviada volta para a validação da Wellmix.
  if (isPurchaseFlow(order) && baseKeyOf(requirement.key) === "art") {
    const reviewKey = requirement.key.replace(/^art__/, "art_review__");
    const [review] = await store.list("requirements", {
      filter: { orderId: order.id, key: reviewKey },
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
      filter: { orderId: order.id, key: "art_approval" },
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

  // Fase 5g: os marcos andam (e o pedido encerra pelo último marco).
  await syncMilestones(order.id, { user });
  return updated;
}

/**
 * Exclui a foto/arquivo enviado num requisito para mandar outro: o requisito
 * volta a pendente (os marcos recalculam). Só com o marco do item liberado e
 * por quem pode enviar.
 */
export async function clearRequirementDocument(
  user: User,
  requirementId: string,
) {
  const store = getStore();
  const requirement = await store.get("requirements", requirementId);
  if (!requirement) throw new WorkflowError("requirement_not_found");
  const order = await store.get("orders", requirement.orderId);
  if (!order) throw new WorkflowError("order_not_found");
  // Pedido pausado (canal cinza ou vermelho): só depois de o admin retomar.
  if (order.pausedAt) throw new WorkflowError("order_paused");
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  // Fase 5b: marcos do pedido em sombra, depois da resposta.
  queueMilestoneSync(order.id);
  await assertLaneAssignee(user, order, requirement);
  await assertReleased(order, requirement);
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
      filter: { orderId: order.id, key: "art_approval" },
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
    `${stepOfItem(requirement) ?? ""}: ${withoutPlaceholder(requirement.label)} (arquivo excluído)`,
  );
  await syncMilestones(order.id, { user });
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
  const order = await store.get("orders", requirement.orderId);
  if (!order) throw new WorkflowError("order_not_found");
  const step = stepOfItem(requirement) ?? "";
  // Pedido pausado (canal cinza ou vermelho): só depois de o admin retomar.
  if (order.pausedAt) throw new WorkflowError("order_paused");
  if (!canSubmitRequirement(user, order, requirement))
    throw new ForbiddenError();
  // Fase 5b: marcos do pedido em sombra, depois da resposta.
  queueMilestoneSync(order.id);
  await assertLaneAssignee(user, order, requirement);
  // Como no envio: só com o marco liberado (fase 5d). Decisão já tomada só
  // a Wellmix refaz (a aprovação do fornecedor é a prova de que a arte foi
  // aceita).
  await assertReleased(order, requirement);
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
        filter: { orderId: order.id, key: sourceKey },
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
    // A aprovação destrava o marco do item (fase 5e: a trava é do marco).
    const milestone = storedMilestone(milestoneOfItem(requirement));
    if (milestone) await setMilestoneBlock(order.id, milestone, null);
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
      `${step}: ${withoutPlaceholder(requirement.label)}`,
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
      await reopenInspectionMeasures(user, order.id, note ?? null);
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
      `${step}: ${withoutPlaceholder(requirement.label)}`,
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
  await syncMilestones(order.id, { user });
}

/**
 * Reprovação da revisão da inspeção = pedido de nova medição: as medidas e a
 * foto na balança já enviadas voltam a "reprovado" (com formulário para o
 * fornecedor) e o marco da Inspeção destrava. Os valores antigos ficam no item e
 * na auditoria; a comparação usa só o que for reenviado.
 */
async function reopenInspectionMeasures(
  user: User,
  orderId: string,
  note: string | null,
) {
  const store = getStore();
  const requirements = await store.list("requirements", {
    filter: { orderId },
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
  await setMilestoneBlock(orderId, INSPECTION_BLOCK_MILESTONE, null);
  await audit(
    user,
    "inspection.remeasure_requested",
    "order",
    orderId,
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
  measured: number,
) {
  const store = getStore();
  const settings = await getSettings();
  // Com ficha de compra, o peso entra na comparação comprado × inspecionado
  // (compareInspection). Esta regra fica para pedidos antigos, que usam o item
  // "Peso (kg)" da Preparação.
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId: order.id },
    limit: 1,
  });
  if (sheet?.netWeightPcKg) return;
  // O peso declarado na ficha antiga (item "Peso (kg)" do pedido).
  const [declared] = await store.list("requirements", {
    filter: { orderId: order.id, key: "weight" },
  });
  const declaredWeight = declared?.value ? Number(declared.value) : null;
  if (!declaredWeight || declaredWeight <= 0) return;
  const divergence = Math.abs(measured - declaredWeight) / declaredWeight;
  const tolerance = settings.weightTolerancePercent / 100;
  const [review] = await store.list("requirements", {
    filter: { orderId: order.id, key: "inspection_review" },
  });

  if (divergence > tolerance) {
    const reason = `Peso divergente: declarado ${declaredWeight} kg, medido ${measured} kg (${(divergence * 100).toFixed(1)}% > ${settings.weightTolerancePercent}%). REVISÃO NECESSÁRIA.`;
    // Fase 5e: a trava é do marco da Inspeção.
    await setMilestoneBlock(order.id, INSPECTION_BLOCK_MILESTONE, reason);
    if (!review) {
      await store.create("requirements", {
        orderId: order.id,
        stageId: null,
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
        ...requirementFlowFields("INSPECTION", "inspection_review"),
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
    ((review.status === "pending" &&
      (await milestoneBlockOf(order.id, INSPECTION_BLOCK_MILESTONE)) !==
        undefined) ||
      (review.status === "rejected" &&
        !(await otherInspectionReviewsOpen(order.id))))
  ) {
    // Novo peso dentro da tolerância: libera sem exigir revisão.
    await store.update("requirements", review.id, {
      status: "done",
      value: "auto",
      note: "Dentro da tolerância após nova medição.",
    });
    await setMilestoneBlock(order.id, INSPECTION_BLOCK_MILESTONE, null);
    await resolveReviews(user, "order", order.id, {
      rulePrefix: "inspection.weightDeclared",
      note: "Dentro da tolerância após nova medição.",
    });
  }
}

/**
 * Wellmix destrava o marco após uma revisão (ex.: inspeção; fase 5e: a trava
 * é do marco).
 */
export async function unblockMilestone(
  user: User,
  orderId: string,
  key: string,
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const milestone = storedMilestone(key);
  if (!milestone) throw new WorkflowError("stage_not_active");
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new WorkflowError("order_not_found");
  if (order.status === "CANCELLED") throw new WorkflowError("stage_not_active");
  await setMilestoneBlock(orderId, milestone, null);
  await resolveReviews(user, "order", orderId, {
    rulePrefix: "inspection.",
    status: "dismissed",
    note: "Etapa liberada manualmente pela Wellmix.",
  });
  await audit(
    user,
    "milestone.unblock",
    "order",
    orderId,
    `Marco ${milestone} desbloqueado`,
  );
  await syncMilestones(orderId, { user });
}

/* ------------------------------------------------------------------------ */
/* Consultas de apoio                                                        */
/* ------------------------------------------------------------------------ */

export interface OrderProgress {
  order: Order;
  requirements: Requirement[];
}

export async function loadOrderProgress(
  orderId: string,
): Promise<OrderProgress | null> {
  const store = getStore();
  // As leituras dependem só do id: saem juntas (uma rodada de rede).
  const [order, requirements] = await Promise.all([
    store.get("orders", orderId),
    store.list("requirements", { filter: { orderId } }),
  ]);
  if (!order) return null;
  return { order, requirements };
}
