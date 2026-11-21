import "server-only";
import { orderRequest } from "@/lib/services/order-request";

import {
  getStore,
  type Order,
  type OrderItem,
  type Party,
  type Requirement,
  type User,
} from "@/lib/db";
import { stepOfItem } from "@/lib/milestones";
import { ForbiddenError, canViewOrder } from "@/lib/auth/permissions";
import { cargoFor, type Cargo } from "./freight";

/*
 * O que o transportador precisa do pedido: a mercadoria e a carga (caixas,
 * volume e peso previstos na ficha de compra), quando o navio chega e a
 * alfândega libera, e onde entregar (o cliente do pedido). Nada de preços,
 * fornecedor ou itens dos outros.
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

/** Item concluído do pedido pelo passo e pela chave (fase 5g), ou null. */
function doneValue(
  requirements: readonly Requirement[],
  step: string,
  key: string,
): Requirement | null {
  return (
    requirements.find(
      (r) => r.key === key && r.status === "done" && stepOfItem(r) === step,
    ) ?? null
  );
}

const SHIPMENT = "production/shipment";
const CUSTOMS = "delivery/cargo-presence";

export async function cargoViewForOrder(
  user: User,
  order: Order,
  loaded: {
    items: readonly OrderItem[];
    requirements: readonly Requirement[];
    parties: readonly Party[];
  },
): Promise<CargoView> {
  if (!canViewOrder(user, order)) throw new ForbiddenError();
  const store = getStore();
  const [request, [sheet]] = await Promise.all([
    orderRequest(order, store),
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
      doneValue(loaded.requirements, SHIPMENT, "ship_date")?.value ?? null,
    eta: doneValue(loaded.requirements, SHIPMENT, "eta")?.value ?? null,
    vessel: doneValue(loaded.requirements, SHIPMENT, "vessel")?.value ?? null,
    releasedAt:
      doneValue(loaded.requirements, CUSTOMS, "release")?.submittedAt ?? null,
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
