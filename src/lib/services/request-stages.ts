import "server-only";

import { getStore, type Request } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  requestStages,
  requestStepDays,
  type RequestStageRow,
} from "@/lib/request-stages";
import { isSchemaMissing } from "@/lib/db/errors";
import { briefForRequest } from "./packaging-brief";

/*
 * Lê o que as etapas da solicitação precisam (src/lib/request-stages.ts):
 * cotações, a aprovação do pré-custo mais recente, a auditoria da escolha e do
 * sinal e o briefing da embalagem (faca). Só leitura.
 */

export interface RequestStagesView {
  rows: RequestStageRow[];
  /** Fornecedor escolhido (a faca é dele): conversa da linha da faca. */
  supplier: { id: string; name: string } | null;
  /** Fornecedores convidados (quem ainda não respondeu primeiro): conversa das linhas da RFQ. */
  invited: { id: string; name: string; answered: boolean }[];
}

const LIVE_BRIEF = ["open", "ready", "transferred"];

export async function loadRequestStages(
  request: Request,
  now = new Date(),
): Promise<RequestStagesView> {
  const store = getStore();
  const [quotes, approvals, audits, brief, settings] = await Promise.all([
    store.list("quotes", { filter: { requestId: request.id } }),
    store
      .list("approvals", { filter: { requestId: request.id } })
      .catch((error: unknown) => {
        if (isSchemaMissing(error)) return [];
        throw error;
      }),
    store.list("audit_log", {
      filter: { entity: "request", entityId: request.id },
    }),
    briefForRequest(request.id),
    getSettings(),
  ]);
  const latestApproval =
    [...approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
    null;
  const lastAudit = (action: string) =>
    audits
      .filter((a) => a.action === action)
      .map((a) => a.createdAt)
      .sort()
      .at(-1) ?? null;
  const chosen = request.selectedQuoteId
    ? (quotes.find((q) => q.id === request.selectedQuoteId) ?? null)
    : null;
  // Faca: só com briefing vivo que pede a faca (ou já tem uma enviada).
  const liveBrief = brief && LIVE_BRIEF.includes(brief.status) ? brief : null;
  const dielineDoc = liveBrief?.dielineDocumentId
    ? await store.get("documents", liveBrief.dielineDocumentId)
    : null;
  const dieline =
    liveBrief &&
    (liveBrief.requiredKeys.includes("dieline") || liveBrief.dielineDocumentId)
      ? { dueAt: liveBrief.dueAt, doneAt: dielineDoc?.createdAt ?? null }
      : null;
  const partyIds = [...new Set(quotes.map((q) => q.supplierId))];
  const parties = partyIds.length
    ? await store.list("parties", { filter: { id: partyIds } })
    : [];
  const supplierParty = chosen
    ? (parties.find((p) => p.id === chosen.supplierId) ?? null)
    : null;
  const invited = quotes
    .map((q) => ({
      id: q.supplierId,
      name: parties.find((p) => p.id === q.supplierId)?.name ?? "—",
      answered: !!q.answeredAt,
    }))
    .sort((a, b) => Number(a.answered) - Number(b.answered));
  const rows = requestStages({
    status: request.status,
    createdAt: request.createdAt,
    quotes: quotes.map((q) => ({
      createdAt: q.createdAt,
      answeredAt: q.answeredAt,
      status: q.status,
    })),
    approval: latestApproval
      ? {
          status: latestApproval.status,
          createdAt: latestApproval.createdAt,
          decidedAt: latestApproval.decidedAt,
          levels: latestApproval.levels,
          currentLevel: latestApproval.currentLevel,
        }
      : null,
    selectedAt: request.selectedQuoteId ? lastAudit("quote.select") : null,
    dieline,
    superplan: request.origin === "superplan",
    proposalApprovedAt: request.proposalApprovedAt ?? null,
    downConfirmedAt: lastAudit("payment.confirm"),
    days: requestStepDays(settings.requestStepDays),
    now,
  });
  return {
    rows,
    supplier: supplierParty
      ? { id: supplierParty.id, name: supplierParty.name }
      : null,
    invited,
  };
}
