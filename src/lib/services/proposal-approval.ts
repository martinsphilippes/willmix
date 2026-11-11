import "server-only";

import { getStore, type Request, type User } from "@/lib/db";
import {
  ForbiddenError,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notifyWellmix } from "./notifications";
import { isSchemaMissing } from "@/lib/db/errors";

/*
 * Etapa "Proposta ao cliente" (src/lib/request-stages.ts): depois da escolha
 * do fornecedor (e da aprovação do pré-custo), o cliente aprova a proposta e
 * só então vê os dados para pagar o sinal. A Wellmix pode registrar a
 * aprovação que o cliente deu por telefone, e-mail ou WhatsApp; confirmar o
 * sinal (ou o cliente mandar o comprovante) também conta como aprovação.
 */

export class ProposalError extends Error {}

/** A proposta já foi aprovada (pelo cliente, registrada pela Wellmix ou pelo sinal)? */
export const proposalApproved = (
  request: Pick<Request, "status" | "proposalApprovedAt">,
  proofSent = false,
) => request.status === "ORDERED" || !!request.proposalApprovedAt || proofSent;

/**
 * "Aprovar proposta" (cliente que vê a solicitação) ou "Registrar aprovação
 * do cliente" (Wellmix). Só com a proposta enviada (aguardando sinal); já
 * aprovada, não faz nada.
 */
export async function approveProposal(
  user: User,
  requestId: string,
): Promise<Request> {
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request || !canViewRequest(user, request))
    throw new ProposalError("not_found");
  // Fornecedores e parceiros nunca veem a solicitação; o cliente só a dele.
  if (!isWellmix(user) && user.role !== "customer") throw new ForbiddenError();
  if (request.status !== "WAITING_DOWN_PAYMENT")
    throw new ProposalError("invalid_status");
  if (request.proposalApprovedAt) return request;
  let updated: Request;
  try {
    updated = await store.update("requests", request.id, {
      proposalApprovedAt: new Date().toISOString(),
      proposalApprovedByUserId: user.id,
    });
  } catch (error) {
    if (isSchemaMissing(error)) throw new ProposalError("schema_outdated");
    throw error;
  }
  const byWellmix = isWellmix(user);
  await audit(
    user,
    "proposal.approve",
    "request",
    request.id,
    byWellmix
      ? "Aprovação do cliente registrada pela Wellmix"
      : "Proposta aprovada pelo cliente",
  );
  if (!byWellmix)
    await notifyWellmix({
      kind: "info",
      subject: `Proposta aprovada: ${request.productName}`,
      body: "O cliente aprovou a proposta e agora paga o sinal. Confira o recebimento e confirme o sinal para criar o pedido.",
      link: `/app/requests/${request.id}`,
    });
  return updated;
}

/**
 * O sinal confirmado ou o comprovante enviado valem como aprovação da
 * proposta (sem aviso). Coluna ainda não publicada: segue sem gravar.
 */
export async function markProposalApproved(
  user: User,
  request: Request,
): Promise<void> {
  if (request.proposalApprovedAt) return;
  try {
    await getStore().update("requests", request.id, {
      proposalApprovedAt: new Date().toISOString(),
      proposalApprovedByUserId: user.id,
    });
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
  }
}
