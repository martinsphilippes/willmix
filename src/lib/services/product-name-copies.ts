import "server-only";

import { getStore, type Product, type User } from "@/lib/db";
import {
  nameOfLabel,
  realName,
  titleOfLabel,
  titleWithName,
  withoutPlaceholder,
} from "@/lib/placeholder-name";
import { itemIdOf } from "@/lib/purchase-lanes";
import {
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
} from "@/lib/workflow/stages";
import { audit } from "./audit";

/*
 * O produto ganhou o nome real (docs/PURCHASE_ORDER.md, "Nome de exemplo").
 * O pedido guarda cópias do nome: no item do pedido, no rótulo de cada tarefa
 * do produto e na solicitação do pedido. As que ficaram vazias ou com o nome
 * de exemplo ("Produto novo XPTO") recebem o nome agora; cópia com nome real
 * não é tocada (é o retrato do pedido). Status, vínculos e respostas das
 * tarefas ficam como estão: só o texto muda.
 *
 * Pedido encerrado, cancelado ou com o documento já assinado (por qualquer
 * lado) fica como está: o contrato assinado não muda sozinho.
 */

const SIGNATURES = new Set<string>([
  ORDER_SIGNED_WELLMIX,
  ORDER_SIGNED_SUPPLIER,
]);
const FINISHED = new Set<string>(["CLOSED", "CANCELLED"]);

export interface NameCopies {
  items: number;
  tasks: number;
  requests: number;
}

const unique = (ids: Array<string | null | undefined>) => [
  ...new Set(ids.filter((id): id is string => !!id)),
];

export async function fillProductNameCopies(
  user: User,
  product: Pick<Product, "id" | "name">,
): Promise<NameCopies> {
  const done: NameCopies = { items: 0, tasks: 0, requests: 0 };
  const name = realName(product.name);
  if (!name) return done;
  const store = getStore();
  const [items, requests] = await Promise.all([
    store.list("order_items", { filter: { productId: product.id } }),
    store.list("requests", { filter: { productId: product.id } }),
  ]);
  const unnamed = items.filter((i) => !realName(i.name));
  const orderIds = unique([
    ...unnamed.map((i) => i.orderId),
    ...requests.map((r) => r.orderId),
  ]);
  const [orders, requirements] = orderIds.length
    ? await Promise.all([
        store.list("orders", { filter: { id: orderIds } }),
        store.list("requirements", { filter: { orderId: orderIds } }),
      ])
    : [[], []];
  const signed = new Set(
    requirements
      .filter((r) => SIGNATURES.has(r.key) && r.status === "done")
      .map((r) => r.orderId),
  );
  // Pedidos que ainda podem receber o nome.
  const open = new Set(
    orders
      .filter((o) => !FINISHED.has(o.status) && !signed.has(o.id))
      .map((o) => o.id),
  );

  const renamed = unnamed.filter((i) => open.has(i.orderId));
  for (const item of renamed) {
    await store.update("order_items", item.id, { name });
    done.items++;
  }
  // Tarefas do produto (a chave leva o item do pedido), só as sem nome real.
  const itemIds = new Set(renamed.map((i) => i.id));
  for (const r of requirements) {
    const itemId = itemIdOf(r.key);
    if (!itemId || !itemIds.has(itemId) || nameOfLabel(r.label)) continue;
    const label = titleWithName(titleOfLabel(r.label), name);
    if (label === r.label) continue;
    await store.update("requirements", r.id, { label });
    done.tasks++;
  }
  // Solicitação do produto (sem pedido, ou com o pedido ainda aberto).
  for (const request of requests) {
    if (request.orderId && !open.has(request.orderId)) continue;
    const patch: { productName?: string; description?: string } = {};
    if (!realName(request.productName)) patch.productName = name;
    if (request.description) {
      const description = withoutPlaceholder(request.description, name);
      if (description !== request.description) patch.description = description;
    }
    if (!Object.keys(patch).length) continue;
    await store.update("requests", request.id, patch);
    done.requests++;
  }
  if (done.items || done.tasks || done.requests)
    await audit(
      user,
      "product.name_copies",
      "product",
      product.id,
      `${name}: nome levado a ${done.items} item(ns) de pedido, ${done.tasks} tarefa(s) e ${done.requests} solicitação(ões) que estavam sem nome`,
    );
  return done;
}
