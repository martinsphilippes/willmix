import "server-only";

import { createHash } from "node:crypto";
import {
  getStore,
  type Order,
  type PaymentTermInstallment,
  type Requirement,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import {
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
} from "@/lib/workflow/stages";
import { submitRequirement } from "@/lib/workflow/engine";
import { packagingProposalState } from "@/lib/quote-flow";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";

/*
 * Documento do pedido com duas assinaturas (docs/ORDER_SIGNATURE.md): a
 * Wellmix assina primeiro (etapa "Pedido criado") e o fornecedor em seguida
 * (começo da Preparação). A assinatura é um aceite no portal: nome digitado,
 * quem, quando e a versão exata do documento (impressão digital SHA-256 do
 * conteúdo). Não é certificado digital.
 *
 * O documento mostra preço de compra e fornecedor: só a Wellmix e o
 * fornecedor do pedido abrem. Cliente e demais parceiros nunca.
 */

export class OrderSignatureError extends Error {}

export interface OrderDocumentItem {
  name: string;
  variant: string | null;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  total: number | null;
}

/** O conteúdo que as partes assinam. Mudou qualquer campo, muda a versão. */
export interface OrderDocument {
  orderNumber: number;
  supplierName: string;
  buyerName: string;
  currency: string;
  incoterm: string | null;
  items: OrderDocumentItem[];
  total: number | null;
  leadTimeDays: number | null;
  paymentTerms: PaymentTermInstallment[];
  /** A proposta de embalagem com o OK do fornecedor na cotação (versão). */
  packagingOkVersion: number | null;
}

export interface OrderSignature {
  side: "wellmix" | "supplier";
  /** Nome digitado por quem assinou. */
  name: string;
  userId: string;
  userName: string;
  at: string;
  /** Versão do documento assinada (SHA-256 do conteúdo). */
  hash: string;
  /**
   * Assinatura do fornecedor recebida por fora (papel, e-mail) e registrada
   * por um administrador da Wellmix: `userName` é quem registrou.
   */
  onBehalf?: boolean;
}

const round = (n: number, digits: number) =>
  Math.round(n * 10 ** digits) / 10 ** digits;

export function orderDocumentHash(doc: OrderDocument): string {
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}

/** Só a Wellmix e o fornecedor do pedido (o documento tem o preço de compra). */
export function canViewOrderDocument(
  user: User,
  order: Pick<Order, "supplierId">,
): boolean {
  if (isWellmix(user)) return true;
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    order.supplierId === user.partyId
  );
}

export async function buildOrderDocument(order: Order): Promise<OrderDocument> {
  const store = getStore();
  const { getSettings } = await import("@/lib/settings");
  const [items, supplier, [sheet], request, settings] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    store.get("parties", order.supplierId),
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
    store.get("requests", order.requestId),
    getSettings(),
  ]);
  const quote = request?.selectedQuoteId
    ? await store.get("quotes", request.selectedQuoteId)
    : null;
  const currency =
    order.fobCurrency ?? quote?.currency ?? sheet?.currency ?? "USD";
  const rows: OrderDocumentItem[] = [...items]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => {
      const unitPrice = item.unitPrice ?? quote?.price ?? sheet?.price ?? null;
      return {
        name: item.name,
        variant: item.variant?.name ?? null,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: unitPrice === null ? null : round(unitPrice, 4),
        total: unitPrice === null ? null : round(unitPrice * item.quantity, 2),
      };
    });
  const total = rows.every((r) => r.total !== null)
    ? round(
        rows.reduce((sum, r) => sum + (r.total ?? 0), 0),
        2,
      )
    : (order.fobTotal ?? null);
  return {
    orderNumber: order.number,
    supplierName: supplier?.name ?? "",
    buyerName: settings.importerName,
    currency,
    incoterm: sheet?.incoterm ?? null,
    items: rows,
    total,
    leadTimeDays: quote?.leadTimeDays ?? null,
    paymentTerms: order.supplierPaymentTerms ?? [],
    packagingOkVersion:
      packagingProposalState(quote?.packagingProposal) === "ok"
        ? (quote?.packagingProposal?.version ?? null)
        : null,
  };
}

function parseSignature(
  requirement: Requirement | null,
): OrderSignature | null {
  if (!requirement || requirement.status !== "done" || !requirement.value)
    return null;
  try {
    const v = JSON.parse(requirement.value) as Partial<OrderSignature>;
    if (
      typeof v.name !== "string" ||
      typeof v.hash !== "string" ||
      typeof v.at !== "string"
    )
      return null;
    return {
      side: v.side === "supplier" ? "supplier" : "wellmix",
      name: v.name,
      userId: String(v.userId ?? ""),
      userName: String(v.userName ?? ""),
      at: v.at,
      hash: v.hash,
      onBehalf: v.onBehalf === true,
    };
  } catch {
    return null;
  }
}

export interface OrderSignatureView {
  order: Order;
  document: OrderDocument;
  hash: string;
  /** Pedido de antes da assinatura (sem os itens): só mostra o documento. */
  applies: boolean;
  wellmix: OrderSignature | null;
  supplier: OrderSignature | null;
  /** O que quem está vendo pode assinar agora (ou nulo). */
  canSign: "wellmix" | "supplier" | null;
  /**
   * Administrador da Wellmix: pode registrar a assinatura que o fornecedor
   * deu por fora (depois da assinatura da Wellmix).
   */
  canRegisterSupplier: boolean;
  /** O fornecedor espera a assinatura da Wellmix. */
  waitingWellmix: boolean;
}

