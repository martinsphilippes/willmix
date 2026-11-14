import "server-only";
import { can, holdersOf } from "@/lib/auth/function-access";
import { loadFunctionDefs } from "./team-functions";

import { getStore, type ImportStep, type Order, type User } from "@/lib/db";
import {
  CUSTOMS_CHANNELS,
  type ImportStepKey,
  type Role,
} from "@/lib/db/schema";
import {
  ForbiddenError,
  canViewOrder,
  hasCertifier,
  isAdmin,
  isOrderCertifier,
  isWellmix,
} from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { artRole, isPurchaseFlow } from "@/lib/workflow/stages";
import { baseKeyOf, LANE_KEYS } from "@/lib/purchase-lanes";
import { audit } from "./audit";
import { notify, type NotifyTarget } from "./notifications";
import { isSchemaMissing } from "@/lib/db/errors";
import {
  artMakerRoute,
  artValidatorRoute,
  canValidateArt,
  internalRoute,
  loadRoutingContext,
  notifyTargetOf,
  ocpRoute,
  orderDesigner,
  reaches,
  routeLabel,
  routeOwnerUserId,
  withoutSubmitter,
  type MissingAssignment,
  type Route,
  type RouteVia,
  type RoutingContext,
} from "./cert-art-routing";

/*
 * Embarque e desembaraço (Fase D, docs/IMPORT_FLOW.md): passos do processo de
 * importação, cada um com quem faz (agente de carga, comex, fornecedor,
 * financeiro ou Wellmix), quem valida e quem vê. Sem parceiro designado, a
 * Wellmix faz a parte dele. O financeiro (função da Wellmix) valida e paga o
 * numerário. A Wellmix vê e pode agir em tudo, menos no que é do financeiro.
 *
 * Certificação (Fase F, docs/CERTIFICATION.md) usa o mesmo mecanismo: além de
 * memorial, laudo e registro, o selo de certificação. O pedido já nasce na
 * mão da certificadora (OCP), que envia o selo; o selo vai para quem faz a
 * arte da embalagem (a agência do pedido ou, sem ela, a Wellmix), que envia
 * a arte com o selo aplicado; a Wellmix confere.
 */

export class ImportFlowError extends Error {}

/**
 * Motivo gravado no passo "selo aplicado na arte" quando a certificadora
 * troca o selo: é um marcador, e a tela mostra o texto no idioma de quem lê
 * (certFlow.sealReplaced).
 */
export const SEAL_REPLACED_REASON = "@seal_replaced";

/** Quem age num passo. */
export type StepActor =
  | "logistics"
  | "comex"
  | "ocp"
  | "agency"
  | "supplier"
  | "finance"
  // Comex interno da Wellmix (função "Comex (interno)"): rastreio do container.
  | "comex_internal"
  | "wellmix";
/** Cartão do passo: embarque/desembaraço ou certificação (Fase F). */
export type StepGroup = "import" | "certification" | "origin";
/** O que o passo pede ("file_text": arquivo obrigatório e texto opcional). */
export type StepInput =
  | "text"
  | "file"
  | "text_file"
  | "file_text"
  | "money_file"
  | "channel"
  | "date";

export interface StepTemplate {
  key: ImportStepKey;
  actor: StepActor;
  validator: StepActor | null;
  input: StepInput;
  /** Papéis externos que veem o passo (além da Wellmix). */
  visibleTo: Role[];
  /** Passo que precisa estar concluído antes. */
  after?: ImportStepKey;
  /** Sem valor: embarque e desembaraço. */
  group?: StepGroup;
  /**
   * Selo de certificação: vale para todo pedido, desde que ele nasce (os
   * demais passos da certificação dependem de OCP designado ou de já terem
   * começado, e só viram pendência a partir da Preparação).
   */
  seal?: boolean;
}

export const groupOf = (tpl: StepTemplate): StepGroup => tpl.group ?? "import";

