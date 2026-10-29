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
import { audit } from "./audit";
import { notify, type NotifyTarget } from "./notifications";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Embarque e desembaraço (Fase D, docs/IMPORT_FLOW.md): passos do processo de
 * importação, cada um com quem faz (agente de carga, comex, fornecedor,
 * financeiro ou Wellmix), quem valida e quem vê. Sem parceiro designado, a
 * Wellmix faz a parte dele. O financeiro (função da Wellmix) valida e paga o
 * numerário. A Wellmix vê e pode agir em tudo, menos no que é do financeiro.
 */

export class ImportFlowError extends Error {}

/** Quem age num passo. */
export type StepActor =
  "logistics" | "comex" | "supplier" | "finance" | "wellmix";
/** O que o passo pede. */
export type StepInput =
  "text" | "file" | "text_file" | "money_file" | "channel" | "date";

export interface StepTemplate {
  key: ImportStepKey;
  actor: StepActor;
  validator: StepActor | null;
  input: StepInput;
  /** Papéis externos que veem o passo (além da Wellmix). */
  visibleTo: Role[];
  /** Passo que precisa estar concluído antes. */
  after?: ImportStepKey;
}

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
];

export const stepTemplate = (key: ImportStepKey) =>
  IMPORT_STEPS.find((s) => s.key === key)!;

const PARTNER_FIELD = {
  logistics: "logisticsId",
  comex: "comexId",
  supplier: "supplierId",
} as const;

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

/** Destino dos avisos para um papel do passo neste pedido. */
async function targetFor(
  order: Order,
  actor: StepActor,
): Promise<NotifyTarget> {
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
  const needsFile = ["file", "text_file", "money_file"].includes(tpl.input);
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
  const step = current
    ? await store.update("import_steps", current.id, data)
    : await store.create("import_steps", { orderId, key, ...data });
  await audit(
    user,
    "import.step_submitted",
    "order",
    orderId,
    `Embarque/desembaraço: ${key} enviado${value ? ` (${value})` : ""}${data.amount ? ` · ${data.currency} ${data.amount}` : ""}`,
  );
  const link = `/app/orders/${orderId}#import-flow`;
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
  return step;
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
    `Embarque/desembaraço: ${key} ${decision === "validated" ? "validado" : `recusado (${reason})`}`,
  );
  const link = `/app/orders/${orderId}#import-flow`;
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
): Promise<StepView[]> {
  const steps = await stepsOf(order.id);
  // Pedido encerrado: só leitura.
  const open = order.status !== "CLOSED" && order.status !== "CANCELLED";
  return IMPORT_STEPS.filter((tpl) => canSeeStep(user, order, tpl.key)).map(
    (tpl) => {
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
    },
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
  kind: "import_step" | "import_validate";
  order: Order;
  key: ImportStepKey;
}

/**
 * Pendências: o parceiro (comex, agente de carga, fornecedor) faz os passos
 * dele que estão prontos; quem valida, os enviados; o financeiro, o numerário.
 * A Wellmix só ganha pendência quando valida ou quando o passo é dela (DANFE).
 */
export async function importTasks(
  user: User,
  orders: Order[],
): Promise<ImportTaskDraft[]> {
  const live = orders.filter((o) =>
    ["INSPECTION", "SHIPPING", "CUSTOMS", "TRANSPORT"].includes(o.status),
  );
  if (!live.length) return [];
  let rows: ImportStep[] = [];
  try {
    rows = await getStore().list("import_steps", {
      filter: { orderId: live.map((o) => o.id) },
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const out: ImportTaskDraft[] = [];
  const wellmix = isWellmix(user);
  for (const order of live) {
    const steps = rows.filter((r) => r.orderId === order.id);
    for (const tpl of IMPORT_STEPS) {
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
        out.push({ kind: "import_validate", order, key: tpl.key });
        continue;
      }
      // Fazer (ou refazer) o passo.
      const open =
        !step || step.status === "pending" || step.status === "rejected";
      if (!open || !ready(tpl.key, steps)) continue;
      if (!actsAs(user, order, tpl.actor)) continue;
      if (wellmix && tpl.actor !== "wellmix" && tpl.actor !== "finance")
        continue;
      out.push({ kind: "import_step", order, key: tpl.key });
    }
  }
  return out;
}