async function signatureRequirements(orderId: string) {
  const all = await getStore().list("requirements", { filter: { orderId } });
  return {
    wellmix: all.find((r) => r.key === ORDER_SIGNED_WELLMIX) ?? null,
    supplier: all.find((r) => r.key === ORDER_SIGNED_SUPPLIER) ?? null,
  };
}

export async function getOrderSignatureView(
  user: User,
  orderId: string,
): Promise<OrderSignatureView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewOrderDocument(user, order)) return null;
  const document = await buildOrderDocument(order);
  const reqs = await signatureRequirements(order.id);
  const wellmix = parseSignature(reqs.wellmix);
  const supplier = parseSignature(reqs.supplier);
  const open = order.status !== "CANCELLED" && order.status !== "CLOSED";
  const stageActive = async (req: Requirement | null) => {
    if (!req || req.status === "done") return false;
    const stage = await store.get("stages", req.stageId);
    return stage?.status === "active" || stage?.status === "blocked";
  };
  let canSign: OrderSignatureView["canSign"] = null;
  let canRegisterSupplier = false;
  if (open) {
    const supplierOpen = !!wellmix && (await stageActive(reqs.supplier));
    if (isWellmix(user)) {
      if (await stageActive(reqs.wellmix)) canSign = "wellmix";
      canRegisterSupplier = supplierOpen && isAdmin(user);
    } else if (supplierOpen) {
      canSign = "supplier";
    }
  }
  return {
    order,
    document,
    hash: orderDocumentHash(document),
    applies: !!reqs.wellmix || !!reqs.supplier,
    wellmix,
    supplier,
    canSign,
    canRegisterSupplier,
    waitingWellmix: !isWellmix(user) && !!reqs.wellmix && !wellmix,
  };
}

export interface SignOrderInput {
  /** Nome completo digitado. */
  name: string;
  /** "Li e concordo" marcado. */
  agree: boolean;
  /** Versão do documento que a pessoa viu na tela. */
  hash: string;
  /**
   * Administrador da Wellmix registrando a assinatura que o fornecedor deu
   * por fora: `name` é o nome de quem assinou pelo fornecedor.
   */
  onBehalfOfSupplier?: boolean;
}

/**
 * Assina o documento do pedido. A Wellmix assina o item dela; o fornecedor do
 * pedido assina o dele, e só depois da Wellmix. A versão vista na tela tem de
 * ser a atual (se o pedido mudou enquanto a pessoa lia, ela relê).
 */
export async function signOrderDocument(
  user: User,
  orderId: string,
  input: SignOrderInput,
): Promise<OrderSignature> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderSignatureError("order_not_found");
  if (!canViewOrderDocument(user, order)) throw new ForbiddenError();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120)
    throw new OrderSignatureError("signature_name_required");
  if (!input.agree) throw new OrderSignatureError("signature_agree_required");
  const onBehalf = input.onBehalfOfSupplier === true;
  if (onBehalf && !isAdmin(user)) throw new ForbiddenError();
  const side: OrderSignature["side"] =
    isWellmix(user) && !onBehalf ? "wellmix" : "supplier";
  const reqs = await signatureRequirements(order.id);
  const requirement = side === "wellmix" ? reqs.wellmix : reqs.supplier;
  if (!requirement) throw new OrderSignatureError("signature_not_applicable");
  if (requirement.status === "done")
    throw new OrderSignatureError("signature_already_done");
  if (side === "supplier" && !parseSignature(reqs.wellmix))
    throw new OrderSignatureError("signature_wellmix_first");
  const document = await buildOrderDocument(order);
  const hash = orderDocumentHash(document);
  if (input.hash !== hash)
    throw new OrderSignatureError("signature_document_changed");
  const signature: OrderSignature = {
    side,
    name,
    userId: user.id,
    userName: user.name,
    at: new Date().toISOString(),
    hash,
    ...(onBehalf ? { onBehalf: true } : {}),
  };
  // Conclui o item pela regra das etapas (papel, etapa aberta, avanço).
  await submitRequirement(user, requirement.id, {
    value: JSON.stringify(signature),
    signature: true,
  });
  await audit(
    user,
    "order.signed",
    "order",
    order.id,
    `Documento do pedido #${order.number} assinado ${
      side === "wellmix" ? "pela Wellmix" : "pelo fornecedor"
    } por ${name}${
      onBehalf ? ` (recebida por fora, registrada por ${user.name})` : ""
    } (versão ${hash.slice(0, 12)})`,
    null,
    { side, name, hash, onBehalf },
  );
  if (side === "wellmix") {
    await notify(
      { role: "supplier", partyId: order.supplierId },
      {
        kind: "action",
        actor: "recipient",
        link: `/app/orders/${order.id}/purchase-order`,
        text: (t) => ({
          subject: t("notif.orderSign.subject", { n: String(order.number) }),
          body: t("notif.orderSign.body"),
        }),
      },
    );
  } else {
    await notifyWellmix({
      kind: "done",
      subject: `Pedido #${order.number}: documento assinado pelo fornecedor`,
      body: `${name} assinou o documento do pedido. As duas assinaturas estão registradas.`,
      link: `/app/orders/${order.id}/purchase-order`,
    });
  }
  return signature;
}
