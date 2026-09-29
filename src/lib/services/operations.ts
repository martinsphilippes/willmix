import "server-only";

import {
  getStore,
  type OperationMode,
  type Order,
  type Party,
  type RadarStatus,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { openReview } from "./reviews";

/**
 * Modalidade de operação do cliente: importação própria (precisa de RADAR),
 * via estrutura/trade da Wellmix, ou outra. Nada é presumido: cadastro antigo
 * fica "não informado" e nenhum gate dispara. O pedido copia a modalidade do
 * cliente no momento da criação (snapshot).
 */
export async function setCustomerOperation(
  user: User,
  partyId: string,
  input: {
    operationMode: OperationMode | null;
    radar: RadarStatus | null;
    radarNotes?: string | null;
  },
) {
  assertWellmix(user);
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party) throw new Error("not_found");
  if (party.type !== "customer") throw new Error("not_customer");
  const patch: Partial<Party> = {
    operationMode: input.operationMode,
    radar: input.radar,
    radarNotes: input.radarNotes ?? null,
  };
  const updated = await store.update("parties", partyId, patch);
  await audit(
    user,
    "party.operation",
    "party",
    partyId,
    `${input.operationMode ?? "—"} · RADAR ${input.radar ?? "—"}`,
    {
      operationMode: party.operationMode,
      radar: party.radar,
      radarNotes: party.radarNotes,
    },
    patch,
  );
  return updated;
}

/** Importação própria sem RADAR informado ou "sem habilitação": exige decisão da Wellmix. */
export function radarProblem(customer: Pick<Party, "operationMode" | "radar">) {
  if (customer.operationMode !== "own_import") return null;
  if (customer.radar === null) return "RADAR do cliente não informado";
  if (customer.radar === "none") return "Cliente sem habilitação RADAR";
  return null;
}

/**
 * Gate na criação do pedido: copia a modalidade do cliente para o pedido e,
 * se for importação própria sem RADAR, abre item de revisão (não bloqueia).
 */
export async function runOperationGate(user: User | null, order: Order) {
  const store = getStore();
  const customer = await store.get("parties", order.customerId);
  if (!customer) return null;
  if (customer.operationMode && order.operationMode !== customer.operationMode)
    await store.update("orders", order.id, {
      operationMode: customer.operationMode,
    });
  const settings = await getSettings();
  if (!settings.radarGateEnabled) return null;
  const problem = radarProblem(customer);
  if (!problem) return null;
  await openReview(user, {
    orderId: order.id,
    entity: "order",
    entityId: order.id,
    rule: "customer.radarMissing",
    problem: `${problem} (importação própria)`,
    expected: "RADAR habilitado ou operação via trade",
    found: customer.radar ?? "não informado",
    responsibleRole: "operator",
    action:
      "Confirmar a modalidade da operação no cadastro do cliente (importação própria exige RADAR; senão, via trade).",
    link: `/app/parties/${customer.id}`,
  });
  await audit(user, "operation.gate", "order", order.id, problem);
  return problem;
}
