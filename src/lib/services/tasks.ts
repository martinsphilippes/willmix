import "server-only";

import { getStore, type Order, type Request, type User } from "@/lib/db";
import { isWillmix } from "@/lib/auth/permissions";
import { ROLE_PARTY_FIELD } from "@/lib/workflow/stages";

export interface Task {
  kind:
    | "requirement"
    | "quote"
    | "select_supplier"
    | "confirm_payment"
    | "pay"
    | "rfq";
  title: string;
  detail: string;
  link: string;
  dueAt: string | null;
  overdue: boolean;
  orderNumber?: number;
}

/** Pendências do usuário: o que ele precisa fazer agora. */
export async function pendingTasksFor(user: User): Promise<Task[]> {
  const store = getStore();
  const tasks: Task[] = [];
  const now = Date.now();

  // Requisitos pendentes em etapas ativas/bloqueadas.
  const stages = await store.list("stages", {
    filter: { status: ["active", "blocked"] },
  });
  for (const stage of stages) {
    const order = await store.get("orders", stage.orderId);
    if (!order) continue;
    if (!isInvolved(user, order)) continue;
    const requirements = await store.list("requirements", {
      filter: { stageId: stage.id, status: ["pending", "rejected"] },
    });
    const mine = requirements.filter(
      (r) => isWillmix(user) || r.role === user.role,
    );
    if (mine.length === 0) continue;
    tasks.push({
      kind: "requirement",
      title: `Pedido #${order.number}: ${stage.key}`,
      detail: mine.map((r) => r.label).join(", "),
      link: `/app/orders/${order.id}`,
      dueAt: stage.dueAt,
      overdue: !!stage.dueAt && Date.parse(stage.dueAt) < now,
      orderNumber: order.number,
    });
  }

  // Fase de solicitação.
  if (user.role === "supplier" && user.partyId) {
    const quotes = await store.list("quotes", {
      filter: { supplierId: user.partyId, status: "invited" },
    });
    for (const quote of quotes) {
      const request = await store.get("requests", quote.requestId);
      if (!request) continue;
      tasks.push({
        kind: "quote",
        title: `RFQ: ${request.productName}`,
        detail: `${request.quantity} ${request.unit}`,
        link: `/app/quotes/${quote.id}`,
        dueAt: quote.validUntil,
        overdue: !!quote.validUntil && Date.parse(quote.validUntil) < now,
      });
    }
  }
  if (isWillmix(user)) {
    const requests = await store.list("requests", {
      filter: {
        status: ["REQUESTED", "QUOTATION_RECEIVED", "WAITING_DOWN_PAYMENT"],
      },
    });
    for (const request of requests) tasks.push(requestTask(request));
  }
  if (user.role === "customer" && user.partyId) {
    const requests = await store.list("requests", {
      filter: { customerId: user.partyId, status: "WAITING_DOWN_PAYMENT" },
    });
    for (const request of requests) {
      tasks.push({
        kind: "pay",
        title: `Sinal pendente: ${request.productName}`,
        detail: `${request.sellCurrency ?? ""} ${request.downPaymentAmount?.toFixed(2) ?? ""}`,
        link: `/app/requests/${request.id}`,
        dueAt: null,
        overdue: false,
      });
    }
  }
  return tasks.sort((a, b) => Number(b.overdue) - Number(a.overdue));
}

function requestTask(request: Request): Task {
  const base = {
    link: `/app/requests/${request.id}`,
    dueAt: request.deadline,
    overdue: false,
  };
  switch (request.status) {
    case "REQUESTED":
      return {
        kind: "rfq",
        title: `Abrir RFQ: ${request.productName}`,
        detail: "Selecione fornecedores",
        ...base,
      };
    case "QUOTATION_RECEIVED":
      return {
        kind: "select_supplier",
        title: `Escolher fornecedor: ${request.productName}`,
        detail: "Cotações recebidas",
        ...base,
      };
    default:
      return {
        kind: "confirm_payment",
        title: `Confirmar sinal: ${request.productName}`,
        detail: "Aguardando pagamento do cliente",
        ...base,
      };
  }
}

export function isInvolved(user: User, order: Order): boolean {
  if (isWillmix(user)) return true;
  const field = ROLE_PARTY_FIELD[user.role];
  if (!field) return false;
  return order[field] === user.partyId;
}
