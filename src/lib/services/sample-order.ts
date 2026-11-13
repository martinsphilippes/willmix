import "server-only";

import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { getStore, type Order, type Requirement, type User } from "@/lib/db";
import {
  SAMPLE_ORDER_KEY,
  SAMPLE_ORDER_SUPPLIER_KEY,
} from "@/lib/purchase-lanes";
import {
  parseSampleAcceptance,
  parseSampleOrder,
  sampleLines,
  sampleOrderHash,
  type SampleAcceptance,
  type SampleLine,
  type SampleOrderDoc,
} from "@/lib/sample-order";
import { submitRequirement } from "@/lib/workflow/engine";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";

/*
 * Pedido de amostras do pedido de compra (docs/SAMPLE_ORDER.md): contrato
 * secundário, à parte do documento do pedido. A Wellmix gera (5 × 3 peças
 * por variante de cada produto, para o show room no Brasil e a agência de
 * marketing na China) ou marca "sem amostras"; o fornecedor aceita. A
 * assinatura da Wellmix no contrato espera a decisão.
 */

export class SampleOrderError extends Error {}

const isOrderSupplier = (user: User, order: Pick<Order, "supplierId">) =>
  user.role === "supplier" &&
  !!user.partyId &&
  user.partyId === order.supplierId;

export interface SampleOrderView {
  order: Order;
  /** O pedido tem os itens do pedido de amostras (pedidos de compra novos). */
  applies: boolean;
  /** Linhas pela regra (o que seria gerado agora). */
  proposal: SampleLine[];
  doc: SampleOrderDoc | null;
  acceptance: SampleAcceptance | null;
  /** O contrato está aberto (etapa do contrato em andamento). */
  open: boolean;
  canDecide: boolean;
  canAccept: boolean;
}

async function sampleRequirements(orderId: string) {
  const all = await getStore().list("requirements", { filter: { orderId } });
  return {
    decide: all.find((r) => r.key === SAMPLE_ORDER_KEY) ?? null,
    accept: all.find((r) => r.key === SAMPLE_ORDER_SUPPLIER_KEY) ?? null,
  };
}

async function stageOpen(req: Requirement | null) {
  if (!req) return false;
  const stage = await getStore().get("stages", req.stageId);
  return stage?.status === "active" || stage?.status === "blocked";
}

/** As linhas pela regra: variantes ativas de cada produto do pedido. */
async function proposalFor(orderId: string): Promise<SampleLine[]> {
  const store = getStore();
  const items = await store.list("order_items", { filter: { orderId } });
  const { listProductVariants } = await import("./product-variants");
  const rows = [];
  for (const item of [...items].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const variants = item.productId
      ? (await listProductVariants(item.productId)).length
      : 0;
    rows.push({
      id: item.id,
      productId: item.productId ?? null,
      name: item.name,
      variants,
    });
  }
  return sampleLines(rows);
}

export async function getSampleOrderView(
  user: User,
  orderId: string,
): Promise<SampleOrderView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) return null;
  if (!isWellmix(user) && !isOrderSupplier(user, order)) return null;
  const reqs = await sampleRequirements(order.id);
  const doc = parseSampleOrder(reqs.decide?.value);
  const acceptance = parseSampleAcceptance(reqs.accept?.value);
  const live = order.status !== "CANCELLED" && order.status !== "CLOSED";
  const open = live && (await stageOpen(reqs.decide));
  return {
    order,
    applies: !!reqs.decide,
    proposal: await proposalFor(order.id),
    doc,
    acceptance,
    open,
    canDecide:
      open && isWellmix(user) && !!reqs.decide && reqs.decide.status !== "done",
    canAccept:
      open &&
      isOrderSupplier(user, order) &&
      doc?.status === "ordered" &&
      !!reqs.accept &&
      reqs.accept.status !== "done",
  };
}

