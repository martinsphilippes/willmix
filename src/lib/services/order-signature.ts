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
  /** Pedido mínimo combinado com o fornecedor (peças), quando informado. */
  moq: number | null;
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
  /**
   * Como assinou: aceite no portal ("accept") ou o PDF baixado, assinado e
   * anexado de volta ("file", com o arquivo em `documentId`).
   */
  method?: "accept" | "file";
  documentId?: string | null;
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
    moq: quote?.moq ?? sheet?.moq ?? null,
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
      method: v.method === "file" ? "file" : "accept",
      documentId: typeof v.documentId === "string" ? v.documentId : null,
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
  /**
   * Em que ponto o documento está: esperando a Wellmix, enviado ao
   * fornecedor, assinado pelos dois (pedido autorizado) ou já no Sankhya.
   */
  status: OrderDocumentStatus;
  /**
   * Administrador: pode devolver a assinatura do fornecedor (arquivo errado)
   * enquanto a Preparação está aberta.
   */
  canReopenSupplier: boolean;
}

export const ORDER_DOCUMENT_STATUSES = [
  "awaiting_wellmix",
  "sent_to_supplier",
  "signed",
  "in_erp",
] as const;
export type OrderDocumentStatus = (typeof ORDER_DOCUMENT_STATUSES)[number];

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
  const prepStage = reqs.supplier
    ? await store.get("stages", reqs.supplier.stageId)
    : null;
  return {
    status: !wellmix
      ? "awaiting_wellmix"
      : !supplier
        ? "sent_to_supplier"
        : order.erpNumber
          ? "in_erp"
          : "signed",
    canReopenSupplier:
      open &&
      isAdmin(user) &&
      !!supplier &&
      (prepStage?.status === "active" || prepStage?.status === "blocked"),
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
  /**
   * O documento em PDF baixado, assinado e anexado de volta (PDF ou foto).
   * Com ele, a assinatura é "por arquivo"; sem ele, é o aceite no portal.
   */
  signedFile?: File | null;
}

const SIGNED_FILE_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/i;

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
  // Arquivo assinado (PDF baixado, assinado e anexado): fica guardado no
  // pedido como interno. Só a Wellmix e quem o enviou abrem: tem o preço.
  let documentId: string | null = null;
  const file = input.signedFile ?? null;
  if (file) {
    if (!SIGNED_FILE_MIME.test(file.type))
      throw new OrderSignatureError("signature_file_invalid");
    const { uploadDocument } = await import("./documents");
    const doc = await uploadDocument(user, file, {
      orderId: order.id,
      type: "other",
      visibility: "internal",
    });
    documentId = doc.id;
  }
  const signature: OrderSignature = {
    side,
    name,
    userId: user.id,
    userName: user.name,
    at: new Date().toISOString(),
    hash,
    method: documentId ? "file" : "accept",
    ...(documentId ? { documentId } : {}),
    ...(onBehalf ? { onBehalf: true } : {}),
  };
  // Conclui o item pela regra das etapas (papel, etapa aberta, avanço).
  // O arquivo assinado fica ligado ao item (aparece no pedido como anexo dele).
  await submitRequirement(user, requirement.id, {
    value: JSON.stringify(signature),
    signature: true,
    ...(documentId ? { documentId } : {}),
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
    { side, name, hash, onBehalf, method: signature.method, documentId },
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
    // Assinado pelos dois: o pedido está autorizado e segue para o Sankhya.
    const erp = await sendOrderToErp(user, order.id);
    await notifyWellmix({
      kind: erp.synced ? "done" : "action",
      subject: `Pedido #${order.number}: documento assinado pelo fornecedor`,
      body: `${name} assinou o documento do pedido${
        documentId ? " (arquivo assinado anexado)" : ""
      }. As duas assinaturas estão registradas. ${
        erp.synced
          ? `Pedido gerado no Sankhya: ${erp.erpNumber}.`
          : "Pedido autorizado: gere-o no Sankhya e informe o número no pedido."
      }`,
      link: `/app/orders/${order.id}/purchase-order`,
    });
  }
  return signature;
}

/**
 * Depois das duas assinaturas, o pedido vai ao Sankhya (docs/SANKHYA.md).
 * Sem integração ligada, fica "pendente": a Wellmix gera no ERP e informa o
 * número no pedido. Nunca derruba a assinatura: falha aqui fica no log.
 */