export const IMPORT_STEPS: StepTemplate[] = [
  {
    key: "booking",
    actor: "logistics",
    validator: "wellmix",
    input: "text",
    visibleTo: ["logistics", "comex", "supplier"],
  },
  {
    key: "draft_bl",
    actor: "logistics",
    validator: "comex",
    input: "file",
    visibleTo: ["logistics", "comex", "supplier"],
    after: "booking",
  },
  {
    key: "invoice_packing",
    actor: "comex",
    validator: "supplier",
    input: "file",
    visibleTo: ["comex", "supplier", "logistics"],
  },
  {
    key: "invoice_signed",
    actor: "supplier",
    validator: "comex",
    input: "file",
    visibleTo: ["comex", "supplier", "logistics"],
    after: "invoice_packing",
  },
  {
    key: "bl",
    actor: "logistics",
    validator: "comex",
    input: "text_file",
    visibleTo: ["logistics", "comex", "supplier", "broker"],
    after: "draft_bl",
  },
  {
    key: "cargo_presence",
    actor: "comex",
    validator: null,
    input: "date",
    visibleTo: ["comex", "logistics"],
    after: "bl",
  },
  {
    key: "numerario",
    actor: "comex",
    validator: "finance",
    input: "money_file",
    visibleTo: ["comex"],
  },
  {
    key: "numerario_paid",
    actor: "finance",
    validator: null,
    input: "file",
    visibleTo: ["comex"],
    after: "numerario",
  },
  {
    key: "channel",
    actor: "comex",
    validator: null,
    input: "channel",
    visibleTo: ["comex", "logistics"],
  },
  {
    key: "di",
    actor: "comex",
    validator: null,
    input: "text_file",
    visibleTo: ["comex"],
  },
  {
    key: "ce_mercante",
    actor: "comex",
    validator: null,
    input: "text",
    visibleTo: ["comex", "logistics"],
  },
  {
    key: "ci",
    actor: "comex",
    validator: null,
    input: "file",
    visibleTo: ["comex"],
  },
  {
    key: "danfe",
    actor: "wellmix",
    validator: null,
    input: "text_file",
    visibleTo: ["comex", "logistics"],
    after: "di",
  },
  /*
   * Container na origem (mapa R19, R20, R7, R25, R26; docs/ORIGIN_CONTAINER.md):
   * depois do booking, o fornecedor (ou a trading, que entra como fornecedor)
   * registra o container vazio na fábrica, as fotos e vídeos dele, o
   * carregamento com o check de carga, o lacre com o número do container e a
   * volta ao porto. O Comex interno acompanha o rastreio todo dia.
   */
  {
    key: "container_at_factory",
    actor: "supplier",
    validator: null,
    input: "date",
    visibleTo: ["supplier", "logistics", "comex"],
    after: "booking",
    group: "origin",
  },
  {
    key: "container_empty",
    actor: "supplier",
    validator: null,
    input: "file",
    visibleTo: ["supplier", "logistics"],
    after: "container_at_factory",
    group: "origin",
  },
  {
    key: "container_loaded",
    actor: "supplier",
    validator: "wellmix",
    input: "file_text",
    visibleTo: ["supplier", "logistics", "comex"],
    after: "container_empty",
    group: "origin",
  },
  {
    key: "container_sealed",
    actor: "supplier",
    validator: null,
    input: "text_file",
    visibleTo: ["supplier", "logistics", "comex"],
    after: "container_loaded",
    group: "origin",
  },
  {
    key: "container_at_port",
    actor: "supplier",
    validator: null,
    input: "date",
    visibleTo: ["supplier", "logistics", "comex"],
    after: "container_sealed",
    group: "origin",
  },
  {
    key: "container_tracking",
    actor: "comex_internal",
    validator: null,
    input: "text",
    visibleTo: [],
    after: "container_at_factory",
    group: "origin",
  },
  // Certificação (Fase F, docs/CERTIFICATION.md): com o OCP do pedido.
  {
    key: "cert_memorial",
    actor: "wellmix",
    validator: "ocp",
    input: "file",
    visibleTo: ["ocp"],
    group: "certification",
  },
  {
    key: "cert_lab",
    actor: "ocp",
    validator: null,
    input: "text_file",
    visibleTo: ["ocp"],
    after: "cert_memorial",
    group: "certification",
  },
  {
    key: "cert_registration",
    actor: "ocp",
    validator: "wellmix",
    input: "text_file",
    visibleTo: ["ocp", "comex"],
    after: "cert_lab",
    group: "certification",
  },
  // Selo de certificação: a certificadora envia o selo do pedido desde que
  // ele nasce; quem faz a arte (agência ou Wellmix) aplica o selo na arte da
  // embalagem, que corre em paralelo, e a Wellmix confere.
  {
    key: "cert_seal",
    actor: "ocp",
    validator: null,
    input: "file_text",
    visibleTo: ["ocp", "agency"],
    group: "certification",
    seal: true,
  },
  {
    key: "cert_seal_art",
    actor: "agency",
    validator: "wellmix",
    input: "file",
    visibleTo: ["agency", "ocp"],
    after: "cert_seal",
    group: "certification",
    seal: true,
  },
];

export const stepTemplate = (key: ImportStepKey) =>
  IMPORT_STEPS.find((s) => s.key === key)!;

/*
 * Pedido de compra: packing list, invoice e BL saem dos documentos do
 * embarque (docs/SHIPPING_DOCS.md: fornecedor, trading e marítima, conferidos
 * pelo sistema). Os passos antigos do despachante e do agente não aparecem;
 * o "BL" fica, concluído sozinho quando o BL é conferido.
 */
const PURCHASE_HIDDEN_STEPS: readonly ImportStepKey[] = [
  "draft_bl",
  "invoice_packing",
  "invoice_signed",
];

/** O passo vale para o pedido (container na origem só no de compra; papéis antigos fora dele). */
export function stepApplies(order: Order, key: ImportStepKey): boolean {
  const purchase = isPurchaseFlow(order);
  if (groupOf(stepTemplate(key)) === "origin") return purchase;
  return !(purchase && PURCHASE_HIDDEN_STEPS.includes(key));
}

const PARTNER_FIELD = {
  logistics: "logisticsId",
  comex: "comexId",
  ocp: "ocpId",
  agency: "agencyId",
  supplier: "supplierId",
} as const;

/** Passos da certificação enviados no quadro em destaque do alto do cartão. */
export const CERT_FEATURED_STEPS: ImportStepKey[] = [
  "cert_seal",
  "cert_memorial",
];

/**
 * Link direto para a tarefa no pedido: o quadro em destaque (selo e memorial
 * a enviar) ou a linha do passo no cartão Certificação; embarque e
 * desembaraço, o cartão.
 */
export function stepLink(
  orderId: string,
  tpl: StepTemplate,
  action: "do" | "validate" = "validate",
): string {
  if (groupOf(tpl) === "origin")
    return `/app/orders/${orderId}#container-origin`;
  if (groupOf(tpl) !== "certification")
    return `/app/orders/${orderId}#import-flow`;
  if (action === "do" && CERT_FEATURED_STEPS.includes(tpl.key))
    return `/app/orders/${orderId}#certification-featured`;
  return `/app/orders/${orderId}#certification-step-${tpl.key}`;
}

/** Nome do cartão nos registros da auditoria. */
const auditLabel = (tpl: StepTemplate) =>
  groupOf(tpl) === "certification"
    ? "Certificação"
    : groupOf(tpl) === "origin"
      ? "Container na origem"
      : "Embarque/desembaraço";

/** Comex interno: permissão "Rastrear o container" (padrão: função Comex interno) ou admin. */
export const isComexInternal = (user: User) =>
  isAdmin(user) || (isWellmix(user) && can(user, "container.tracking"));

/** Financeiro do pedido: permissão "Numerário" (padrão: função financeiro) ou admin. */
export const isFinance = (user: User) =>
  isAdmin(user) || (isWellmix(user) && can(user, "numerario.manage"));

/** O usuário é quem age (ou valida) por esse papel neste pedido? */
export function actsAs(user: User, order: Order, actor: StepActor): boolean {
  if (actor === "finance") return isFinance(user);
  if (actor === "comex_internal") return isComexInternal(user);
  if (isWellmix(user)) return true;
  if (actor === "wellmix") return false;
  // Certificação: o despachante do pedido (ou a certificadora designada).
  if (actor === "ocp") return isOrderCertifier(user, order);
  const field = PARTNER_FIELD[actor];
  return user.role === actor && !!user.partyId && order[field] === user.partyId;
}

/** Quem certifica pelo pedido: o despachante ou a certificadora (OCP) designada. */
const isOrderOcp = (user: User, order: Order) => isOrderCertifier(user, order);

/**
 * O parceiro do papel está designado no pedido? Certificação: o despachante
 * ou a certificadora (a certificação é do despachante, dono, 13/11/2026).
 */
