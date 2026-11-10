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
  ORDER_CONFIRMED,
  ORDER_SIGN_SEND,
  ORDER_SIGNED_SUPPLIER,
  ORDER_SIGNED_WELLMIX,
} from "@/lib/workflow/stages";
import { canSubmitRequirement, submitRequirement } from "@/lib/workflow/engine";
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

/** O fornecedor do pedido: quem assina o documento do lado de lá. */
function isOrderSupplier(user: User, order: Pick<Order, "supplierId">) {
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    order.supplierId === user.partyId
  );
}

/**
 * A Wellmix, o fornecedor do pedido e a certificadora do pedido (ela só lê:
 * vê tudo do pedido para gerar o selo). O documento tem o preço de compra.
 */
export function canViewOrderDocument(
  user: User,
  order: Pick<Order, "supplierId"> & Partial<Pick<Order, "ocpId">>,
): boolean {
  if (isWellmix(user)) return true;
  if (isOrderSupplier(user, order)) return true;
  return user.role === "ocp" && !!user.partyId && order.ocpId === user.partyId;
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
  /**
   * Pedido novo: o documento ainda não foi enviado para assinatura (falta a
   * arte, o selo ou o aperto do botão). Enquanto isso ninguém assina.
   */
  awaitingSend: boolean;
  /** O que falta para o envio (vazio = já pode enviar). */
  sendBlockers: SignSendBlocker[];
  /** Este login pode apertar "Enviar para assinatura" agora. */
  canSend: boolean;
  /**
   * A Wellmix já assinou, o fornecedor ainda não, e a etapa dele não abriu
   * (o pedido não foi liberado): ninguém consegue assinar por ele ainda.
   */
  supplierBlocked: boolean;
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
  "awaiting_send",
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
    // "Enviar para assinatura" (pedidos novos): antes dele ninguém assina.
    send: all.find((r) => r.key === ORDER_SIGN_SEND) ?? null,
  };
}

/** O que falta para o documento poder ir para assinatura. */
export type SignSendBlocker = "art" | "seal";

/**
 * "Enviar para assinatura" só libera com a arte da embalagem enviada e o
 * selo da certificadora já aplicado nela (a arte com o selo enviada e não
 * recusada). Devolve o que falta, na ordem em que se faz.
 */
export async function signSendBlockers(
  orderId: string,
  stageId: string,
): Promise<SignSendBlocker[]> {
  const store = getStore();
  const missing: SignSendBlocker[] = [];
  const [art] = await store.list("requirements", {
    filter: { stageId, key: "art" },
    limit: 1,
  });
  if (!art || art.status !== "done") missing.push("art");
  // Falha ao ler os passos do selo (tabela ainda não publicada): conta como
  // selo não aplicado, sem derrubar a tela do pedido.
  const steps = await store
    .list("import_steps", { filter: { orderId } })
    .catch(() => []);
  const sealArt = steps.find((s) => s.key === "cert_seal_art");
  if (
    !sealArt ||
    (sealArt.status !== "submitted" && sealArt.status !== "validated")
  )
    missing.push("seal");
  return missing;
}

/**
 * Quem fez a arte (ou a Wellmix) manda o documento do pedido para as duas
 * assinaturas. Papel, etapa aberta e o que falta (arte, selo) são conferidos
 * pela regra das etapas.
 */
