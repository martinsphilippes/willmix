import "server-only";
import { getStore } from "@/lib/db";
import type { Document, Order, Requirement, User } from "@/lib/db/schema";
import { isWellmix } from "@/lib/auth/permissions";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { itemIdOf, laneKey, LANE_KEYS } from "@/lib/purchase-lanes";
import {
  dieCutItemOf,
  dieCutHref,
  dieCutProducts,
  type DieCutProduct,
} from "@/lib/die-cut-step";
import { isOrderSupplier } from "./order-signature";

/*
 * Quadro "Die Cut" do pedido de compra (decisão do dono, 13/11/2026): os
 * quatro itens do fornecedor, produto a produto, numa tela própria
 * (/app/orders/{id}/die-cut). Nada novo no banco: são os requisitos da raia
 * do fornecedor (docs/PURCHASE_ORDER.md, seção 2). O pedido mínimo e o prazo
 * negociados vêm da resposta dele à solicitação ao fornecedor.
 */

export interface DieCutViewProduct extends DieCutProduct<Requirement> {
  /** Negociados na solicitação ao fornecedor (o que ele confere e confirma). */
  negotiatedMoq: number | null;
  negotiatedLeadTimeDays: number | null;
}

export interface DieCutView {
  order: Order;
  /** A etapa está aberta: ainda dá para enviar e corrigir. */
  open: boolean;
  /** Quem vê pode enviar os itens (o fornecedor do pedido ou a Wellmix). */
  canAct: boolean;
  products: DieCutViewProduct[];
  documents: Map<string, Document>;
}

/** Só a Wellmix e o fornecedor do pedido abrem o quadro. */
export function canViewDieCut(user: User, order: Order): boolean {
  return (
    isPurchaseFlow(order) && (isWellmix(user) || isOrderSupplier(user, order))
  );
}

/**
 * Pedido mínimo e prazo negociados de cada item do pedido (por id do item):
 * a resposta do fornecedor à solicitação, já com o que a negociação mudou.
 * Também preenche o campo do prazo na visão do fornecedor da Preparação.
 */
export async function negotiatedTerms(
  order: Pick<Order, "id" | "parentOrderId">,
) {
  const store = getStore();
  const [items, requests] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    // Rodada de uma programação de compra: a negociação é a do pedido pai.
    store.list("supplier_requests", {
      filter: { orderId: order.parentOrderId ?? order.id },
    }),
  ]);
  const out = new Map<string, { moq: number | null; days: number | null }>();
  for (const item of items) {
    const r = requests.find((x) => x.productId === item.productId);
    out.set(item.id, {
      moq: r?.supplierMoq ?? r?.item.moq ?? null,
      days: r?.supplierLeadTimeDays ?? null,
    });
  }
  return out;
}

export async function getDieCutView(
  user: User,
  orderId: string,
): Promise<DieCutView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewDieCut(user, order)) return null;
  const [stages, requirements, terms] = await Promise.all([
    store.list("stages", { filter: { orderId, key: "PREPARATION" } }),
    store.list("requirements", { filter: { orderId } }),
    negotiatedTerms(order),
  ]);
  const stage = stages[0];
  const mine = requirements
    .filter((r) => !stage || r.stageId === stage.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const products = dieCutProducts(mine).map((p) => ({
    ...p,
    negotiatedMoq: terms.get(p.itemId)?.moq ?? null,
    negotiatedLeadTimeDays: terms.get(p.itemId)?.days ?? null,
  }));
  const docIds = products
    .flatMap((p) => [p.items.dieline?.documentId, p.items.hd?.documentId])
    .filter((id): id is string => !!id);
  const docs = docIds.length
    ? await store.list("documents", { filter: { id: docIds } })
    : [];
  return {
    order,
    open: !!stage && (stage.status === "active" || stage.status === "blocked"),
    canAct: isWellmix(user) || isOrderSupplier(user, order),
    products,
    documents: new Map(docs.map((d) => [d.id, d])),
  };
}

/**
 * Confirma (ou corrige) o pedido mínimo e o prazo de entrega de um produto
 * de uma vez. Com o quadro já completo, a mudança de valor avisa a Wellmix
 * com o número de antes.
 */
export async function confirmDieCutTerms(
  user: User,
  orderId: string,
  itemId: string,
  input: { moq: number; leadTimeDays: number },
): Promise<void> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewDieCut(user, order)) throw new Error("not_found");
  const requirements = await store.list("requirements", {
    filter: { orderId },
  });
  const moq = requirements.find(
    (r) => r.key === laneKey(LANE_KEYS.moq, itemId),
  );
  const lead = requirements.find(
    (r) => r.key === laneKey(LANE_KEYS.leadTime, itemId),
  );
  if (!moq || !lead) throw new Error("not_found");
  const product = dieCutProducts(requirements).find((p) => p.itemId === itemId);
  const wasComplete = !!product?.complete;
  const before = { moq: moq.value, days: lead.value };
  const { submitRequirement } = await import("@/lib/workflow/engine");
  await submitRequirement(user, moq.id, { value: String(input.moq) });
  await submitRequirement(user, lead.id, {
    value: String(input.leadTimeDays),
  });
  if (
    wasComplete &&
    (before.moq !== String(input.moq) ||
      before.days !== String(input.leadTimeDays))
  )
    await notifyDieCut(order, itemId, product?.name ?? "", {
      moq: String(input.moq),
      days: String(input.leadTimeDays),
      before: { moq: before.moq ?? "—", days: before.days ?? "—" },
    });
}

async function notifyDieCut(
  order: Order,
  itemId: string,
  product: string,
  values: {
    moq: string;
    days: string;
    before: { moq: string | number; days: string | number } | null;
  },
) {
  const { notifyWellmix } = await import("./notifications");
  await notifyWellmix({
    kind: "action",
    link: dieCutHref(order.id, itemId),
    text: (t) => ({
      subject: `${t("supplierTasks.orderStep", {
        n: order.number,
        step: t(
          values.before
            ? "notif.dieCut.changedSubject"
            : "notif.dieCut.subject",
          { product },
        ),
      })}`,
      body: [
        t("notif.dieCut.body", { moq: values.moq, days: values.days }),
        values.before
          ? t("notif.dieCut.changed", {
              moq: values.before.moq,
              days: values.before.days,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    }),
  }).catch((error) => console.error("notify(die_cut)", error));
}

/**
 * Depois de um item do Die Cut ser enviado pela primeira vez: com os quatro
 * feitos, a Wellmix é avisada (com o número de antes, se o pedido mínimo ou
 * o prazo saíram diferentes do negociado).
 */
export async function afterDieCutItem(
  order: Order,
  key: string,
  statusBefore: Requirement["status"] | undefined,
): Promise<void> {
  const itemId = itemIdOf(key);
  if (!itemId || !dieCutItemOf(key) || statusBefore === "done") return;
  const requirements = await getStore().list("requirements", {
    filter: { orderId: order.id },
  });
  const product = dieCutProducts(requirements).find((p) => p.itemId === itemId);
  if (!product?.complete) return;
  const moq = product.items.moq?.value ?? "—";
  const days = product.items.leadTime?.value ?? "—";
  const negotiated = (await negotiatedTerms(order)).get(itemId);
  const changed =
    (negotiated?.moq != null && String(negotiated.moq) !== moq) ||
    (negotiated?.days != null && String(negotiated.days) !== days);
  await notifyDieCut(order, itemId, product.name, {
    moq,
    days,
    before: changed
      ? { moq: negotiated?.moq ?? "—", days: negotiated?.days ?? "—" }
      : null,
  });
}