const partnerAssigned = (order: Order, actor: keyof typeof PARTNER_FIELD) =>
  actor === "ocp" ? hasCertifier(order) : !!order[PARTNER_FIELD[actor]];

/**
 * Pode enviar o passo: quem age por ele. O passo da agência só é dela quando
 * é ela quem faz a arte; com a arte feita pela Wellmix nas configurações, a
 * agência do pedido só acompanha (a mesma regra do item "Arte" da etapa).
 */
export async function canSubmitStep(
  user: User,
  order: Order,
  key: ImportStepKey,
): Promise<boolean> {
  const tpl = stepTemplate(key);
  if (!stepApplies(order, key)) return false;
  // Pedido de compra: o BL vem dos documentos do embarque, conferido.
  if (key === "bl" && isPurchaseFlow(order)) return false;
  // Memorial: a certificadora do pedido também anexa (dono, 10/11/2026).
  if (key === "cert_memorial" && isOrderOcp(user, order)) return true;
  // Arte com o selo: o designer do pedido (login da agência escolhido em
  // Artes → Designer do pedido) envia, mesmo com a arte feita pela Wellmix.
  if (tpl.actor === "agency" && (await isOrderDesigner(user, order)))
    return true;
  if (!actsAs(user, order, tpl.actor)) return false;
  if (tpl.actor === "agency" && !isWellmix(user)) return agencyDoesArt(order);
  return true;
}

/** O login é o designer do pedido (ainda válido: Wellmix ou da agência do pedido). */
async function isOrderDesigner(user: User, order: Order): Promise<boolean> {
  if (!order.designerUserId || order.designerUserId !== user.id) return false;
  return orderDesigner(order, await loadRoutingContext())?.id === user.id;
}

/** Vê o passo: Wellmix sempre; o parceiro, se o passo é visível ao papel dele. */
export function canSeeStep(user: User, order: Order, key: ImportStepKey) {
  if (isWellmix(user)) return true;
  if (!canViewOrder(user, order)) return false;
  const visibleTo = stepTemplate(key).visibleTo;
  // O despachante certifica: vê o que a certificadora vê.
  if (user.role === "broker" && visibleTo.includes("ocp")) return true;
  return visibleTo.includes(user.role);
}

/** O card aparece para o usuário (vê algum passo). */
export function canSeeImportFlow(user: User, order: Order) {
  return IMPORT_STEPS.some((s) => canSeeStep(user, order, s.key));
}

