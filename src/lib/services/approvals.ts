import "server-only";

import { after } from "next/server";
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

/*
 * "Gravando a escolha": todos os níveis aprovaram e a seleção do fornecedor
 * (que, na compra para estoque, já cria o pedido: dezenas de gravações) está
 * sendo gravada depois da resposta à tela. A aprovação continua "pendente",
 * sem nível a decidir e com todos os passos registrados (sem valor novo no
 * esquema). Termina em "aprovada" ou em "aprovada, mas não gravada".
 */
export function isApplying(approval: Approval): boolean {
  return (
    approval.status === "pending" &&
    approval.currentLevel === null &&
    approval.steps.length > 0 &&
    approval.steps.every((s) => s.decision === "approved")
  );
}

/** Tempo que a gravação pode levar antes de ser dada como interrompida. */
export const APPLY_STALE_MS = 150_000;

/** Gravação parada: passou do tempo e não concluiu (dá para concluir de novo). */
export function isApplyStale(approval: Approval, now = Date.now()): boolean {
  if (!isApplying(approval)) return false;
  const since = Date.parse(approval.decidedAt ?? "");
  return !Number.isFinite(since) || now - since > APPLY_STALE_MS;
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
  // Aberta do Superplan: a aprovação espera faca, MOQ, prazo e foto em alta.
  const { assertSuperplanItems } = await import("./superplan-rfq");
  await assertSuperplanItems(request, quote);
  // Negociação em aberto ou embalagem sem o OK do fornecedor: espera.
  const { assertQuoteFlowSettled } = await import("./quote-flow");
  await assertQuoteFlowSettled(request, quote);
  const settings = await getSettings();
  const valueBrl = valueInBrl(input);
  const levels = levelsFor(valueBrl, settings.approvalExecutiveThresholdBrl);
  const open = await pendingApprovalFor(request.id);
  // A escolha aprovada está sendo gravada: não dá para substituir agora.
  if (open && isApplying(open) && !isApplyStale(open))
    throw new ApprovalError("approval_applying");
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
  /**
   * Administrador: aprova de uma vez o nível atual e todos os que faltam
   * (pedido do dono, 10/11/2026). Cada nível fica registrado no nome dele.
   */
  options: { allLevels?: boolean } = {},
): Promise<Approval> {
  const store = getStore();
  let approval = await store.get("approvals", approvalId);
  if (!approval) throw new ApprovalError("not_found");
  if (!canDecide(user, approval)) throw new ForbiddenError();
  if (options.allLevels && decision === "approved") {
    if (!isAdmin(user)) throw new ForbiddenError();
    // Os níveis antes do último: registrados aqui; o último segue o caminho
    // normal abaixo (grava a escolha do fornecedor).
    const at = new Date().toISOString();
    const from = approval.levels.indexOf(approval.currentLevel!);
    const middle = approval.levels.slice(from, -1);
    if (middle.length) {
      approval = await store.update("approvals", approval.id, {
        steps: [
          ...approval.steps,
          ...middle.map((level) => ({
            level,
            decision: "approved" as const,
            userId: user.id,
            at,
            note: note?.trim() || null,
          })),
        ],
        currentLevel: approval.levels[approval.levels.length - 1],
      });
      await audit(
        user,
        "approval.approve",
        "request",
        approval.requestId,
        `Administrador aprovou de uma vez os níveis: ${middle.join(", ")}`,
      );
    }
  }
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
  // Último nível: a aprovação fica registrada na hora (a tela responde já) e
  // a seleção do fornecedor é gravada em seguida, depois da resposta.
  const applying = await store.update("approvals", approval.id, {
    steps,
    currentLevel: null,
    decidedAt: now,
  });
  await audit(
    user,
    "approval.approve",
    "request",
    request.id,
    `Aprovado no último nível (${level}); gravando a escolha do fornecedor`,
  );
  // Fora de uma requisição (testes, rotinas) não há "depois": grava agora.
  if (!scheduleFinish(user, applying.id))
    return finishApproval(user, applying.id);
  return applying;
}