export async function sendOrderForSignature(
  user: User,
  orderId: string,
): Promise<void> {
  const { send } = await signatureRequirements(orderId);
  if (!send) throw new OrderSignatureError("signature_not_applicable");
  if (send.status === "done")
    throw new OrderSignatureError("sign_send_already_done");
  await submitRequirement(user, send.id, { value: "confirmed" });
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
  let supplierBlocked = false;
  // Pedido novo: antes do "Enviar para assinatura" ninguém assina.
  const awaitingSend = !!reqs.send && reqs.send.status !== "done" && !wellmix;
  let sendBlockers: SignSendBlocker[] = [];
  let canSend = false;
  if (open && awaitingSend && reqs.send) {
    sendBlockers = await signSendBlockers(order.id, reqs.send.stageId);
    canSend =
      sendBlockers.length === 0 &&
      (await stageActive(reqs.send)) &&
      canSubmitRequirement(user, order, reqs.send);
  }
  if (open) {
    const supplierOpen = !!wellmix && (await stageActive(reqs.supplier));
    supplierBlocked =
      !!wellmix && !!reqs.supplier && !supplier && !supplierOpen;
    if (isWellmix(user)) {
      if (!awaitingSend && (await stageActive(reqs.wellmix)))
        canSign = "wellmix";
      canRegisterSupplier = supplierOpen && isAdmin(user);
    } else if (supplierOpen && isOrderSupplier(user, order)) {
      canSign = "supplier";
    }
  }
  const prepStage = reqs.supplier
    ? await store.get("stages", reqs.supplier.stageId)
    : null;
  return {
    status: awaitingSend
      ? "awaiting_send"
      : !wellmix
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
    supplierBlocked,
    awaitingSend,
    sendBlockers,
    canSend,
    waitingWellmix: isOrderSupplier(user, order) && !!reqs.wellmix && !wellmix,
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
  /**
   * O mesmo arquivo assinado quando é grande demais para a requisição (foto
   * do celular, PDF escaneado): o navegador já o subiu direto ao
   * armazenamento e aqui vem só o id dele.
   */
  signedFileKey?: string | null;
}

const SIGNED_FILE_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/i;

/**
 * A assinatura da Wellmix libera o pedido ao fornecedor. O item "Pedido
 * conferido e liberado ao fornecedor" (mesma etapa da assinatura dela) é
 * concluído em nome de quem assinou: sem isso a etapa do fornecedor não abria
 * e ele recebia o aviso para assinar sem ter onde assinar. Vale também para
 * os pedidos que já estavam assim (chamado ao abrir o documento). Nunca
 * derruba quem chamou: se não der, o documento explica o que falta.
 */
export async function releaseOrderBySignature(
  orderId: string,
): Promise<boolean> {
  try {
    const store = getStore();
    const reqs = await signatureRequirements(orderId);
    const signature = parseSignature(reqs.wellmix);
    if (!signature || !reqs.wellmix) return false;
    const [confirm] = await store.list("requirements", {
      filter: { stageId: reqs.wellmix.stageId, key: ORDER_CONFIRMED },
      limit: 1,
    });
    if (!confirm || confirm.status === "done") return false;
    const signer = signature.userId
      ? await store.get("users", signature.userId)
      : null;
    if (!signer || !isWellmix(signer)) return false;
    await submitRequirement(signer, confirm.id, {
      value: "confirmed",
      note: "Liberado pela assinatura da Wellmix no documento do pedido",
    });
    return true;
  } catch (error) {
    console.error("[order-signature] liberar ao fornecedor", orderId, error);
    return false;
  }
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
  // Assina a Wellmix ou o fornecedor do pedido; a certificadora só lê.
  if (!isWellmix(user) && !isOrderSupplier(user, order))
    throw new ForbiddenError();
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
  // Pedido novo: primeiro a arte e o selo, depois "Enviar para assinatura".
  if (reqs.send && reqs.send.status !== "done")
    throw new OrderSignatureError("signature_not_sent");
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
  } else if (input.signedFileKey) {
    // Arquivo grande, já no armazenamento: confere o tipo antes de registrar
    // (o que não é PDF nem foto é apagado) e guarda como o anexo comum.
    const stored = await store.statFile(input.signedFileKey);
    if (!stored) throw new OrderSignatureError("signature_file_missing");
    if (!SIGNED_FILE_MIME.test(stored.mime ?? "")) {
      await store.removeFile(input.signedFileKey).catch(() => undefined);
      throw new OrderSignatureError("signature_file_invalid");
    }
    const { registerUploadedDocument } = await import("./documents");
    const doc = await registerUploadedDocument(user, input.signedFileKey, {
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
    // Assinar é conferir e liberar: o fornecedor já pode assinar em seguida.
    await releaseOrderBySignature(order.id);
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
    // Contrato assinado: o início da produção entra sozinho (e o prazo conta).
    await applyProductionStart(user, order.id);
    // Assinado pelos dois: o pedido está autorizado e segue para o Sankhya.
    const erp = await sendOrderToErp(user, order.id);
    const { emitProcessEvent } = await import("./process-engine");
    await emitProcessEvent(user, "order:signed", { orderId: order.id });
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

/** Dia civil em Brasília (AAAA-MM-DD) de um instante. */
function dayInBrazil(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export interface ProductionStart {
  /** O pedido tem documento para assinar: a data é automática. */
  auto: boolean;
  /** Dias depois do contrato assinado (Configurações). */
  days: number;
  /** A data (ISO, meia-noite UTC); nula enquanto o fornecedor não assina. */
  at: string | null;
}

/**
 * Início da produção do pedido (decisão do dono, 10/11/2026): ninguém digita.
 * É o dia em que o contrato fica assinado (a assinatura do fornecedor, a
 * segunda) mais o prazo do fornecedor (cadastro dele; sem valor, o padrão
 * das Configurações, `productionStartDays`). Pedido
 * antigo, sem documento para assinar, continua com a data informada à mão.
 */
export async function productionStartFor(
  orderId: string,
): Promise<ProductionStart> {
  const { getSettings } = await import("@/lib/settings");
  const [reqs, settings, order] = await Promise.all([
    signatureRequirements(orderId),
    getSettings(),
    getStore().get("orders", orderId),
  ]);
  // O prazo do fornecedor do pedido; sem ele, o padrão das Configurações.
  const own = order
    ? settings.productionStartDaysBySupplier?.[order.supplierId]
    : undefined;
  const days = typeof own === "number" ? own : settings.productionStartDays;
  const signed = parseSignature(reqs.supplier);
  if (!signed) return { auto: !!reqs.supplier, days, at: null };
  const start = new Date(`${dayInBrazil(signed.at)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + days);
  return { auto: true, days, at: start.toISOString() };
}

/**
 * Prazo de início da produção de um fornecedor (dias depois do contrato
 * assinado). Só o administrador grava; vazio volta ao padrão das
 * Configurações. Vale para as próximas assinaturas.
 */
export async function setSupplierProductionStartDays(
  user: User,
  supplierId: string,
  days: number | null,
) {
  if (!isAdmin(user)) throw new ForbiddenError();
  const supplier = await getStore().get("parties", supplierId);
  if (!supplier || supplier.type !== "supplier")
    throw new OrderSignatureError("order_not_found");
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365))
    throw new OrderSignatureError("production_days_invalid");
  const { getSettings, setSetting } = await import("@/lib/settings");
  const map = {
    ...((await getSettings()).productionStartDaysBySupplier ?? {}),
  };
  if (days === null) delete map[supplierId];
  else map[supplierId] = days;
  await setSetting("productionStartDaysBySupplier", map);
  await audit(
    user,
    "supplier.production_start_days",
    "party",
    supplierId,
    days === null
      ? `Início da produção de ${supplier.name}: volta ao padrão das Configurações`
      : `Início da produção de ${supplier.name}: ${days} dia(s) depois do contrato assinado`,
  );
}

/**
 * Contrato assinado: grava o início da produção na ficha de compra e no
 * acompanhamento da produção (de onde contam os follows de 5, 15 e 25 dias).
 * Nunca derruba a assinatura: falha aqui fica no log e a ficha continua
 * mostrando a data calculada.
 */
async function applyProductionStart(user: User, orderId: string) {
  try {
    const store = getStore();
    const { at } = await productionStartFor(orderId);
    if (!at) return;
    const [sheet] = await store.list("purchase_sheets", {
      filter: { orderId },
      limit: 1,
    });
    if (sheet && sheet.productionStartAt !== at)
      await store.update("purchase_sheets", sheet.id, {
        productionStartAt: at,
      });
    const [track] = await store.list("production_tracks", {
      filter: { orderId },
      limit: 1,
    });
    if (track) {
      if (track.productionStartAt !== at)
        await store.update("production_tracks", track.id, {
          productionStartAt: at,
          updatedByUserId: user.id,
        });
    } else {
      await store.create("production_tracks", {
        orderId,
        mode: null,
        factoryName: null,
        factoryAddress: null,
        productionStartAt: at,
        etd: null,
        etdOriginal: null,
        etdHistory: [],
        followups: [],
        inspectionScheduledAt: null,
        inspectionNote: null,
        updatedByUserId: user.id,
      });
    }
    await audit(
      user,
      "order.production_start",
      "order",
      orderId,
      `Início da produção definido pelo contrato assinado: ${at.slice(0, 10)}`,
    );
  } catch (error) {
    console.error("[order-signature] início da produção", error);
  }
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
 * volta: a folha do pedido no formato do modelo da Wellmix (deitada, com o
 * cabeçalho, os itens em duas faixas, os totais e os procedimentos), com a
 * versão (impressão digital) no rodapé. `printedBy`: quem gerou o arquivo.
 */
export async function renderOrderDocumentPdf(
  view: Pick<
    OrderSignatureView,
    "order" | "document" | "hash" | "wellmix" | "supplier"
  >,
  options: { printedBy?: string | null; printedAt?: string } = {},
): Promise<Uint8Array> {
  const [{ buildOrderSheet }, { renderOrderSheetPdf }] = await Promise.all([
    import("./order-sheet"),
    import("./order-sheet-pdf"),
  ]);
  const sheet = await buildOrderSheet(view.order, view.document, view.wellmix);
  return renderOrderSheetPdf({
    sheet,
    hash: view.hash,
    wellmix: view.wellmix,
    supplier: view.supplier,
    printedBy: options.printedBy ?? null,
    printedAt: options.printedAt ?? new Date().toISOString(),
  });
}
