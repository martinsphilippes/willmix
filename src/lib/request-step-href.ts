import type { NextStep } from "@/lib/services/request-list";
import {
  isSupplierRequestStep,
  supplierRequestStepHref,
} from "@/lib/supplier-request-sampling";

/*
 * Onde se faz o passo da encomenda (dono, 24/11/2026: "o status tem que ser
 * clicável e direcionar para o local certo... padrão em toda linha de tabela
 * que tenha status"): o mesmo lugar da pendência de cada passo. Regra pura,
 * sem banco nem tela; as listas (Encomendas, Reposição) usam no selo do
 * status e na Próxima ação.
 */

/** As telas que o login abre (cada lugar pede a sua). */
export interface StepAccess {
  /** Encomendas (a encomenda, a confirmação e o envio para cotação). */
  requests: boolean;
  /** Estratégia de compra. */
  strategy: boolean;
  /** Cotação (cotação de compra e solicitação ao fornecedor). */
  quotes: boolean;
  /** Pedidos. */
  orders: boolean;
}

/** O lugar de agir no passo; nulo quando não há lugar ou o login não abre. */
export function requestStepHref(
  step: Pick<NextStep, "key" | "supplierRequestId" | "quoteId" | "decisionId">,
  request: { id: string; groupId?: string | null; orderId?: string | null },
  can: StepAccess,
): string | null {
  const enc = encodeURIComponent;
  switch (step.key) {
    // A venda aguardando o cliente: o cartão da confirmação na encomenda (o
    // mesmo link de "Confirmar pedido" e de "Login do cliente a definir").
    case "confirm":
    case "login":
      return can.requests ? `/app/requests/${enc(request.id)}` : null;
    // Encomenda nova ou a enviar para cotação: a página dela, com o envio.
    case "new":
    case "send":
      return can.requests
        ? `/app/requests/batch/${enc(request.groupId ?? request.id)}`
        : null;
    case "strategy":
      return can.strategy ? "/app/purchase-strategy" : null;
    // Aprovar a estratégia ou gerar o pedido direto: a decisão em andamento.
    case "strategy_approve":
    case "strategy_order":
      return can.strategy
        ? `/app/purchase-strategy?tab=open${step.decisionId ? `#decision-${enc(step.decisionId)}` : ""}`
        : null;
    // Cotação de compra: o quadro dela (responder, escolher, aprovar).
    case "quote_answer":
    case "quote_choose":
    case "quote_empty":
    case "quote_approve":
      return can.quotes && step.quoteId
        ? `/app/purchase-quotes/${enc(step.quoteId)}`
        : null;
    // Gerar o pedido de compra: o quadro com a solicitação aprovada marcada.
    case "purchase_order":
      return can.quotes && step.supplierRequestId
        ? `/app/supplier-requests?tab=closed&pick=${enc(step.supplierRequestId)}#pedido-de-compra`
        : null;
    // Pedido gerado: o pedido, com a etapa atual e os itens dela.
    case "order":
      return can.orders && request.orderId
        ? `/app/orders/${enc(request.orderId)}`
        : null;
    default:
      // Responder, decidir, enviar ou validar a amostragem: a solicitação.
      return can.quotes &&
        step.supplierRequestId &&
        isSupplierRequestStep(step.key)
        ? supplierRequestStepHref(step.supplierRequestId, step.key)
        : null;
  }
}
