import "server-only";

import {
  getStore,
  type Order,
  type OrderItem,
  type Party,
  type Requirement,
  type Stage,
  type User,
} from "@/lib/db";
import { ForbiddenError, canViewOrder } from "@/lib/auth/permissions";
import { cargoFor, type Cargo } from "./freight";

/*
 * O que o transportador precisa do pedido: a mercadoria e a carga (caixas,
 * volume e peso previstos na ficha de compra), quando o navio chega e a
 * alfândega libera, e onde entregar (o cliente do pedido). Nada de preços,
 * fornecedor ou etapas dos outros.
 */

export interface CargoView extends Cargo {
  items: Pick<OrderItem, "name" | "quantity" | "unit">[];
  /** Data de embarque, previsão de chegada e navio (AAAA-MM-DD / texto), se informados. */
  shipDate: string | null;
  eta: string | null;
  vessel: string | null;
  /** Liberação aduaneira: quando foi confirmada (ISO), ou null. */
  releasedAt: string | null;
  /** Onde entregar: o cliente do pedido (null se não houver cadastro). */
  deliverTo: Pick<
    Party,
    "name" | "address" | "city" | "phone" | "contactName"
  > | null;
}

/** Valor de um item concluído da etapa (`stageKey`/`key`), ou null. */
function doneValue(
  stages: readonly Stage[],
  requirements: readonly Requirement[],
  stageKey: string,
  key: string,
): Requirement | null {
  const stage = stages.find((s) => s.key === stageKey);
  if (!stage) return null;
  return (
    requirements.find(
      (r) => r.stageId === stage.id && r.key === key && r.status === "done",
    ) ?? null
  );
}

export async function cargoViewForOrder(
  user: User,
  order: Order,
  loaded: {
    items: readonly OrderItem[];
    stages: readonly Stage[];
    requirements: readonly Requirement[];
    parties: readonly Party[];
  },
): Promise<CargoView> {
  if (!canViewOrder(user, order)) throw new ForbiddenError();
  const store = getStore();
  const [request, [sheet]] = await Promise.all([
    store.get("requests", order.requestId),
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
  ]);
  const first = loaded.items[0];
  // Caixas, CBM e peso como na cotação de frete (ficha de compra do pedido).
  const cargo =
    request || first
      ? cargoFor(
          request ?? { quantity: first.quantity, unit: first.unit },
          sheet ?? null,
        )
      : { totalCbm: null, cartons: null, grossWeightKg: null };
  const customer = loaded.parties.find((p) => p.id === order.customerId);
  return {
    ...cargo,
    items: loaded.items.map(({ name, quantity, unit }) => ({
      name,
      quantity,
      unit,
    })),
    shipDate:
      doneValue(loaded.stages, loaded.requirements, "SHIPPING", "ship_date")
        ?.value ?? null,
    eta:
      doneValue(loaded.stages, loaded.requirements, "SHIPPING", "eta")?.value ??
      null,
    vessel:
      doneValue(loaded.stages, loaded.requirements, "SHIPPING", "vessel")
        ?.value ?? null,
    releasedAt:
      doneValue(loaded.stages, loaded.requirements, "CUSTOMS", "release")
        ?.submittedAt ?? null,
    deliverTo: customer
      ? {
          name: customer.name,
          address: customer.address ?? null,
          city: customer.city ?? null,
          phone: customer.phone ?? null,
          contactName: customer.contactName ?? null,
        }
      : null,
  };
}