async function stepsOf(orderId: string): Promise<ImportStep[]> {
  try {
    return await getStore().list("import_steps", { filter: { orderId } });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

const isDone = (step: ImportStep | undefined) => {
  if (!step) return false;
  const tpl = stepTemplate(step.key);
  return tpl.validator
    ? step.status === "validated"
    : step.status === "submitted" || step.status === "validated";
};

/** Passo concluído: validado (se tem quem valide) ou enviado. Control Tower usa. */
export const importStepDone = isDone;

/** O passo já pode ser feito (o anterior concluído)? */
function ready(key: ImportStepKey, steps: ImportStep[]) {
  const after = stepTemplate(key).after;
  return !after || isDone(steps.find((s) => s.key === after));
}

async function loadOrder(orderId: string) {
  const order = await getStore().get("orders", orderId);
  if (!order) throw new ImportFlowError("order_not_found");
  if (order.status === "CANCELLED" || order.status === "CLOSED")
    throw new ImportFlowError("order_cancelled");
  return order;
}

/**
 * O passo da agência é de quem faz a arte da embalagem: a agência do pedido
 * ou, sem agência (ou com a arte feita pela Wellmix nas configurações), a
 * Wellmix. É a mesma regra do item "Arte" da etapa Arte e embalagem.
 */
async function agencyDoesArt(order: Order): Promise<boolean> {
  const settings = await getSettings();
  return artRole(order, settings.agencyValidationEnabled) === "agency";
}

/** Destino dos avisos para um papel do passo neste pedido. */
async function targetFor(
  order: Order,
  actor: StepActor,
): Promise<NotifyTarget> {
  // Quem faz a arte (o designer do pedido, a agência quando é ela quem faz a
  // arte ou a Wellmix) e quem certifica (o despachante): o mesmo destino das
  // pendências.
  if (actor === "agency")
    return notifyTargetOf(artMakerRoute(order, await loadRoutingContext()));
  if (actor === "ocp")
    return notifyTargetOf(ocpRoute(order, await loadRoutingContext()));
  if (actor === "finance" || actor === "comex_internal") {
    const team = await getStore().list("users", {
      filter: { role: ["admin", "operator"], active: true },
    });
    const finance = holdersOf(
      team,
      actor === "finance" ? "numerario.manage" : "container.tracking",
      await loadFunctionDefs(),
    );
    return {
      userIds: (finance.length ? finance : team.filter(isAdmin)).map(
        (u) => u.id,
      ),
    };
  }
  if (actor !== "wellmix") {
    const partyId = order[PARTNER_FIELD[actor]];
    if (partyId) return { role: actor, partyId };
  }
  // Wellmix (ou o parceiro que não foi designado): o analista do pedido ou a equipe.
  return order.ownerUserId
    ? { userIds: [order.ownerUserId] }
    : { role: ["admin", "operator"] };
}

/**
 * Certificação: quem faz o passo (docs/CERTIFICATION.md, "Quem recebe cada
 * tarefa"). Selo, laudo e registro: a certificadora; arte com o selo: quem
 * faz a arte; memorial: o responsável interno da Wellmix.
 */
function certDoRoute(
  order: Order,
  tpl: StepTemplate,
  ctx: RoutingContext,
): Route {
  if (tpl.actor === "ocp") return ocpRoute(order, ctx);
  if (tpl.actor === "agency") return artMakerRoute(order, ctx);
  return internalRoute(order, ctx);
}

/**
 * Certificação: quem valida o passo enviado. A arte com o selo, quem pode
 * validar arte (o analista, se pode); o memorial, a certificadora (sem ela,
 * a Wellmix valida no lugar); o registro, o responsável interno. Quem enviou
 * nunca recebe a validação do próprio envio.
 */
function certValidateRoute(
  order: Order,
  tpl: StepTemplate,
  ctx: RoutingContext,
  submitterId: string | null,
): Route | null {
  if (!tpl.validator) return null;
  if (tpl.key === "cert_seal_art")
    return artValidatorRoute(order, ctx, submitterId);
  const route =
    tpl.validator === "ocp" ? ocpRoute(order, ctx) : internalRoute(order, ctx);
  return withoutSubmitter(route, ctx, submitterId);
}

export interface SubmitInput {
  value?: string | null;
  amount?: number | null;
  currency?: string | null;
  documentId?: string | null;
}

/** Quem age envia o passo (número, data, canal, valor e/ou arquivo). */
export async function submitStep(
  user: User,
  orderId: string,
  key: ImportStepKey,
  input: SubmitInput,
) {
  const order = await loadOrder(orderId);
  const tpl = stepTemplate(key);
  if (!(await canSubmitStep(user, order, key))) throw new ForbiddenError();
  const store = getStore();
  const steps = await stepsOf(orderId);
  if (!ready(key, steps)) throw new ImportFlowError("previous_step");
  const current = steps.find((s) => s.key === key);
  if (current && tpl.validator && current.status === "validated")
    throw new ImportFlowError("already_validated");
  // O que cada tipo de passo exige.
  const value = input.value?.trim() || null;
  const needsValue = ["text", "text_file", "channel", "date"].includes(
    tpl.input,
  );
  const needsFile = ["file", "text_file", "file_text", "money_file"].includes(
    tpl.input,
  );
  if (needsValue && !value) throw new ImportFlowError("value_required");
  if (
    tpl.input === "channel" &&
    !(CUSTOMS_CHANNELS as readonly string[]).includes(value ?? "")
  )
    throw new ImportFlowError("invalid_channel");
  if (tpl.input === "money_file" && !(input.amount && input.amount > 0))
    throw new ImportFlowError("amount_required");
  const documentId = input.documentId ?? current?.documentId ?? null;
  if (needsFile && !documentId) throw new ImportFlowError("file_required");
  if (documentId) {
    const doc = await store.get("documents", documentId);
    if (!doc || doc.orderId !== orderId)
      throw new ImportFlowError("file_required");
  }
  const now = new Date().toISOString();
  const data = {
    status: "submitted" as const,
    value,
    amount: tpl.input === "money_file" ? (input.amount ?? null) : null,
    currency:
      tpl.input === "money_file" ? (input.currency || "BRL").slice(0, 3) : null,
    documentId,
    submittedByUserId: user.id,
    submittedAt: now,
    validatedByUserId: null,
    validatedAt: null,
    rejectReason: null,
    // Memorial anexado pela própria certificadora (quem o validaria): já vale.
    ...(key === "cert_memorial" && isOrderOcp(user, order)
      ? {
          status: "validated" as const,
          validatedByUserId: user.id,
          validatedAt: now,
        }
      : {}),
  };
  let step: ImportStep;
  try {
    step = current
      ? await store.update("import_steps", current.id, data)
      : await store.create("import_steps", { orderId, key, ...data });
  } catch (error) {
    // Passo novo cujo valor ainda não foi publicado no Appwrite (enum da
    // coluna "key", gravada só na criação da linha): a tela explica, em vez
    // de "erro inesperado".
    if (!current && isEnumPending(error))
      throw new ImportFlowError("schema_pending");
    throw error;
  }
  await audit(
    user,
    "import.step_submitted",
    "order",
    orderId,
    `${auditLabel(tpl)}: ${key} enviado${value ? ` (${value})` : ""}${data.amount ? ` · ${data.currency} ${data.amount}` : ""}`,
  );
  const link = stepLink(orderId, tpl);
  if (tpl.validator)
    await notify(await validatorTarget(order, tpl.validator, user, key), {
      link,
      kind: "action",
      text: (t) => ({
        subject: t("importFlow.notify.validate.subject", {
          n: String(order.number),
          step: t(`importFlow.step.${key}`),
        }),
        body: t("importFlow.notify.validate.body"),
      }),
    });
  // Canal vermelho/cinza: alerta à Wellmix (conferência física/documental demorada).
  if (key === "channel" && (value === "red" || value === "grey"))
    await notify(await targetFor(order, "wellmix"), {
      link,
      kind: "alert",
      actor: null,
      text: (t) => ({
        subject: t("importFlow.notify.channel.subject", {
          n: String(order.number),
          channel: t(`importFlow.channel.${value}`),
        }),
        body: t("importFlow.notify.channel.body"),
      }),
    });
  // Selo de certificação: vai para quem faz a arte (agência ou Wellmix).
  if (key === "cert_seal")
    await handOverSeal(user, order, steps, current ?? null, step);
  return step;
}

/**
 * Quem valida recebe o aviso. Quando a própria Wellmix enviou o passo que a
 * Wellmix valida e o aviso iria só para quem enviou (o analista do pedido),
 * ele vai para o resto da equipe: quem enviou não valida o próprio passo.
 */
async function validatorTarget(
  order: Order,
  validator: StepActor,
  submitter: User,
  key: ImportStepKey,
): Promise<NotifyTarget> {
  // Certificação: o mesmo destino da pendência de validar.
  const tpl = stepTemplate(key);
  if (groupOf(tpl) === "certification") {
    const route = certValidateRoute(
      order,
      tpl,
      await loadRoutingContext(),
      submitter.id,
    );
    if (route) return notifyTargetOf(route);
  }
  const target = await targetFor(order, validator);
  if (validator !== "wellmix" || !isWellmix(submitter)) return target;
  if (!target.userIds?.length) return target;
  if (target.userIds.some((id) => id !== submitter.id)) return target;
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const others = team.filter((u) => u.id !== submitter.id);
  return others.length ? { userIds: others.map((u) => u.id) } : target;
}

/** Valor novo de enum ainda não publicado no Appwrite (esquema desatualizado). */
function isEnumPending(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    ["document_invalid_structure", "row_invalid_structure"].includes(
      String((error as { type?: unknown }).type ?? ""),
    ) ||
    /invalid (document|row) structure|not a valid enum|invalid.*enum/i.test(
      error.message,
    )
  );
}

/**
 * O selo chegou (ou foi trocado): quem faz a arte é avisado. Selo trocado com
 * a arte já enviada ou validada: o passo da arte reabre, porque a arte leva o
 * selo antigo. Reenviar sem mudar nada não avisa nem reabre.
 */
async function handOverSeal(
  user: User,
  order: Order,
  steps: ImportStep[],
  before: ImportStep | null,
  seal: ImportStep,
) {
  const replaced = !!before && before.status !== "pending";
  if (
    replaced &&
    before.documentId === seal.documentId &&
    (before.value ?? null) === (seal.value ?? null)
  )
    return;
  const link = stepLink(order.id, stepTemplate("cert_seal_art"), "do");
  const art = steps.find((s) => s.key === "cert_seal_art");
  if (
    replaced &&
    (art?.status === "submitted" || art?.status === "validated")
  ) {
    await getStore().update("import_steps", art.id, {
      status: "rejected",
      validatedByUserId: null,
      validatedAt: null,
      // A arte antiga leva o selo antigo: sai do passo, para o reenvio pedir
      // um arquivo novo (o antigo continua nos documentos do pedido).
      documentId: null,
      rejectReason: SEAL_REPLACED_REASON,
    });
    await audit(
      user,
      "import.step_rejected",
      "order",
      order.id,
      "Certificação: cert_seal_art reaberto (a certificadora trocou o selo)",
    );
  }
  await notify(await targetFor(order, "agency"), {
    link,
    kind: "action",
    text: (t) => ({
      subject: t(
        replaced
          ? "certFlow.notify.sealChanged.subject"
          : "certFlow.notify.sealReady.subject",
        { n: String(order.number) },
      ),
      body: t(
        replaced
          ? "certFlow.notify.sealChanged.body"
          : "certFlow.notify.sealReady.body",
      ),
    }),
  });
}

/**
 * Pedido novo (ou OCP designado depois): avisa a certificadora de que há um
 * selo a emitir; a pendência dela nasce junto. Todo pedido precisa de selo:
 * sem certificadora no pedido (nenhuma ou mais de uma ativa; com uma só ela
 * é designada sozinha), a Wellmix é avisada para designar, e a pendência
 * fica com ela.
 */
export async function notifySealRequested(order: Order): Promise<void> {
  if (order.status === "CANCELLED" || order.status === "CLOSED") return;
  // Certificação: o despachante do pedido (dono, 13/11/2026).
  if (order.brokerId) {
    await notify(
      { role: "broker", partyId: order.brokerId },
      {
        link: stepLink(order.id, stepTemplate("cert_seal"), "do"),
        kind: "action",
        text: (t) => ({
          subject: t("certFlow.notify.sealRequested.subject", {
            n: String(order.number),
          }),
          body: t("certFlow.notify.sealRequested.body"),
        }),
      },
    );
    return;
  }
  await notify(await targetFor(order, "wellmix"), {
    link: `/app/orders/${order.id}#order-partners`,
    kind: "action",
    text: (t) => ({
      subject: t("certFlow.notify.noOcp.subject", { n: String(order.number) }),
      body: t("certFlow.notify.noOcp.body"),
    }),
  });
}

/**
 * Parceiro trocado no pedido já criado (em "Parceiros" ou pelo dono do
 * briefing de embalagem). OCP novo: é avisado do selo ainda não enviado.
 * Agência nova (ou retirada): quem passa a fazer a arte é avisado do selo
 * que já chegou e ainda não foi aplicado.
 */
export async function notifySealPartner(
  order: Order,
  field: "ocpId" | "brokerId" | "agencyId",
  /** Quem estava no campo antes da troca (para não avisar de novo quem já fazia a arte). */
  previousPartyId?: string | null,
): Promise<void> {
  if (order.status === "CANCELLED" || order.status === "CLOSED") return;
  const steps = await stepsOf(order.id);
  const sealDone = isDone(steps.find((s) => s.key === "cert_seal"));
  // Quem certifica mudou (certificadora ou despachante): o selo a emitir.
  if (field === "ocpId" || field === "brokerId") {
    if (hasCertifier(order) && !sealDone) await notifySealRequested(order);
    return;
  }
  if (previousPartyId !== undefined) {
    // Quem faz a arte não mudou (ex.: arte feita pela Wellmix nas
    // configurações, ou o designer do pedido continua o mesmo, e só a
    // agência do pedido trocou): nada a avisar.
    const ctx = await loadRoutingContext();
    const maker = (agencyId: string | null) => {
      const route = artMakerRoute({ ...order, agencyId }, ctx);
      return JSON.stringify([
        route.party?.partyId ?? null,
        route.userIds ?? [],
      ]);
    };
    if (maker(previousPartyId) === maker(order.agencyId ?? null)) return;
  }
  const art = steps.find((s) => s.key === "cert_seal_art");
  const artOpen = !art || art.status === "pending" || art.status === "rejected";
  if (!sealDone || !artOpen) return;
  await notify(await targetFor(order, "agency"), {
    link: stepLink(order.id, stepTemplate("cert_seal_art"), "do"),
    kind: "action",
    text: (t) => ({
      subject: t("certFlow.notify.sealReady.subject", {
        n: String(order.number),
      }),
      body: t("certFlow.notify.sealReady.body"),
    }),
  });
}

/** Selo de certificação visto por quem faz a arte (tela do briefing). */
export type SealState = "pending" | "ready" | "rejected" | "sent" | "done";

/**
 * Situação do selo para o usuário: aguardando a certificadora, disponível
 * para aplicar, arte com o selo recusada (refazer), enviada ou conferida.
 * Todo pedido tem selo;
 * nulo só para pedido cancelado ou encerrado, ou quando o usuário não vê o
 * passo (ou não é quem aplica o selo).
 */
export async function sealStateFor(
  user: User,
  order: Order,
): Promise<SealState | null> {
  // Pedido cancelado ou encerrado: os passos não aceitam mais envio.
  if (order.status === "CANCELLED" || order.status === "CLOSED") return null;
  if (!canSeeStep(user, order, "cert_seal")) return null;
  // Agência do pedido com a arte feita pela Wellmix: não é ela quem aplica
  // (a não ser o login dela escolhido como designer do pedido).
  if (
    !isWellmix(user) &&
    !(await agencyDoesArt(order)) &&
    !(await isOrderDesigner(user, order))
  )
    return null;
  const steps = await stepsOf(order.id);
  if (!isDone(steps.find((s) => s.key === "cert_seal"))) return "pending";
  const art = steps.find((s) => s.key === "cert_seal_art");
  if (isDone(art)) return "done";
  if (art?.status === "submitted") return "sent";
  // Recusada pela Wellmix ou reaberta por selo trocado: refazer.
  return art?.status === "rejected" ? "rejected" : "ready";
}

/** Arquivo atual do selo de certificação do pedido (para o zip das artes). */
export async function sealDocumentId(orderId: string): Promise<string | null> {
  const seal = (await stepsOf(orderId)).find((s) => s.key === "cert_seal");
  return seal && isDone(seal) ? seal.documentId : null;
}

/** Quem valida aprova ou recusa (com motivo; volta para quem fez). */
export async function validateStep(
  user: User,
  orderId: string,
  key: ImportStepKey,
  decision: "validated" | "rejected",
  reason: string | null,
) {
  const order = await loadOrder(orderId);
  const tpl = stepTemplate(key);
  if (!tpl.validator) throw new ImportFlowError("no_validation");
  if (!actsAs(user, order, tpl.validator)) throw new ForbiddenError();
  // Arte com o selo: só quem pode validar arte (ação "Validar a arte" em
  // Equipe → Funções e acessos; o administrador sempre), como a validação da
  // arte do pedido de compra.
  if (key === "cert_seal_art" && !can(user, "art.validate"))
    throw new ForbiddenError();
  const step = (await stepsOf(orderId)).find((s) => s.key === key);
  if (!step || step.status !== "submitted")
    throw new ImportFlowError("invalid_status");
  if (decision === "rejected" && !reason?.trim())
    throw new ImportFlowError("reason_required");
  // Quem enviou não valida o próprio passo (exceto admin).
  if (step.submittedByUserId === user.id && !isAdmin(user))
    throw new ImportFlowError("own_step");
  const updated = await getStore().update("import_steps", step.id, {
    status: decision,
    validatedByUserId: user.id,
    validatedAt: new Date().toISOString(),
    rejectReason: decision === "rejected" ? reason!.trim() : null,
  });
  await audit(
    user,
    decision === "validated" ? "import.step_validated" : "import.step_rejected",
    "order",
    orderId,
    `${auditLabel(tpl)}: ${key} ${decision === "validated" ? "validado" : `recusado (${reason})`}`,
  );
  if (decision === "rejected")
    await notify(await targetFor(order, tpl.actor), {
      link: stepLink(orderId, tpl, "do"),
      kind: "action",
      text: (t) => ({
        subject: t("importFlow.notify.rejected.subject", {
          n: String(order.number),
          step: t(`importFlow.step.${key}`),
        }),
        body: t("importFlow.notify.rejected.body", { reason: reason ?? "—" }),
      }),
    });
  else {
    // Próximo passo que dependia deste: avisa quem faz.
    const next = IMPORT_STEPS.find((s) => s.after === key);
    if (next)
      await notify(await targetFor(order, next.actor), {
        link: stepLink(orderId, next, "do"),
        kind: "action",
        text: (t) => ({
          subject: t("importFlow.notify.next.subject", {
            n: String(order.number),
            step: t(`importFlow.step.${next.key}`),
          }),
          body: t("importFlow.notify.next.body"),
        }),
      });
  }
  return updated;
}

export interface StepView {
  template: StepTemplate;
  step: ImportStep | null;
  ready: boolean;
  done: boolean;
  canSubmit: boolean;
  canValidate: boolean;
  /**
   * Certificação, visão interna da Wellmix: com quem está o passo aberto
   * agora (fazer ou validar) e o que falta designar. Nulo nos concluídos e
   * para quem é de fora.
   */
  assignee?: StepAssignee | null;
}

export interface StepAssignee {
  /** Validar o envio (senão, fazer o passo). */
  validating: boolean;
  via: RouteVia;
  /** Nome de quem recebe (empresa parceira ou logins); nulo: a equipe. */
  label: string | null;
  /** O que falta designar para a tarefa ter dono certo. */
  missing: MissingAssignment | null;
}

/** Passos que o usuário vê, com o que ele pode fazer em cada um. */
export async function importFlowView(
  user: User,
  order: Order,
  group: StepGroup = "import",
): Promise<StepView[]> {
  const steps = await stepsOf(order.id);
  // Pedido encerrado: só leitura.
  const open = order.status !== "CLOSED" && order.status !== "CANCELLED";
  const shown = IMPORT_STEPS.filter(
    (tpl) =>
      groupOf(tpl) === group &&
      // Container na origem só no pedido de compra; nele, sem os papéis antigos.
      stepApplies(order, tpl.key) &&
      canSeeStep(user, order, tpl.key),
  );
  // Passo da agência: só de quem faz a arte (a Wellmix sempre pode agir;
  // o designer do pedido também, mesmo login da agência).
  const agencyActs =
    isWellmix(user) ||
    !shown.some((tpl) => tpl.actor === "agency") ||
    (await agencyDoesArt(order)) ||
    (await isOrderDesigner(user, order));
  // Visão interna da Wellmix: com quem está cada passo aberto, pela mesma
  // regra das pendências (só onde há pendência).
  const ctx =
    group === "certification" && isWellmix(user) && open
      ? await loadRoutingContext()
      : null;
  const gate = ctx
    ? certGate(
        order,
        steps,
        isPurchaseFlow(order) && (await purchaseNeedsCertification(order)),
      )
    : null;
  const assigneeOf = async (
    tpl: StepTemplate,
    step: ImportStep | null,
  ): Promise<StepAssignee | null> => {
    if (!ctx || !gate) return null;
    const task = certTask(order, tpl, step ?? undefined, steps, ctx, gate);
    if (!task) return null;
    return {
      validating: task.kind === "cert_validate",
      via: task.route.via,
      label: await routeLabel(task.route, ctx),
      missing: task.route.missing ?? null,
    };
  };
  const artValidator = can(user, "art.validate");
  return Promise.all(
    shown.map(async (tpl) => {
      const step = steps.find((s) => s.key === tpl.key) ?? null;
      // Pedido de compra: o BL vem conferido dos documentos do embarque (sem
      // o draft do agente antes dele, e ninguém envia por aqui).
      const purchaseBl = tpl.key === "bl" && isPurchaseFlow(order);
      const isReady = purchaseBl || ready(tpl.key, steps);
      const done = isDone(step ?? undefined);
      return {
        template: purchaseBl ? { ...tpl, after: undefined } : tpl,
        step,
        ready: isReady,
        done,
        canSubmit:
          open &&
          !purchaseBl &&
          isReady &&
          !(tpl.validator && step?.status === "validated") &&
          (actsAs(user, order, tpl.actor) ||
            // Memorial: a certificadora do pedido também anexa.
            (tpl.key === "cert_memorial" && isOrderOcp(user, order))) &&
          (tpl.actor !== "agency" || agencyActs),
        canValidate:
          open &&
          !!tpl.validator &&
          step?.status === "submitted" &&
          actsAs(user, order, tpl.validator) &&
          // Arte com o selo: só quem pode validar arte.
          (tpl.key !== "cert_seal_art" || artValidator) &&
          (step.submittedByUserId !== user.id || isAdmin(user)),
        assignee: await assigneeOf(tpl, step),
      };
    }),
  );
}

/** Acesso ao arquivo de um passo: quem vê o passo. */
export async function canAccessStepDocument(
  user: User,
  documentId: string,
): Promise<boolean> {
  const store = getStore();
  let rows: ImportStep[] = [];
  try {
    rows = await store.list("import_steps", { filter: { documentId } });
  } catch (error) {
    if (isSchemaMissing(error)) return false;
    throw error;
  }
  for (const row of rows) {
    const order = await store.get("orders", row.orderId);
    if (order && canSeeStep(user, order, row.key)) return true;
  }
  return false;
}

export interface ImportTaskDraft {
  /** Embarque/desembaraço (import_*) ou certificação (cert_*): fazer ou validar. */
  kind: "import_step" | "import_validate" | "cert_step" | "cert_validate";
  order: Order;
  key: ImportStepKey;
  /** Desde quando o passo está com quem o vê (envio a validar; passo anterior concluído). */
  sinceAt?: string | null;
  /** Certificação: link direto para a tarefa no pedido. */
  link?: string;
  /** Certificação: o que falta designar (sinalizado na pendência e no cartão). */
  missing?: MissingAssignment | null;
  /** Certificação: dono da pendência no painel de SLA (quem a recebeu). */
  ownerUserId?: string | null;
}

export interface ImportTasksOptions {
  /**
   * Painel de SLA: as pendências da certificação que estão com qualquer
   * login da Wellmix (não só com o usuário), para acompanhar a equipe.
   */
  team?: boolean;
}

/**
 * Pedidos de compra cujos produtos exigem certificação: os que têm o item
 * "Certificado" na Preparação (mapa do processo, P6). Sem exigência, o selo,
 * o memorial e a arte com o selo não viram pendência.
 */
async function purchaseOrdersNeedingCert(
  orders: Pick<Order, "id" | "flow">[],
): Promise<Set<string>> {
  const ids = orders.filter(isPurchaseFlow).map((o) => o.id);
  if (!ids.length) return new Set();
  const { listColumns } = await import("@/lib/db/lookup");
  const rows = await listColumns(
    getStore(),
    "requirements",
    ["orderId", "key"],
    { filter: { orderId: ids } },
  );
  return new Set(
    rows
      .filter((r) => baseKeyOf(r.key) === LANE_KEYS.certificate)
      .map((r) => r.orderId),
  );
}

/** O pedido de compra exige certificação (a tela avisa quando não exige). */
export async function purchaseNeedsCertification(
  order: Pick<Order, "id" | "flow">,
): Promise<boolean> {
  return (await purchaseOrdersNeedingCert([order])).has(order.id);
}

/**
 * Pendências: o parceiro (comex, agente de carga, fornecedor, OCP, agência)
 * faz os passos dele que estão prontos; quem valida, os enviados; o
 * financeiro, o numerário. A Wellmix só ganha pendência de embarque e
 * desembaraço quando valida ou quando o passo é dela (DANFE).
 *
 * Certificação (docs/CERTIFICATION.md, "Quem recebe cada tarefa"): cada passo
 * vai para um login certo, pelo que o pedido já tem (cert-art-routing): o
 * selo, a certificadora (sem ela, quem designa: o analista ou a equipe); o
 * memorial, o analista, e a validação dele, a certificadora; a arte com o
 * selo, o designer do pedido, a agência que faz a arte ou a Wellmix, e a
 * validação, quem pode validar arte. O selo vale para todo pedido, desde que
 * ele nasce; memorial, laudo e registro, com OCP designado ou passo deles já
 * começado, a partir da Preparação. Pedido de compra: só com produto que
 * exige certificação (P6), e o memorial desde que o pedido nasce.
 */
/** Até a chegada do navio: o rastreio diário do container vale nessas etapas. */
const TRACKING_LIVE = ["INSPECTION", "SHIPPING", "CUSTOMS"];

/** Hoje em Brasília (AAAA-MM-DD). */
const todayInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export async function importTasks(
  user: User,
  orders: Order[],
  options: ImportTasksOptions = {},
): Promise<ImportTaskDraft[]> {
  const IMPORT_LIVE = ["INSPECTION", "SHIPPING", "CUSTOMS", "TRANSPORT"];
  const open = orders.filter(
    (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
  );
  if (!open.length) return [];
  let rows: ImportStep[] = [];
  try {
    rows = await getStore().list("import_steps", {
      filter: { orderId: open.map((o) => o.id) },
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const out: ImportTaskDraft[] = [];
  const wellmix = isWellmix(user);
  const teamView = wellmix && !!options.team;
  let agencyArt: boolean | null = null;
  // Certificação: quem recebe cada passo, lido uma vez para a lista toda.
  const ctx = await loadRoutingContext();
  const teamIds = new Set(ctx.team.map((u) => u.id));
  const mine = (route: Route) =>
    teamView
      ? !!route.team || (route.userIds ?? []).some((id) => teamIds.has(id))
      : reaches(user, route);
  const certPurchase = await purchaseOrdersNeedingCert(open);
  for (const order of open) {
    const steps = rows.filter((r) => r.orderId === order.id);
    const importLive = IMPORT_LIVE.includes(order.status);
    const gate = certGate(order, steps, certPurchase.has(order.id));
    for (const tpl of IMPORT_STEPS) {
      const cert = groupOf(tpl) === "certification";
      if (!cert && !importLive) continue;
      // Container na origem só no pedido de compra; nele, sem os papéis antigos.
      if (!stepApplies(order, tpl.key)) continue;
      const step = steps.find((s) => s.key === tpl.key);
      if (cert) {
        const task = certTask(order, tpl, step, steps, ctx, gate);
        if (!task) continue;
        const { route, ...draft } = task;
        if (!mine(route)) continue;
        if (draft.kind === "cert_validate" && !teamView) {
          // Quem enviou não valida o próprio envio; a arte com o selo, só
          // quem pode validar arte.
          if (step?.submittedByUserId === user.id) continue;
          if (
            wellmix &&
            tpl.key === "cert_seal_art" &&
            !canValidateArt(user, ctx)
          )
            continue;
        }
        out.push({
          ...draft,
          order,
          ownerUserId: routeOwnerUserId(route, order, ctx),
        });
        continue;
      }
      // Validar o que foi enviado.
      if (
        tpl.validator &&
        step?.status === "submitted" &&
        step.submittedByUserId !== user.id &&
        actsAs(user, order, tpl.validator) &&
        // Wellmix só valida no lugar do parceiro quando ele não foi designado.
        (!wellmix ||
          tpl.validator === "wellmix" ||
          tpl.validator === "finance" ||
          tpl.validator === "comex_internal" ||
          (tpl.validator !== "supplier" &&
            !partnerAssigned(order, tpl.validator)))
      ) {
        out.push({
          kind: "import_validate",
          order,
          key: tpl.key,
          sinceAt: step.submittedAt,
          link: stepLink(order.id, tpl),
        });
        continue;
      }
      // Fazer (ou refazer) o passo. O rastreio do container é todo dia, até
      // a chegada: a pendência volta quando o último registro não é de hoje.
      const todo =
        !step ||
        step.status === "pending" ||
        step.status === "rejected" ||
        (tpl.key === "container_tracking" &&
          TRACKING_LIVE.includes(order.status) &&
          (step.submittedAt ?? "").slice(0, 10) < todayInBrazil());
      if (!todo || !ready(tpl.key, steps)) continue;
      // Pedido de compra: o BL vem conferido dos documentos do embarque.
      if (tpl.key === "bl" && isPurchaseFlow(order)) continue;
      if (!actsAs(user, order, tpl.actor)) continue;
      if (tpl.actor === "agency") {
        // Passo de quem faz a arte: a agência do pedido ou, sem ela, a Wellmix.
        agencyArt ??= (await getSettings()).agencyValidationEnabled;
        const agencyDoes = artRole(order, agencyArt) === "agency";
        if (wellmix ? agencyDoes : !agencyDoes) continue;
      } else if (
        wellmix &&
        tpl.actor !== "wellmix" &&
        tpl.actor !== "finance" &&
        tpl.actor !== "comex_internal"
      )
        continue;
      out.push({
        kind: "import_step",
        order,
        key: tpl.key,
        link: stepLink(order.id, tpl, "do"),
        // Recusado: desde a recusa; senão, desde que o passo anterior fechou.
        sinceAt:
          step?.status === "rejected"
            ? step.validatedAt
            : tpl.after
              ? (steps.find((x) => x.key === tpl.after)?.validatedAt ?? null)
              : null,
      });
    }
  }
  return out;
}

interface CertGate {
  /** A certificação vale no pedido (pedido de compra: só com produto que exige, P6). */
  on: boolean;
  /** Memorial, laudo e registro valem (OCP designado ou passo começado). */
  classicCert: boolean;
  /** Laudo ou registro já começados (pedido antigo segue o caminho dele). */
  classicDeep: boolean;
}

/**
 * Quando cada passo da certificação vira pendência. Memorial, laudo e
 * registro: com OCP designado ou passo deles começado; com o pedido
 * recém-criado ninguém ganha a pendência de começar, mas o que já começou
 * pelo cartão segue (validar, passo seguinte). Pedido de compra: só com
 * produto que exige certificação, e o memorial desde que ele nasce (vai
 * junto com o selo).
 */
function certGate(
  order: Order,
  steps: ImportStep[],
  purchaseNeedsCert: boolean,
): CertGate {
  const purchase = isPurchaseFlow(order);
  const on = !purchase || purchaseNeedsCert;
  const classicStarted = steps.some((s) => {
    const tpl = stepTemplate(s.key);
    return groupOf(tpl) === "certification" && !tpl.seal;
  });
  return {
    on,
    classicCert: purchase
      ? on
      : order.status === "ORDER_CREATED"
        ? classicStarted
        : hasCertifier(order) || classicStarted,
    classicDeep: steps.some(
      (s) => s.key === "cert_lab" || s.key === "cert_registration",
    ),
  };
}

/**
 * Pendência de um passo da certificação (fazer ou validar) e para quem ela
 * vai; nula quando o passo não pede nada agora.
 */
function certTask(
  order: Order,
  tpl: StepTemplate,
  step: ImportStep | undefined,
  steps: ImportStep[],
  ctx: RoutingContext,
  gate: CertGate,
): (Omit<ImportTaskDraft, "order"> & { route: Route }) | null {
  if (!gate.on) return null;
  if (!tpl.seal && !gate.classicCert) return null;
  // Validar o que foi enviado.
  if (tpl.validator && step?.status === "submitted") {
    const route = certValidateRoute(order, tpl, ctx, step.submittedByUserId);
    if (!route) return null;
    return {
      kind: "cert_validate",
      key: tpl.key,
      sinceAt: step.submittedAt,
      link: stepLink(order.id, tpl, "validate"),
      missing: route.missing ?? null,
      route,
    };
  }
  // Laudo e registro não viram pendência de começar: o PDF do memorial e do
  // selo basta (dono, 10/11/2026). Pedido antigo com laudo ou registro já
  // começados segue o caminho dele. O memorial é tarefa do responsável
  // interno (dono, 13/11/2026).
  if (!tpl.seal && tpl.key !== "cert_memorial" && !gate.classicDeep)
    return null;
  // Laudo e registro sem despachante: ninguém começa por ele.
  if (tpl.actor === "ocp" && !tpl.seal && !hasCertifier(order)) return null;
  // Fazer (ou refazer) o passo, quando o anterior já foi feito.
  const todo = !step || step.status === "pending" || step.status === "rejected";
  if (!todo || !ready(tpl.key, steps)) return null;
  const route = certDoRoute(order, tpl, ctx);
  const before = tpl.after ? steps.find((x) => x.key === tpl.after) : null;
  return {
    kind: "cert_step",
    key: tpl.key,
    // Recusado: desde a recusa; senão, desde que o passo anterior fechou.
    sinceAt:
      step?.status === "rejected"
        ? step.validatedAt
        : (before?.validatedAt ?? before?.submittedAt ?? null),
    // Selo sem certificadora: quem designa vai direto a Parceiros do pedido.
    link:
      tpl.key === "cert_seal" && route.missing === "ocp"
        ? `/app/orders/${order.id}#order-partners`
        : stepLink(order.id, tpl, "do"),
    missing: route.missing ?? null,
    route,
  };
}