async function sendOrderToErp(
  user: User,
  orderId: string,
): Promise<{ synced: boolean; erpNumber: string | null }> {
  const store = getStore();
  try {
    const order = await store.get("orders", orderId);
    if (!order) return { synced: false, erpNumber: null };
    if (order.erpNumber) return { synced: true, erpNumber: order.erpNumber };
    const items = await store.list("order_items", { filter: { orderId } });
    const { getSankhyaAdapter } = await import("@/lib/integrations/sankhya");
    const sync = await getSankhyaAdapter().createOrder(order, items);
    if (sync.status !== "synced") return { synced: false, erpNumber: null };
    await store.update("orders", orderId, {
      erpSyncStatus: "synced",
      erpNumber: sync.erpNumber,
    });
    await audit(
      user,
      "order.erp_sync",
      "order",
      orderId,
      `Pedido #${order.number} gerado no Sankhya depois da assinatura: ${sync.erpNumber}`,
      null,
      { erpNumber: sync.erpNumber },
    );
    return { synced: true, erpNumber: sync.erpNumber };
  } catch (error) {
    console.error("[order-signature] erp", orderId, error);
    return { synced: false, erpNumber: null };
  }
}

/**
 * O administrador devolve a assinatura do fornecedor (arquivo errado,
 * ilegível, de outro pedido): o item volta a pendente, com o motivo, e o
 * fornecedor é avisado para assinar de novo. Só com a Preparação aberta.
 */
export async function reopenSupplierSignature(
  user: User,
  orderId: string,
  reason: string,
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderSignatureError("order_not_found");
  const text = reason.trim();
  if (text.length < 3 || text.length > 500)
    throw new OrderSignatureError("signature_reason_required");
  const { supplier } = await signatureRequirements(order.id);
  const before = parseSignature(supplier);
  if (!supplier || !before)
    throw new OrderSignatureError("signature_not_applicable");
  const stage = await store.get("stages", supplier.stageId);
  if (stage?.status !== "active" && stage?.status !== "blocked")
    throw new OrderSignatureError("stage_not_active");
  await store.update("requirements", supplier.id, {
    status: "pending",
    value: null,
    note: text,
    submittedByUserId: null,
    submittedAt: null,
  });
  await audit(
    user,
    "order.signature_reopened",
    "order",
    order.id,
    `Assinatura do fornecedor devolvida no pedido #${order.number}: ${text}`,
    before,
    null,
  );
  await notify(
    { role: "supplier", partyId: order.supplierId },
    {
      kind: "action",
      actor: "recipient",
      link: `/app/orders/${order.id}/purchase-order`,
      text: (t) => ({
        subject: t("notif.orderSignReopened.subject", {
          n: String(order.number),
        }),
        body: t("notif.orderSignReopened.body", { reason: text }),
      }),
    },
  );
}

/* ------------------------------------------------------------------------ */
/* PDF do documento                                                           */
/* ------------------------------------------------------------------------ */

/**
 * O documento do pedido em PDF, para o fornecedor baixar, assinar e anexar de
 * volta. Rótulos em inglês e português (o fornecedor costuma ler inglês); o
 * conteúdo é o mesmo da página, com a versão (impressão digital) no rodapé.
 */
