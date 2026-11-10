import "server-only";

import { getStore, type ImportStep, type Order, type User } from "@/lib/db";
import {
  CUSTOMS_CHANNELS,
  type ImportStepKey,
  type Role,
} from "@/lib/db/schema";
import {
  ForbiddenError,
  canViewOrder,
  isAdmin,
  isWellmix,
} from "@/lib/auth/permissions";
import { translator } from "@/i18n";
import { getSettings } from "@/lib/settings";
import { artRole } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { notify, type NotifyTarget } from "./notifications";
import { isSchemaMissing } from "./packaging-brief";

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

/** Quem age num passo. */
export type StepActor =
  "logistics" | "comex" | "ocp" | "agency" | "supplier" | "finance" | "wellmix";
/** Cartão do passo: embarque/desembaraço ou certificação (Fase F). */
export type StepGroup = "import" | "certification";
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
   * Certificação: o passo já vale com o pedido recém-criado (os demais só
   * viram pendência a partir da Preparação).
   */
  fromBirth?: boolean;
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
    fromBirth: true,
  },
  {
    key: "cert_seal_art",
    actor: "agency",
    validator: "wellmix",
    input: "file",
    visibleTo: ["agency", "ocp"],
    after: "cert_seal",
    group: "certification",
    fromBirth: true,
  },
];

export const stepTemplate = (key: ImportStepKey) =>
  IMPORT_STEPS.find((s) => s.key === key)!;

const PARTNER_FIELD = {
  logistics: "logisticsId",
  comex: "comexId",
  ocp: "ocpId",
  agency: "agencyId",
  supplier: "supplierId",
} as const;

/** Âncora do cartão do passo na tela do pedido. */
const anchorOf = (tpl: StepTemplate) =>
  groupOf(tpl) === "certification" ? "certification" : "import-flow";

/** Nome do cartão nos registros da auditoria. */
const auditLabel = (tpl: StepTemplate) =>
  groupOf(tpl) === "certification" ? "Certificação" : "Embarque/desembaraço";

/** Financeiro: função da Wellmix (ou admin). */
export const isFinance = (user: User) =>
  isAdmin(user) ||
  (isWellmix(user) && (user.functions ?? []).includes("finance"));

/** O usuário é quem age (ou valida) por esse papel neste pedido? */
export function actsAs(user: User, order: Order, actor: StepActor): boolean {
  if (actor === "finance") return isFinance(user);
  if (isWellmix(user)) return true;
  if (actor === "wellmix") return false;
  const field = PARTNER_FIELD[actor];
  return user.role === actor && !!user.partyId && order[field] === user.partyId;
}

/** Vê o passo: Wellmix sempre; o parceiro, se o passo é visível ao papel dele. */
export function canSeeStep(user: User, order: Order, key: ImportStepKey) {
  if (isWellmix(user)) return true;
  if (!canViewOrder(user, order)) return false;
  return stepTemplate(key).visibleTo.includes(user.role);
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

/** Quem faz a arte na Wellmix: o designer do pedido, a função Designer ou o analista. */
async function wellmixArtTarget(order: Order): Promise<NotifyTarget> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const designer = team.find((u) => u.id === order.designerUserId);
  if (designer) return { userIds: [designer.id] };
  const designers = team.filter((u) =>
    (u.functions ?? []).includes("designer"),
  );
  if (designers.length) return { userIds: designers.map((u) => u.id) };
  return order.ownerUserId
    ? { userIds: [order.ownerUserId] }
    : { role: ["admin", "operator"] };
}

