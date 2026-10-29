import "server-only";

import {
  APPROVAL_LEVELS,
  getStore,
  type Approval,
  type ApprovalLevel,
  type User,
  type WellmixFunction,
} from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { notify } from "./notifications";
import { isSchemaMissing } from "./packaging-brief";
import type { SelectQuoteInput } from "./requests";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Aprovação do pré-custo (docs/APPROVALS.md). Quando o comprador escolhe o
 * fornecedor e o valor ao cliente, a escolha não vale na hora: vira uma
 * aprovação que passa, em ordem, pelo planner e pela diretoria de compras e,
 * a partir do valor das Configurações, pela diretoria executiva. Aprovada no
 * último nível, a seleção do fornecedor é gravada como sempre (proposta,
 * sinal, briefing). Reprovada em qualquer nível, volta ao comprador com o
 * motivo e nada muda na solicitação. O cliente não vê nada disso.
 *
 * Quem decide um nível: quem tem a função daquele nível (Equipe e divisões)
 * ou o administrador. A mesma pessoa não decide dois níveis da mesma
 * aprovação nem aprova a própria escolha (o administrador pode).
 */

export class ApprovalError extends Error {}

/** Função da Equipe exigida para decidir cada nível. */
const LEVEL_FUNCTION: Record<ApprovalLevel, WellmixFunction> = {
  planner: "planner",
  purchasing_director: "purchasing_director",
  executive_director: "executive_director",
};

/** Níveis exigidos para o valor: a executiva só a partir do limite (ou sem câmbio). */
export function levelsFor(
  valueBrl: number | null,
  thresholdBrl: number,
): ApprovalLevel[] {
  const executive = valueBrl === null || valueBrl >= thresholdBrl;
  return APPROVAL_LEVELS.filter((l) => l !== "executive_director" || executive);
}

/** Valor ao cliente em BRL (com o câmbio da conta), ou nulo sem câmbio. */
function valueInBrl(input: SelectQuoteInput): number | null {
  if (input.sellCurrency === "BRL") return input.sellPrice;
  const rate = (input.pricing as { sellFxRate?: unknown } | null | undefined)
    ?.sellFxRate;
  return typeof rate === "number" && rate > 0
    ? Math.round(input.sellPrice * rate * 100) / 100
    : null;
}

/** O login pode decidir o nível atual desta aprovação? */
export function canDecide(user: User, approval: Approval): boolean {
  if (!isWellmix(user) || approval.status !== "pending") return false;
  const level = approval.currentLevel;
  if (!level) return false;
  if (isAdmin(user)) return true;
  if (!(user.functions ?? []).includes(LEVEL_FUNCTION[level])) return false;
  // Segregação: não aprova a própria escolha nem decide dois níveis.
  if (approval.requestedByUserId === user.id) return false;
  return !approval.steps.some((s) => s.userId === user.id);
}

/** Logins que decidem um nível (pela função); ninguém com a função: os admins. */
async function deciders(level: ApprovalLevel): Promise<User[]> {
  const team = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
  });
  const withFunction = team.filter((u) =>
    (u.functions ?? []).includes(LEVEL_FUNCTION[level]),
  );
  return withFunction.length ? withFunction : team.filter(isAdmin);
}

async function announce(
  approval: Approval,
  productName: string,
  to: { userIds: string[] },
  kind: "next" | "approved" | "rejected" | "failed",
) {
  if (!to.userIds.length) return;
  await notify(to, {
    link: `/app/requests/${approval.requestId}#approval`,
    kind: kind === "next" ? "action" : kind === "approved" ? "done" : "alert",
    actor: null,
    text: (t) => ({
      subject: t(`approvals.notify.${kind}.subject` as DictionaryKey, {
        product: productName,
      }),
      body:
        kind === "next"
          ? t("approvals.notify.next.body", {
              level: t(
                `approvals.level.${approval.currentLevel ?? "planner"}` as DictionaryKey,
              ),
            })
          : kind === "approved"
            ? t("approvals.notify.approved.body")
            : t(`approvals.notify.${kind}.body` as DictionaryKey, {
                reason: approval.reason ?? "—",
              }),
    }),
  });
}