/** Agenda a gravação da escolha para depois da resposta. Devolve se agendou. */
function scheduleFinish(user: User, approvalId: string): boolean {
  try {
    after(async () => {
      try {
        await finishApproval(user, approvalId);
      } catch (error) {
        console.error(
          "approval_finish_failed",
          approvalId,
          error instanceof Error ? error.message : String(error),
        );
      }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Conclui a aprovação que está "gravando a escolha": grava a seleção do
 * fornecedor (selectQuote) e marca "aprovada"; se a gravação falhar (ficha
 * mudou, cotação reaberta), fica "aprovada, mas não gravada" com o motivo e o
 * comprador é avisado. Chamada de novo depois de concluída, não faz nada.
 */
export async function finishApproval(
  user: User,
  approvalId: string,
): Promise<Approval> {
  const store = getStore();
  const approval = await store.get("approvals", approvalId);
  if (!approval) throw new ApprovalError("not_found");
  if (!isApplying(approval)) return approval;
  const request = await store.get("requests", approval.requestId);
  if (!request) throw new ApprovalError("not_found");
  const level = approval.steps.at(-1)?.level ?? "";
  try {
    await applySelection(user, approval);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failed = await store.update("approvals", approval.id, {
      status: "failed",
      currentLevel: null,
      reason,
      decidedAt: new Date().toISOString(),
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
    status: "approved",
    currentLevel: null,
    decidedAt: new Date().toISOString(),
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

/**
 * Grava a escolha aprovada. Se uma tentativa anterior foi interrompida no
 * meio (tempo esgotado depois de marcar a cotação, antes de o pedido
 * nascer), retoma de onde parou; se a escolha já está toda gravada (a
 * solicitação já virou pedido com esta cotação), não há mais nada a fazer.
 */
async function applySelection(user: User, approval: Approval) {
  const store = getStore();
  const request = await store.get("requests", approval.requestId);
  if (
    request?.status === "ORDERED" &&
    request.selectedQuoteId === approval.quoteId
  )
    return;
  const { selectQuote } = await import("./requests");
  await selectQuote(
    user,
    approval.quoteId,
    approval.input as unknown as SelectQuoteInput,
  );
}

/**
 * A aprovação terminou em "falhou" (todos os níveis aprovaram, mas a escolha
 * não pôde ser gravada) e é a mais recente da solicitação: dá para tentar
 * concluir de novo. Só o administrador ou quem aprovou o último nível.
 */
export function canRetryApproval(
  user: User,
  approval: Approval,
  latest: boolean,
): boolean {
  if (!isWellmix(user) || !latest) return false;
  // "Falhou" ou gravação interrompida (passou do tempo sem concluir).
  if (approval.status !== "failed" && !isApplyStale(approval)) return false;
  if (isAdmin(user)) return true;
  const last = approval.steps[approval.steps.length - 1];
  return !!last && last.decision === "approved" && last.userId === user.id;
}

/**
 * Tenta concluir de novo uma aprovação que falhou ao gravar a escolha (ex.:
 * a criação do pedido foi interrompida). Não pede nova aprovação: os níveis
 * já aprovaram; só refaz a gravação, retomando de onde parou.
 */
export async function retryApproval(
  user: User,
  approvalId: string,
): Promise<Approval> {
  const store = getStore();
  const approval = await store.get("approvals", approvalId);
  if (!approval) throw new ApprovalError("not_found");
  const [latest] = await approvalsFor(approval.requestId);
  if (!canRetryApproval(user, approval, latest?.id === approval.id))
    throw new ForbiddenError();
  const request = await store.get("requests", approval.requestId);
  if (!request) throw new ApprovalError("not_found");
  try {
    await applySelection(user, approval);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Gravação interrompida que falha de novo passa a "aprovada, mas não gravada".
    const failed = await store.update("approvals", approval.id, {
      status: "failed",
      currentLevel: null,
      reason,
    });
    await audit(
      user,
      "approval.failed",
      "request",
      request.id,
      `Nova tentativa de gravar a escolha aprovada não deu certo: ${reason}`,
    );
    return failed;
  }
  const done = await store.update("approvals", approval.id, {
    status: "approved",
    currentLevel: null,
    reason: null,
    decidedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "approval.approve",
    "request",
    request.id,
    "Aprovação concluída na nova tentativa; escolha do fornecedor gravada",
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
  // Já aprovada por todos e sendo gravada: não há mais o que cancelar.
  if (isApplying(approval) && !isApplyStale(approval))
    throw new ApprovalError("approval_applying");
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