/** Destino dos avisos para um papel do passo neste pedido. */
async function targetFor(
  order: Order,
  actor: StepActor,
): Promise<NotifyTarget> {
  if (actor === "agency") {
    return order.agencyId && (await agencyDoesArt(order))
      ? { role: "agency", partyId: order.agencyId }
      : wellmixArtTarget(order);
  }
  if (actor === "finance") {
    const team = await getStore().list("users", {
      filter: { role: ["admin", "operator"], active: true },
    });
    const finance = team.filter((u) => (u.functions ?? []).includes("finance"));
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
  if (!actsAs(user, order, tpl.actor)) throw new ForbiddenError();
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
  const link = `/app/orders/${orderId}#${anchorOf(tpl)}`;
  if (tpl.validator)
    await notify(await targetFor(order, tpl.validator), {
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
  const link = `/app/orders/${order.id}#certification`;
  const art = steps.find((s) => s.key === "cert_seal_art");
  if (
    replaced &&
    (art?.status === "submitted" || art?.status === "validated")
  ) {
    await getStore().update("import_steps", art.id, {
      status: "rejected",
      validatedByUserId: null,
      validatedAt: null,
      // Texto gravado no passo (quem aplica o selo lê em português).
      rejectReason: translator("pt")("certFlow.sealReplaced"),
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
    actor: "ocp",
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
 * selo a emitir; a pendência dela nasce junto. Sem OCP no pedido e com mais
 * de uma certificadora ativa, a Wellmix é avisada para designar uma (com uma
 * só, ela já é designada sozinha na criação do pedido).
 */
export async function notifySealRequested(order: Order): Promise<void> {
  if (order.status === "CANCELLED" || order.status === "CLOSED") return;
  if (order.ocpId) {
    await notify(
      { role: "ocp", partyId: order.ocpId },
      {
        link: `/app/orders/${order.id}#certification`,
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
  const ocps = await getStore().list("parties", {
    filter: { type: "ocp", active: true },
  });
  if (ocps.length < 2) return;
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
  field: "ocpId" | "agencyId",
): Promise<void> {
  if (order.status === "CANCELLED" || order.status === "CLOSED") return;
  const steps = await stepsOf(order.id);
  const sealDone = isDone(steps.find((s) => s.key === "cert_seal"));
  if (field === "ocpId") {
    if (order.ocpId && !sealDone) await notifySealRequested(order);
    return;
  }
  const art = steps.find((s) => s.key === "cert_seal_art");
  const artOpen = !art || art.status === "pending" || art.status === "rejected";
  if (!sealDone || !artOpen) return;
  await notify(await targetFor(order, "agency"), {
    link: `/app/orders/${order.id}#certification`,
    kind: "action",
    actor: "ocp",
    text: (t) => ({
      subject: t("certFlow.notify.sealReady.subject", {
        n: String(order.number),
      }),
      body: t("certFlow.notify.sealReady.body"),
    }),
  });
}

/** Selo de certificação visto por quem faz a arte (tela do briefing). */
export type SealState = "pending" | "ready" | "sent" | "done";

/**
 * Situação do selo para o usuário: aguardando a certificadora, disponível
 * para aplicar, arte com o selo enviada ou conferida. Nulo quando o pedido
 * não tem certificação em andamento ou o usuário não vê o passo.
 */
export async function sealStateFor(
  user: User,
  order: Order,
): Promise<SealState | null> {
  if (order.status === "CANCELLED") return null;
  if (!canSeeStep(user, order, "cert_seal")) return null;
  const steps = await stepsOf(order.id);
  const started = steps.some(
    (s) => groupOf(stepTemplate(s.key)) === "certification",
  );
  if (!order.ocpId && !started) return null;
  if (!isDone(steps.find((s) => s.key === "cert_seal"))) return "pending";
  const art = steps.find((s) => s.key === "cert_seal_art");
  if (isDone(art)) return "done";
  return art?.status === "submitted" ? "sent" : "ready";
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
  const link = `/app/orders/${orderId}#${anchorOf(tpl)}`;
  if (decision === "rejected")
    await notify(await targetFor(order, tpl.actor), {
      link,
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
        link,
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
  return IMPORT_STEPS.filter(
    (tpl) => groupOf(tpl) === group && canSeeStep(user, order, tpl.key),
  ).map((tpl) => {
    const step = steps.find((s) => s.key === tpl.key) ?? null;
    const isReady = ready(tpl.key, steps);
    const done = isDone(step ?? undefined);
    return {
      template: tpl,
      step,
      ready: isReady,
      done,
      canSubmit:
        open &&
        isReady &&
        !(tpl.validator && step?.status === "validated") &&
        actsAs(user, order, tpl.actor),
      canValidate:
        open &&
        !!tpl.validator &&
        step?.status === "submitted" &&
        actsAs(user, order, tpl.validator) &&
        (step.submittedByUserId !== user.id || isAdmin(user)),
    };
  });
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
}

/**
 * Pendências: o parceiro (comex, agente de carga, fornecedor, OCP, agência)
 * faz os passos dele que estão prontos; quem valida, os enviados; o
 * financeiro, o numerário. A Wellmix só ganha pendência quando valida, quando
 * o passo é dela (DANFE, memorial) ou quando é ela quem faz a arte (o passo
 * "selo aplicado na arte" de um pedido sem agência).
 *
 * Certificação: vale com OCP designado ou passo já começado (como o cartão
 * do pedido). Com o pedido recém-criado só o selo vira pendência; memorial,
 * laudo e registro, a partir da Preparação.
 */
export async function importTasks(
  user: User,
  orders: Order[],
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
  let agencyArt: boolean | null = null;
  for (const order of open) {
    const steps = rows.filter((r) => r.orderId === order.id);
    const importLive = IMPORT_LIVE.includes(order.status);
    const certLive =
      !!order.ocpId ||
      steps.some((s) => groupOf(stepTemplate(s.key)) === "certification");
    if (!importLive && !certLive) continue;
    for (const tpl of IMPORT_STEPS) {
      const cert = groupOf(tpl) === "certification";
      if (!cert && !importLive) continue;
      if (cert && !certLive) continue;
      if (cert && order.status === "ORDER_CREATED" && !tpl.fromBirth) continue;
      const step = steps.find((s) => s.key === tpl.key);
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
          (tpl.validator !== "supplier" &&
            !order[PARTNER_FIELD[tpl.validator]]))
      ) {
        out.push({
          kind: cert ? "cert_validate" : "import_validate",
          order,
          key: tpl.key,
        });
        continue;
      }
      // Fazer (ou refazer) o passo.
      const todo =
        !step || step.status === "pending" || step.status === "rejected";
      if (!todo || !ready(tpl.key, steps)) continue;
      if (!actsAs(user, order, tpl.actor)) continue;
      if (tpl.actor === "agency") {
        // Passo de quem faz a arte: a agência do pedido ou, sem ela, a Wellmix.
        agencyArt ??= (await getSettings()).agencyValidationEnabled;
        const agencyDoes = artRole(order, agencyArt) === "agency";
        if (wellmix ? agencyDoes : !agencyDoes) continue;
      } else if (wellmix && tpl.actor !== "wellmix" && tpl.actor !== "finance")
        continue;
      out.push({
        kind: cert ? "cert_step" : "import_step",
        order,
        key: tpl.key,
      });
    }
  }
  return out;
}