export async function renderOrderDocumentPdf(
  view: Pick<OrderSignatureView, "document" | "hash" | "wellmix" | "supplier">,
): Promise<Uint8Array> {
  const { SimplePdf, pdfWrap } = await import("@/lib/simple-pdf");
  const { translator } = await import("@/i18n");
  const { describeTerms } = await import("@/components/supplier-terms-text");
  const t = translator("en");
  const doc = view.document;
  const pdf = new SimplePdf();
  const left = 48;
  const right = SimplePdf.width - 48;
  const bottom = SimplePdf.height - 60;
  let y = 60;
  const money = (v: number | null, digits = 2) =>
    v === null
      ? "-"
      : `${doc.currency} ${v.toLocaleString("en-US", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })}`;
  const footer = () => {
    pdf.text(
      left,
      SimplePdf.height - 34,
      `Document version / Versão do documento: ${view.hash}`,
      { size: 7 },
    );
    pdf.text(right, SimplePdf.height - 34, `${pdf.pageCount}`, {
      size: 7,
      align: "right",
    });
  };
  const need = (height: number) => {
    if (y + height <= bottom) return;
    footer();
    pdf.addPage();
    y = 60;
  };
  const pair = (label: string, value: string) => {
    const lines = pdfWrap(value || "-", 10, right - left - 190);
    need(14 * lines.length + 4);
    pdf.text(left, y, label, { size: 10, bold: true });
    lines.forEach((line, i) => pdf.text(left + 190, y + 14 * i, line));
    y += 14 * lines.length + 4;
  };

  pdf.text(left, y, `PURCHASE ORDER / PEDIDO DE COMPRA  #${doc.orderNumber}`, {
    size: 16,
    bold: true,
  });
  y += 26;
  pair("Buyer / Comprador", doc.buyerName);
  pair("Supplier / Fornecedor", doc.supplierName);
  y += 8;

  // Itens.
  const cols = { qty: left + 300, price: left + 400, total: right };
  const header = () => {
    pdf.line(left, y - 11, right, y - 11);
    pdf.text(left + 4, y, "Product / Produto", { size: 9, bold: true });
    pdf.text(cols.qty, y, "Quantity / Qtd.", {
      size: 9,
      bold: true,
      align: "right",
    });
    pdf.text(cols.price, y, "Unit price / Preço", {
      size: 9,
      bold: true,
      align: "right",
    });
    pdf.text(cols.total - 4, y, "Total", {
      size: 9,
      bold: true,
      align: "right",
    });
    pdf.line(left, y + 5, right, y + 5);
    y += 19;
  };
  header();
  for (const item of doc.items) {
    const name = pdfWrap(
      item.variant ? `${item.name} - ${item.variant}` : item.name,
      10,
      200,
    );
    if (y + 14 * name.length + 6 > bottom) {
      footer();
      pdf.addPage();
      y = 60;
      header();
    }
    name.forEach((line, i) => pdf.text(left + 4, y + 14 * i, line));
    pdf.text(
      cols.qty,
      y,
      `${item.quantity.toLocaleString("en-US")} ${item.unit}`,
      { align: "right" },
    );
    pdf.text(cols.price, y, money(item.unitPrice, 4), { align: "right" });
    pdf.text(cols.total - 4, y, money(item.total), { align: "right" });
    y += 14 * name.length + 2;
    pdf.line(left, y - 9, right, y - 9, 0.3);
    y += 4;
  }
  need(24);
  pdf.text(left + 4, y, `TOTAL${doc.incoterm ? ` ${doc.incoterm}` : ""}`, {
    bold: true,
  });
  pdf.text(cols.total - 4, y, money(doc.total), { bold: true, align: "right" });
  pdf.line(left, y + 5, right, y + 5);
  y += 28;

  pair(
    "MOQ / Pedido mínimo",
    doc.moq ? `${doc.moq.toLocaleString("en-US")} pcs` : "-",
  );
  pair(
    "Lead time / Prazo de produção",
    doc.leadTimeDays ? `${doc.leadTimeDays} days / dias` : "-",
  );
  pair(
    "Payment terms / Pagamento",
    doc.paymentTerms.length
      ? describeTerms(t, doc.paymentTerms)
      : "As agreed / Conforme combinado",
  );
  if (doc.packagingOkVersion)
    pair(
      "Packaging / Embalagem",
      `Proposal ${doc.packagingOkVersion} approved by the supplier / Proposta ${doc.packagingOkVersion} com o OK do fornecedor`,
    );
  y += 10;

  // Assinaturas.
  need(150);
  pdf.text(left, y, "Signatures / Assinaturas", { size: 12, bold: true });
  y += 14;
  const half = (right - left - 16) / 2;
  const box = (x: number, title: string, who: string, lines: string[]) => {
    pdf.rect(x, y, half, 112);
    pdf.text(x + 8, y + 16, title, { size: 9, bold: true });
    pdfWrap(who, 9, half - 16)
      .slice(0, 2)
      .forEach((line, i) =>
        pdf.text(x + 8, y + 30 + 11 * i, line, { size: 9 }),
      );
    lines.forEach((line, i) =>
      pdf.text(x + 8, y + 62 + 16 * i, line, { size: 9 }),
    );
  };
  const day = (iso: string) => iso.slice(0, 10);
  box(
    left,
    "Buyer / Comprador",
    doc.buyerName,
    view.wellmix
      ? [
          `Signed in the portal by / Assinado no portal por:`,
          `${view.wellmix.name}`,
          `Date / Data: ${day(view.wellmix.at)}`,
        ]
      : ["Not signed yet / Ainda não assinou"],
  );
  box(
    left + half + 16,
    "Supplier / Fornecedor",
    doc.supplierName,
    view.supplier
      ? [
          `Signed by / Assinado por: ${view.supplier.name}`,
          `Date / Data: ${day(view.supplier.at)}`,
        ]
      : [
          "Name / Nome: ______________________________",
          "Signature, stamp / Assinatura, carimbo:",
          "Date / Data: ____ / ____ / ________",
        ],
  );
  footer();
  return pdf.build();
}