/**
 * A Wellmix decide: gera o pedido de amostras pela regra ou marca "sem
 * amostras" (aí o aceite do fornecedor fica dispensado).
 */
export async function decideSampleOrder(
  user: User,
  orderId: string,
  input: { status: "ordered" | "none"; note?: string | null },
): Promise<SampleOrderDoc> {
  if (!isWellmix(user)) throw new ForbiddenError();
  assertScreen(user, "orders");
  const view = await getSampleOrderView(user, orderId);
  if (!view || !view.applies)
    throw new SampleOrderError("sample_order_not_applicable");
  if (!view.open) throw new SampleOrderError("sample_order_closed");
  if (view.doc) throw new SampleOrderError("sample_order_already_done");
  const reqs = await sampleRequirements(orderId);
  const lines = input.status === "ordered" ? view.proposal : [];
  if (input.status === "ordered" && !lines.length)
    throw new SampleOrderError("sample_order_no_items");
  const doc: SampleOrderDoc = {
    status: input.status,
    lines,
    note: input.note?.trim() || null,
    at: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    hash: sampleOrderHash(orderId, input.status, lines),
  };
  await submitRequirement(user, reqs.decide!.id, {
    value: JSON.stringify(doc),
    sampleOrder: true,
  });
  const order = view.order;
  await audit(
    user,
    input.status === "ordered"
      ? "order.sample_order"
      : "order.sample_order_none",
    "order",
    orderId,
    input.status === "ordered"
      ? `Pedido de amostras do pedido #${order.number}: ${lines
          .map((l) => `${l.name} ${l.quantity} pç (${l.variants} variante(s))`)
          .join(", ")}`
      : `Pedido #${order.number} sem amostras${doc.note ? `: ${doc.note}` : ""}`,
  );
  if (input.status === "none") {
    // Sem amostras: o aceite do fornecedor não se aplica.
    if (reqs.accept && reqs.accept.status !== "done")
      await submitRequirement(user, reqs.accept.id, {
        value: "not_applicable",
        note: "Sem amostras neste pedido",
        sampleOrder: true,
      });
  } else {
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        kind: "action",
        link: `/app/orders/${orderId}/samples`,
        text: (t) => ({
          subject: t("sampleOrder.notify.supplier.subject", {
            n: String(order.number),
          }),
          body: t("sampleOrder.notify.supplier.body"),
        }),
      },
    );
  }
  return doc;
}

/** O fornecedor aceita o pedido de amostras (nome completo + "li e concordo"). */
export async function acceptSampleOrder(
  user: User,
  orderId: string,
  input: { name: string; agree: boolean; hash: string },
): Promise<SampleAcceptance> {
  const view = await getSampleOrderView(user, orderId);
  if (!view) throw new ForbiddenError();
  if (!view.canAccept || !view.doc)
    throw new SampleOrderError("sample_order_not_open");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120)
    throw new SampleOrderError("signature_name_required");
  if (!input.agree) throw new SampleOrderError("signature_agree_required");
  if (input.hash !== view.doc.hash)
    throw new SampleOrderError("signature_document_changed");
  const acceptance: SampleAcceptance = {
    name,
    userId: user.id,
    userName: user.name,
    at: new Date().toISOString(),
    hash: view.doc.hash,
  };
  const reqs = await sampleRequirements(orderId);
  await submitRequirement(user, reqs.accept!.id, {
    value: JSON.stringify(acceptance),
    sampleOrder: true,
  });
  await audit(
    user,
    "order.sample_order_accepted",
    "order",
    orderId,
    `Pedido de amostras do pedido #${view.order.number} aceito por ${name}`,
  );
  await notifyWellmix({
    kind: "info",
    subject: `Pedido #${view.order.number}: pedido de amostras aceito`,
    body: `${name} aceitou o pedido de amostras (show room no Brasil e agência de marketing na China).`,
    link: `/app/orders/${orderId}/samples`,
  });
  return acceptance;
}