/** Aprovação em aberto da solicitação (nula sem nenhuma; tabela não publicada: nula). */
export async function pendingApprovalFor(
  requestId: string,
): Promise<Approval | null> {
  try {
    const [row] = await getStore().list("approvals", {
      filter: { requestId, status: "pending" },
      limit: 1,
    });
    return row ?? null;
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Histórico de aprovações da solicitação (mais recente primeiro). */
export async function approvalsFor(requestId: string): Promise<Approval[]> {
  try {
    return await getStore().list("approvals", {
      filter: { requestId },
      orderBy: "createdAt",
      direction: "desc",
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** A escolha precisa de aprovação? (Configurações: liga/desliga.) */
export async function approvalsRequired(): Promise<boolean> {
  return (await getSettings()).approvalsEnabled;
}

/**
 * Comprador envia a escolha do fornecedor para aprovação. Uma aprovação em
 * aberto da mesma solicitação é substituída (cancelada com o motivo).
 */
export async function submitForApproval(
  user: User,
  quoteId: string,
  input: SelectQuoteInput,
): Promise<Approval> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote || quote.status !== "answered")
    throw new ApprovalError("invalid_quote");
  const request = await store.get("requests", quote.requestId);
  if (!request) throw new ApprovalError("not_found");
  if (
    !["RFQ_OPEN", "QUOTATION_RECEIVED", "SUPPLIER_SELECTED"].includes(
      request.status,
    )
  )
    throw new ApprovalError("invalid_status");
  // Dumping marcado pelo despachante: espera a liberação (Fase B).
  const { dumpingHold } = await import("./purchase-flow");
  if (await dumpingHold(quote.id))
    throw new ApprovalError("dumping_release_required");
  const settings = await getSettings();
  const valueBrl = valueInBrl(input);
  const levels = levelsFor(valueBrl, settings.approvalExecutiveThresholdBrl);
  const open = await pendingApprovalFor(request.id);
  if (open) {
    await store.update("approvals", open.id, {
      status: "cancelled",
      reason: "Substituída por uma nova escolha",
      decidedAt: new Date().toISOString(),
    });
  }
  const approval = await store.create("approvals", {
    requestId: request.id,
    quoteId: quote.id,
    requestedByUserId: user.id,
    status: "pending",
    input: input as unknown as Record<string, unknown>,
    valueBrl,
    levels,
    steps: [],
    currentLevel: levels[0],
    reason: null,
    decidedAt: null,
  });
  await audit(
    user,
    "approval.submit",
    "request",
    request.id,
    `Escolha do fornecedor enviada para aprovação (${levels.length} nível(is))`,
    null,
    { approvalId: approval.id, valueBrl, levels },
  );
  await announce(
    approval,
    request.productName,
    { userIds: (await deciders(levels[0])).map((u) => u.id) },
    "next",
  );
  return approval;
}

/**
 * Decide o nível atual. Aprovado no último nível: grava a seleção do
 * fornecedor (selectQuote); se ela falhar (ficha mudou, cotação reaberta),
 * a aprovação fica "falhou" com o motivo e o comprador é avisado.
 */
export async function decideApproval(
  user: User,
  approvalId: string,
  decision: "approved" | "rejected",
  note: string | null,
): Promise<Approval> {
  const store = getStore();
  const approval = await store.get("approvals", approvalId);
  if (!approval) throw new ApprovalError("not_found");
  if (!canDecide(user, approval)) throw new ForbiddenError();
  if (decision === "rejected" && !note?.trim())
    throw new ApprovalError("reason_required");
  const request = await store.get("requests", approval.requestId);
  if (!request) throw new ApprovalError("not_found");
  const now = new Date().toISOString();
  const level = approval.currentLevel!;
  const steps = [
    ...approval.steps,
    { level, decision, userId: user.id, at: now, note: note?.trim() || null },
  ];
  if (decision === "rejected") {
    const updated = await store.update("approvals", approval.id, {
      steps,
      status: "rejected",
      currentLevel: null,
      reason: note!.trim(),
      decidedAt: now,
    });
    await audit(
      user,
      "approval.reject",
      "request",
      request.id,
      `Aprovação reprovada (${level}): ${note!.trim()}`,
    );
    await announce(
      updated,
      request.productName,
      { userIds: [approval.requestedByUserId] },
      "rejected",
    );
    return updated;
  }
  const next = approval.levels[approval.levels.indexOf(level) + 1] ?? null;
  if (next) {
    const updated = await store.update("approvals", approval.id, {
      steps,
      currentLevel: next,
    });
    await audit(
      user,
      "approval.approve",
      "request",
      request.id,
      `Aprovado no nível ${level}; segue para ${next}`,
    );
    await announce(
      updated,
      request.productName,
      { userIds: (await deciders(next)).map((u) => u.id) },
      "next",
    );
    return updated;
  }
  // Último nível: a seleção do fornecedor passa a valer.
  try {
    const { selectQuote } = await import("./requests");
    await selectQuote(
      user,
      approval.quoteId,
      approval.input as unknown as SelectQuoteInput,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failed = await store.update("approvals", approval.id, {
      steps,
      status: "failed",
      currentLevel: null,
      reason,
      decidedAt: now,
    });
    await audit(
      user,
      "approval.failed",
      "request",
      request.id,
      `Aprovada, mas a escolha não pôde ser gravada: ${reason}`,
    );
    await announce(
      failed,
      request.productName,
      { userIds: [approval.requestedByUserId] },
      "failed",
    );
    return failed;
  }
  const done = await store.update("approvals", approval.id, {
    steps,
    status: "approved",
    currentLevel: null,
    decidedAt: now,
  });
  await audit(
    user,
    "approval.approve",
    "request",
    request.id,
    `Aprovação concluída (${level}); escolha do fornecedor gravada`,
  );
  await announce(
    done,
    request.productName,
    { userIds: [approval.requestedByUserId] },
    "approved",
  );
  return done;
}

/** Quem enviou (ou o admin) cancela a aprovação em aberto. */
export async function cancelApproval(
  user: User,
  approvalId: string,
): Promise<void> {
  const store = getStore();
  const approval = await store.get("approvals", approvalId);
  if (!approval || approval.status !== "pending")
    throw new ApprovalError("not_found");
  if (!(isAdmin(user) || approval.requestedByUserId === user.id))
    throw new ForbiddenError();
  await store.update("approvals", approval.id, {
    status: "cancelled",
    currentLevel: null,
    reason: "Cancelada por quem enviou",
    decidedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "approval.cancel",
    "request",
    approval.requestId,
    "Aprovação cancelada",
  );
}

/** Aprovações em aberto que o login pode decidir (pendências). */
export async function approvalsToDecide(user: User): Promise<Approval[]> {
  if (!isWellmix(user)) return [];
  try {
    const open = await getStore().list("approvals", {
      filter: { status: "pending" },
    });
    return open.filter((a) => canDecide(user, a));
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Todas as aprovações em aberto (tabela não publicada: nenhuma). */
export async function pendingApprovalsAll(): Promise<Approval[]> {
  try {
    return await getStore().list("approvals", {
      filter: { status: "pending" },
    });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}
