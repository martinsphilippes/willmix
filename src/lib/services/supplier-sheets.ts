import "server-only";

import {
  getStore,
  type Order,
  type Product,
  type PurchaseQuote,
  type PurchaseQuoteResponse,
  type QuoteResponseItem,
  type SupplierProductSheet,
  type SupplierSheetBaseline,
  type SupplierSheetData,
  type SupplierSheetField,
  type SupplierSheetKind,
  type SupplierSheetSource,
  type User,
} from "@/lib/db";
import { assertCan, can, holdersOf } from "@/lib/auth/function-access";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import {
  baselineFromProduct,
  baselineFromSheet,
  catalogAlerts,
  changedSheetFields,
  mergeBaselines,
  normalizeSheet,
  type CatalogAlert,
  type SheetTolerances,
  type SupplierSheetDraft,
} from "@/lib/supplier-sheet";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Ficha técnica do par produto × fornecedor (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação").
 *
 * - Já vendeu = pedido de compra não cancelado do fornecedor com o produto,
 *   ou o vínculo do Sankhya com a última compra (já carregado no portal).
 * - O que temos = a ficha do último pedido dele com o produto, senão a ficha
 *   mestre, senão o cadastro (a ordem da ficha de compra). O código do item
 *   na fábrica só vem do próprio fornecedor (isolamento).
 * - Pedida uma vez por par: gravada, não volta a ser pedida, a não ser que o
 *   Cadastro recuse a correção.
 * - Nada aqui muda o cadastro do produto nem o Sankhya (dono, 20/11/2026):
 *   a correção fica na ficha do fornecedor, que o portal usa nas cotações e
 *   nos pedidos dele; o Cadastro aceita ou recusa.
 */

export class SupplierSheetError extends Error {}

const cancelled = (o: Pick<Order, "status" | "cancelledAt">) =>
  o.status === "CANCELLED" || !!o.cancelledAt;

/** Fichas gravadas do fornecedor para estes produtos (vazio antes do esquema publicado). */
export async function loadPairSheets(
  supplierId: string,
  productIds: readonly string[],
): Promise<Map<string, SupplierProductSheet>> {
  const ids = [...new Set(productIds)];
  if (!ids.length) return new Map();
  const rows = await getStore()
    .list("supplier_product_sheets", {
      filter: { supplierId, productId: ids },
    })
    .catch((error) => {
      console.warn("[supplier-sheets] leitura falhou", error);
      return [] as SupplierProductSheet[];
    });
  return new Map(rows.map((r) => [r.productId, r]));
}

/** A ficha do par vale (não precisa ser pedida de novo)? */
export const sheetSettled = (sheet: SupplierProductSheet | null | undefined) =>
  !!sheet && sheet.review !== "rejected";

/** Pedidos de compra do fornecedor com estes produtos (não cancelados). */
async function supplierOrdersWith(
  supplierId: string,
  productIds: readonly string[],
  exceptOrderId?: string | null,
): Promise<Array<{ productId: string; order: Order }>> {
  const store = getStore();
  const items = await store.list("order_items", {
    filter: { productId: [...productIds] },
  });
  const orderIds = [...new Set(items.map((i) => i.orderId))];
  if (!orderIds.length) return [];
  const orders = await store.list("orders", {
    filter: { id: orderIds, supplierId },
  });
  const byId = new Map(
    orders
      .filter((o) => !cancelled(o) && o.id !== exceptOrderId)
      .map((o) => [o.id, o]),
  );
  return items
    .filter((i) => i.productId && byId.has(i.orderId))
    .map((i) => ({ productId: i.productId!, order: byId.get(i.orderId)! }));
}

/**
 * Produtos que o fornecedor já vendeu à Wellmix: pedido de compra não
 * cancelado (fora `exceptOrderId`, o pedido que está sendo preenchido) ou o
 * vínculo do Sankhya com a última compra.
 */
export async function soldBeforeProducts(
  supplierId: string,
  productIds: readonly string[],
  options: { exceptOrderId?: string | null } = {},
): Promise<Set<string>> {
  const ids = [...new Set(productIds)];
  const out = new Set<string>();
  if (!ids.length) return out;
  for (const { productId } of await supplierOrdersWith(
    supplierId,
    ids,
    options.exceptOrderId,
  ))
    out.add(productId);
  const links = await getStore()
    .list("product_suppliers", { filter: { supplierId, productId: ids } })
    .catch(() => []);
  for (const l of links) if (l.sankhyaLastPurchaseAt) out.add(l.productId);
  return out;
}

/**
 * O que temos de cada produto, para o fornecedor conferir: a ficha do último
 * pedido dele com o produto, a ficha mestre e o cadastro, nessa ordem. O
 * código do item na fábrica só vem dele (ficha dele, vínculo ou o principal).
 */
export async function loadSheetBaselines(
  supplierId: string,
  products: readonly Product[],
  options: { exceptOrderId?: string | null } = {},
): Promise<Map<string, SupplierSheetBaseline>> {
  const out = new Map<string, SupplierSheetBaseline>();
  if (!products.length) return out;
  const store = getStore();
  const ids = products.map((p) => p.id);
  // O pedido que está sendo preenchido não é "o que temos" (é a resposta dele).
  const ordered = await supplierOrdersWith(
    supplierId,
    ids,
    options.exceptOrderId,
  );
  const sheets = ordered.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: [...new Set(ordered.map((o) => o.order.id))] },
      })
    : [];
  const links = await store
    .list("product_suppliers", { filter: { supplierId, productId: ids } })
    .catch(() => []);
  const { masterSheetInput } = await import("./product-sheet");
  for (const product of products) {
    const orderIds = new Set(
      ordered.filter((o) => o.productId === product.id).map((o) => o.order.id),
    );
    const previous = sheets
      .filter(
        (s) =>
          orderIds.has(s.orderId) &&
          (s.productId === product.id || !s.productId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const master = await masterSheetInput(product.id).catch(() => null);
    const merged = mergeBaselines(
      previous ? baselineFromSheet(previous) : null,
      master ? { ...baselineFromSheet(master), factoryItemCode: null } : null,
      baselineFromProduct(product),
    );
    const link = links.find((l) => l.productId === product.id);
    const ownCode =
      (previous?.factoryItemCode ?? "").trim() ||
      (link?.supplierSku ?? "").trim() ||
      (product.supplierId === supplierId
        ? (product.supplierSku ?? "").trim()
        : "");
    out.set(product.id, { ...merged, factoryItemCode: ownCode || null });
  }
  return out;
}

/** Produtos com foto na balança no cadastro. */
async function catalogScalePhotos(
  productIds: readonly string[],
): Promise<Set<string>> {
  if (!productIds.length) return new Set();
  const photos = await getStore()
    .list("product_photos", {
      filter: { productId: [...productIds], kind: "weight_scale" },
    })
    .catch(() => []);
  return new Set(photos.map((p) => p.productId).filter(Boolean) as string[]);
}

/** Tolerâncias da inspeção (Configurações), usadas nos avisos. */
export async function sheetTolerances(): Promise<SheetTolerances> {
  const s = await getSettings();
  return {
    weightPercent: s.weightTolerancePercent,
    dimensionPercent: s.dimensionTolerancePercent,
    cbmPercent: s.cbmTolerancePercent,
  };
}

/* ------------------------------------------------------------------------ */
/* Na cotação: o que o fornecedor vê e envia                                */
/* ------------------------------------------------------------------------ */

/** Um produto da cotação para o fornecedor: a ficha a pedir (ou a que vale). */
export interface QuoteSheetLine {
  productId: string;
  soldBefore: boolean;
  /** A ficha é pedida nesta resposta. */
  ask: boolean;
  /** A ficha que já vale (não é pedida): mostra só a data. */
  settled: SupplierProductSheet | null;
  /** Ele já mandou nesta cotação e ainda pode corrigir (prazo correndo). */
  ownDraft: SupplierSheetData | null;
  /** O que temos (só para quem já vendeu). */
  baseline: SupplierSheetBaseline | null;
  /** O Cadastro recusou a correção anterior (o motivo). */
  rejectedNote: string | null;
  /** A foto na balança é pedida (quem nunca vendeu, ou o produto sem foto). */
  askPhoto: boolean;
  /** Foto já enviada nesta cotação. */
  photoDocumentId: string | null;
}

const itemOf = (
  response: Pick<PurchaseQuoteResponse, "items">,
  productId: string,
): QuoteResponseItem | null =>
  response.items?.find((i) => i.productId === productId) ?? null;

/** Os produtos da cotação com a ficha técnica de cada um, para quem responde. */
export async function quoteSheetLines(
  quote: Pick<PurchaseQuote, "items">,
  response: PurchaseQuoteResponse,
): Promise<QuoteSheetLine[]> {
  const store = getStore();
  const productIds = [...new Set(quote.items.map((i) => i.productId))];
  const [sold, pairs, products, scale] = await Promise.all([
    soldBeforeProducts(response.supplierId, productIds),
    loadPairSheets(response.supplierId, productIds),
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : Promise.resolve([] as Product[]),
    catalogScalePhotos(productIds),
  ]);
  const soldProducts = products.filter((p) => sold.has(p.id));
  const baselines = await loadSheetBaselines(response.supplierId, soldProducts);
  return productIds.map((productId) => {
    const pair = pairs.get(productId) ?? null;
    // Mandada nesta cotação, sem revisão decidida: dá para corrigir até o fim do prazo.
    const own =
      !!pair &&
      pair.quoteResponseId === response.id &&
      pair.review !== "accepted" &&
      pair.review !== "rejected";
    const soldBefore = own ? pair!.soldBefore : sold.has(productId);
    const ask = own || !sheetSettled(pair);
    return {
      productId,
      soldBefore,
      ask,
      settled: ask ? null : pair,
      ownDraft: own ? pair!.data : null,
      baseline: soldBefore
        ? own
          ? pair!.baseline
          : (baselines.get(productId) ?? null)
        : null,
      rejectedNote: pair?.review === "rejected" ? pair.reviewNote : null,
      askPhoto: !soldBefore || !scale.has(productId),
      photoDocumentId:
        itemOf(response, productId)?.scalePhotoDocumentId ?? null,
    };
  });
}

/** O que o fornecedor mandou de um produto. */
export interface QuoteSheetInput {
  productId: string;
  draft: SupplierSheetDraft | null;
  /** "Confirmo os dados deste produto" (quem já vendeu). */
  confirmed: boolean;
}

/** A ficha de cada produto, conferida, pronta para gravar com a resposta. */
export interface PreparedQuoteSheet {
  line: QuoteSheetLine;
  item: QuoteResponseItem;
  /** Gravar a ficha do par (nula: a que já valia continua). */
  write: {
    kind: SupplierSheetKind;
    data: SupplierSheetData;
    changedFields: SupplierSheetField[];
  } | null;
}

/**
 * Confere a ficha de cada produto (o que falta, a confirmação de quem já
 * vendeu) e monta o que vai na resposta. Recusa sem gravar nada.
 */
export async function prepareQuoteSheets(
  quote: Pick<PurchaseQuote, "items">,
  response: PurchaseQuoteResponse,
  inputs: readonly QuoteSheetInput[],
): Promise<PreparedQuoteSheet[]> {
  const lines = await quoteSheetLines(quote, response);
  return lines.map((line) => {
    const photo = line.photoDocumentId;
    if (!line.ask) {
      return {
        line,
        item: {
          productId: line.productId,
          sheet: line.settled?.data ?? null,
          sheetKind: line.settled ? "existing" : null,
          changedFields: null,
          scalePhotoDocumentId: photo,
        },
        write: null,
      };
    }
    const input = inputs.find((i) => i.productId === line.productId);
    const data = input?.draft ? normalizeSheet(input.draft) : null;
    if (!data) throw new SupplierSheetError("quote_sheet_missing");
    if (line.soldBefore && !input?.confirmed)
      throw new SupplierSheetError("quote_sheet_confirm");
    const changed = line.soldBefore
      ? changedSheetFields(data, line.baseline)
      : [];
    const kind: SupplierSheetKind = !line.soldBefore
      ? "declared"
      : changed.length
        ? "corrected"
        : "confirmed";
    return {
      line,
      item: {
        productId: line.productId,
        sheet: data,
        sheetKind: kind,
        changedFields: changed.length ? changed : null,
        scalePhotoDocumentId: photo,
      },
      write: { kind, data, changedFields: changed },
    };
  });
}

async function upsertPairSheet(
  productId: string,
  supplierId: string,
  patch: Omit<
    SupplierProductSheet,
    "id" | "createdAt" | "updatedAt" | "productId" | "supplierId"
  >,
): Promise<SupplierProductSheet> {
  const store = getStore();
  const find = async () =>
    (
      await store.list("supplier_product_sheets", {
        filter: { productId, supplierId },
        limit: 1,
      })
    )[0] ?? null;
  // Sem foto nova, fica a que ele já tinha mandado (nunca se perde).
  const keepPhoto = (row: SupplierProductSheet) => ({
    ...patch,
    scalePhotoDocumentId:
      patch.scalePhotoDocumentId ?? row.scalePhotoDocumentId ?? null,
  });
  const existing = await find();
  if (existing)
    return store.update(
      "supplier_product_sheets",
      existing.id,
      keepPhoto(existing),
    );
  try {
    return await store.create("supplier_product_sheets", {
      productId,
      supplierId,
      ...patch,
    });
  } catch (error) {
    // Outra resposta gravou o par antes (índice único): atualiza aquela.
    const again = await find();
    if (!again) throw error;
    return store.update("supplier_product_sheets", again.id, keepPhoto(again));
  }
}

/**
 * Grava a ficha de cada par depois da resposta gravada. Correção (quem já
 * vendeu e mudou algo) vai para a revisão do Cadastro, com aviso.
 */
export async function saveQuoteSheets(
  user: User,
  quote: Pick<PurchaseQuote, "id" | "number">,
  response: PurchaseQuoteResponse,
  prepared: readonly PreparedQuoteSheet[],
  now: Date,
): Promise<void> {
  const corrected: Array<{ productId: string; fields: SupplierSheetField[] }> =
    [];
  for (const p of prepared) {
    const photo = p.item.scalePhotoDocumentId;
    if (!p.write) {
      // A ficha já valia: só a foto nova (se veio) passa para a ficha do par.
      if (
        photo &&
        p.line.settled &&
        p.line.settled.scalePhotoDocumentId !== photo
      )
        await getStore().update("supplier_product_sheets", p.line.settled.id, {
          scalePhotoDocumentId: photo,
        });
      continue;
    }
    const review = p.write.kind === "corrected" ? "pending" : null;
    const saved = await upsertPairSheet(p.line.productId, response.supplierId, {
      kind: p.write.kind,
      data: p.write.data,
      baseline: p.line.baseline,
      changedFields: p.write.changedFields.length
        ? p.write.changedFields
        : null,
      soldBefore: p.line.soldBefore,
      source: "quote" satisfies SupplierSheetSource,
      quoteId: quote.id,
      quoteResponseId: response.id,
      orderId: null,
      scalePhotoDocumentId: photo,
      confirmedAt: now.toISOString(),
      confirmedByUserId: user.id,
      review,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    });
    await audit(
      user,
      `supplier_sheet.${p.write.kind}`,
      "supplier_product_sheet",
      saved.id,
      `Ficha técnica do produto ${p.line.productId} pelo fornecedor ${response.supplierId} na cotação de compra nº ${quote.number}: ${
        p.write.kind === "declared"
          ? "informada"
          : p.write.kind === "confirmed"
            ? "confirmada"
            : `corrigida (${p.write.changedFields.join(", ")})`
      }`,
      p.line.baseline,
      p.write.data,
    );
    if (review)
      corrected.push({
        productId: p.line.productId,
        fields: p.write.changedFields,
      });
  }
  if (corrected.length)
    await notifyReviewers(
      response.supplierId,
      corrected.map((c) => c.productId),
    );
}

/** Quem revisa a correção: quem tem a ação (o Cadastro, por padrão). */
async function reviewers(): Promise<User[]> {
  const users = (
    await getStore().list("users", { filter: { active: true } })
  ).filter((u) => isWellmix(u));
  const { loadFunctionDefs } = await import("./team-functions");
  const holders = holdersOf(
    users,
    "supplierSheet.review",
    await loadFunctionDefs(),
  );
  return holders.length ? holders : users.filter((u) => isAdmin(u));
}

async function notifyReviewers(supplierId: string, productIds: string[]) {
  const list = await reviewers();
  if (!list.length) return;
  const store = getStore();
  const [supplier, products] = await Promise.all([
    store.get("parties", supplierId),
    store.list("products", { filter: { id: productIds } }),
  ]);
  await notify(
    { userIds: list.map((u) => u.id) },
    {
      kind: "action",
      link: "/app/supplier-sheets?review=pending",
      subject: `Ficha técnica corrigida pelo fornecedor ${supplier?.name ?? supplierId}`,
      body: `Confira a correção: ${products.map((p) => p.name).join(", ")}.`,
    },
  );
}

/** Foto na balança enviada na cotação (antes ou depois da resposta, no prazo). */
export async function setQuoteScalePhoto(
  response: PurchaseQuoteResponse,
  productId: string,
  documentId: string,
): Promise<PurchaseQuoteResponse> {
  const items = [...(response.items ?? [])];
  const at = items.findIndex((i) => i.productId === productId);
  const base: QuoteResponseItem =
    at >= 0
      ? items[at]
      : {
          productId,
          sheet: null,
          sheetKind: null,
          changedFields: null,
          scalePhotoDocumentId: null,
        };
  const next = { ...base, scalePhotoDocumentId: documentId };
  if (at >= 0) items[at] = next;
  else items.push(next);
  const updated = await getStore().update(
    "purchase_quote_responses",
    response.id,
    {
      items,
    },
  );
  // Resposta já enviada: a foto também vai para a ficha do par.
  if (response.status === "answered") {
    const pair = (await loadPairSheets(response.supplierId, [productId])).get(
      productId,
    );
    if (pair)
      await getStore().update("supplier_product_sheets", pair.id, {
        scalePhotoDocumentId: documentId,
      });
  }
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Na ficha de compra do pedido                                             */
/* ------------------------------------------------------------------------ */

/**
 * A foto na balança no pedido (dono, 20/11/2026): a do cadastro só vale para
 * quem já vendeu o produto (fora este pedido), para o fornecedor principal ou
 * quando foi ele que a enviou; a que ele mandou na cotação vale sempre. As
 * outras fotos seguem como antes.
 */
export async function scalePhotoForOrder(
  order: Pick<Order, "id" | "supplierId">,
  productId: string | null | undefined,
): Promise<{ catalogCounts: boolean; ownDocumentId: string | null }> {
  if (!productId || !order.supplierId)
    return { catalogCounts: true, ownDocumentId: null };
  const store = getStore();
  const [sold, pairs, product, photos] = await Promise.all([
    soldBeforeProducts(order.supplierId, [productId], {
      exceptOrderId: order.id,
    }),
    loadPairSheets(order.supplierId, [productId]),
    store.get("products", productId),
    store
      .list("product_photos", { filter: { productId, kind: "weight_scale" } })
      .catch(() => []),
  ]);
  // A foto do cadastro vale para quem já vendeu o produto, para o fornecedor
  // principal (o de referência da ficha mestre) e quando foi ele que enviou.
  let catalogCounts =
    sold.has(productId) || product?.supplierId === order.supplierId;
  if (!catalogCounts && photos.length) {
    const uploaders = [
      ...new Set(photos.map((p) => p.takenByUserId).filter(Boolean)),
    ] as string[];
    const users = uploaders.length
      ? await store.list("users", { filter: { id: uploaders } })
      : [];
    catalogCounts = users.some((u) => u.partyId === order.supplierId);
  }
  return {
    catalogCounts,
    ownDocumentId: pairs.get(productId)?.scalePhotoDocumentId ?? null,
  };
}

/** A ficha técnica que vale do par (para o rascunho da ficha de compra). */
export async function settledPairSheet(
  supplierId: string | null | undefined,
  productId: string | null | undefined,
): Promise<SupplierProductSheet | null> {
  if (!supplierId || !productId) return null;
  const pair = (await loadPairSheets(supplierId, [productId])).get(productId);
  return sheetSettled(pair) ? pair! : null;
}

/** A ficha técnica nos nomes da ficha de compra (peso bruto por peça = caixa ÷ peças). */
export function purchaseSheetFields(data: SupplierSheetData) {
  return {
    masterCartonQty: data.masterBoxQty,
    innerQty: data.innerBoxQty,
    netWeightPcKg: data.netWeightKg,
    grossWeightPcKg: data.grossWeightBoxKg / data.masterBoxQty,
    cbmPerCarton: data.cbm,
    lengthCm: data.boxLengthCm,
    widthCm: data.boxWidthCm,
    heightCm: data.boxHeightCm,
    material: data.material,
    factoryItemCode: data.factoryItemCode,
  };
}

/**
 * Pedido direto (sem cotação): a ficha de compra salva completa pelo
 * fornecedor vale como a ficha técnica do par, uma vez só, quando traz tudo
 * o que a ficha técnica pede (o inner e o código do item na fábrica, que a
 * ficha de compra não exige). Correção de quem já vendeu vai para a revisão.
 */
export async function recordFromPurchaseSheet(
  user: User,
  order: Pick<Order, "id" | "supplierId">,
  sheet: {
    productId?: string | null;
    masterCartonQty?: number | null;
    innerQty?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    cbmPerCarton?: number | null;
    netWeightPcKg?: number | null;
    grossWeightPcKg?: number | null;
    material?: string | null;
    factoryItemCode?: string | null;
  },
  now = new Date(),
): Promise<SupplierProductSheet | null> {
  const productId = sheet.productId ?? null;
  if (user.role !== "supplier" || !productId || !order.supplierId) return null;
  if (await settledPairSheet(order.supplierId, productId)) return null;
  const master = sheet.masterCartonQty ?? null;
  const gross = sheet.grossWeightPcKg ?? null;
  const data = normalizeSheet({
    masterBoxQty: master,
    innerBoxQty: sheet.innerQty ?? null,
    // Inner 0 na ficha = sem inner; vazio = não informado (não grava).
    noInner: sheet.innerQty === 0,
    boxLengthCm: sheet.lengthCm ?? null,
    boxWidthCm: sheet.widthCm ?? null,
    boxHeightCm: sheet.heightCm ?? null,
    cbm: sheet.cbmPerCarton ?? null,
    netWeightKg: sheet.netWeightPcKg ?? null,
    grossWeightBoxKg: master && gross ? gross * master : null,
    material: sheet.material ?? "",
    factoryItemCode: sheet.factoryItemCode ?? "",
    noFactoryCode: false,
  });
  if (!data || (sheet.innerQty !== 0 && !sheet.innerQty)) return null;
  const store = getStore();
  const sold = await soldBeforeProducts(order.supplierId, [productId], {
    exceptOrderId: order.id,
  });
  const soldBefore = sold.has(productId);
  const product = await store.get("products", productId);
  const baseline =
    soldBefore && product
      ? ((
          await loadSheetBaselines(order.supplierId, [product], {
            exceptOrderId: order.id,
          })
        ).get(productId) ?? null)
      : null;
  const changed = soldBefore ? changedSheetFields(data, baseline) : [];
  const kind: SupplierSheetKind = !soldBefore
    ? "declared"
    : changed.length
      ? "corrected"
      : "confirmed";
  const saved = await upsertPairSheet(productId, order.supplierId, {
    kind,
    data,
    baseline,
    changedFields: changed.length ? changed : null,
    soldBefore,
    source: "purchase_sheet",
    quoteId: null,
    quoteResponseId: null,
    orderId: order.id,
    scalePhotoDocumentId: null,
    confirmedAt: now.toISOString(),
    confirmedByUserId: user.id,
    review: kind === "corrected" ? "pending" : null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNote: null,
  });
  await audit(
    user,
    `supplier_sheet.${kind}`,
    "supplier_product_sheet",
    saved.id,
    `Ficha técnica do produto ${productId} pelo fornecedor ${order.supplierId} na ficha de compra do pedido ${order.id}`,
    baseline,
    data,
  );
  if (kind === "corrected")
    await notifyReviewers(order.supplierId, [productId]);
  return saved;
}

/** O par precisa da revalidação (já vendeu e ainda não confirmou)? */
export async function pairNeedsRevalidation(
  order: Pick<Order, "id" | "supplierId">,
  productId: string | null | undefined,
): Promise<boolean> {
  if (!productId || !order.supplierId) return false;
  if (await settledPairSheet(order.supplierId, productId)) return false;
  const sold = await soldBeforeProducts(order.supplierId, [productId], {
    exceptOrderId: order.id,
  });
  return sold.has(productId);
}

/* ------------------------------------------------------------------------ */
/* No comparativo da Wellmix                                                */
/* ------------------------------------------------------------------------ */

export interface BoardSheetCell {
  sheet: SupplierSheetData | null;
  sheetKind: QuoteResponseItem["sheetKind"];
  changedFields: SupplierSheetField[];
  alerts: CatalogAlert[];
  review: SupplierProductSheet["review"];
  pairSheetId: string | null;
  photoDocumentId: string | null;
}

/**
 * A ficha de cada resposta e produto, com os avisos em relação ao nosso
 * cadastro (ficha mestre e cadastro, sem a ficha de um fornecedor).
 */
export async function boardSheetCells(
  quote: Pick<PurchaseQuote, "items">,
  responses: readonly PurchaseQuoteResponse[],
): Promise<Map<string, BoardSheetCell>> {
  const out = new Map<string, BoardSheetCell>();
  const answered = responses.filter((r) => r.status === "answered");
  if (!answered.length) return out;
  const store = getStore();
  const productIds = [...new Set(quote.items.map((i) => i.productId))];
  const [products, tol] = await Promise.all([
    store.list("products", { filter: { id: productIds } }),
    sheetTolerances(),
  ]);
  const { masterSheetInput } = await import("./product-sheet");
  const ours = new Map<string, SupplierSheetBaseline>();
  for (const p of products) {
    const master = await masterSheetInput(p.id).catch(() => null);
    ours.set(
      p.id,
      mergeBaselines(
        master ? baselineFromSheet(master) : null,
        baselineFromProduct(p),
      ),
    );
  }
  for (const r of answered) {
    const pairs = await loadPairSheets(r.supplierId, productIds);
    for (const productId of productIds) {
      const item = itemOf(r, productId);
      const pair = pairs.get(productId) ?? null;
      const sheet = item?.sheet ?? null;
      out.set(`${r.id}:${productId}`, {
        sheet,
        sheetKind: item?.sheetKind ?? null,
        changedFields: item?.changedFields ?? [],
        alerts: sheet
          ? catalogAlerts(sheet, ours.get(productId) ?? null, tol)
          : [],
        review: pair?.review ?? null,
        pairSheetId: pair?.id ?? null,
        photoDocumentId:
          item?.scalePhotoDocumentId ?? pair?.scalePhotoDocumentId ?? null,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Revisão do Cadastro                                                      */
/* ------------------------------------------------------------------------ */

/**
 * O Cadastro aceita a correção (vale para o fornecedor no portal) ou recusa
 * com o motivo (ele confere de novo na próxima cotação). Não muda o cadastro
 * do produto nem o Sankhya.
 */
export async function reviewSupplierSheet(
  user: User,
  sheetId: string,
  input: { accept: boolean; note: string | null },
  now = new Date(),
): Promise<SupplierProductSheet> {
  if (!isWellmix(user)) throw new SupplierSheetError("forbidden");
  assertCan(user, "supplierSheet.review");
  const store = getStore();
  const sheet = await store.get("supplier_product_sheets", sheetId);
  if (!sheet) throw new SupplierSheetError("not_found");
  if (sheet.review !== "pending")
    throw new SupplierSheetError("supplier_sheet_not_pending");
  const note = input.note?.trim() || null;
  if (!input.accept && !note)
    throw new SupplierSheetError("supplier_sheet_reject_note");
  const updated = await store.update("supplier_product_sheets", sheet.id, {
    review: input.accept ? "accepted" : "rejected",
    reviewedAt: now.toISOString(),
    reviewedByUserId: user.id,
    reviewNote: note,
  });
  const product = await store.get("products", sheet.productId);
  await audit(
    user,
    input.accept ? "supplier_sheet.accept" : "supplier_sheet.reject",
    "supplier_product_sheet",
    sheet.id,
    `Ficha técnica de ${product?.name ?? sheet.productId} (fornecedor ${sheet.supplierId}): correção ${input.accept ? "aceita" : `recusada (${note})`}`,
  );
  if (!input.accept)
    await notify(
      { partyId: sheet.supplierId, role: "supplier" },
      {
        kind: "info",
        link: "/app/purchase-quotes",
        text: (t) => ({
          subject: t("supplierSheet.notify.rejected.subject", {
            product: product?.name ?? "",
          }),
          body: t("supplierSheet.notify.rejected.body", { note: note ?? "" }),
        }),
      },
    );
  return updated;
}

/** As fichas para a tela do Cadastro (pendentes primeiro). */
export async function listSupplierSheets(
  user: User,
  filter: { review?: "pending" | "all" } = {},
) {
  if (!isWellmix(user)) return [];
  const store = getStore();
  const rows = await store
    .list("supplier_product_sheets", {
      ...(filter.review === "pending" ? { filter: { review: "pending" } } : {}),
      orderBy: "updatedAt",
      direction: "desc",
      limit: 500,
    })
    .catch(() => [] as SupplierProductSheet[]);
  const [products, suppliers] = await Promise.all([
    rows.length
      ? store.list("products", {
          filter: { id: [...new Set(rows.map((r) => r.productId))] },
        })
      : Promise.resolve([] as Product[]),
    rows.length
      ? store.list("parties", {
          filter: { id: [...new Set(rows.map((r) => r.supplierId))] },
        })
      : Promise.resolve([]),
  ]);
  return rows
    .map((sheet) => ({
      sheet,
      product: products.find((p) => p.id === sheet.productId) ?? null,
      supplier: suppliers.find((s) => s.id === sheet.supplierId) ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.sheet.review === "pending") -
          Number(a.sheet.review === "pending") ||
        b.sheet.updatedAt.localeCompare(a.sheet.updatedAt),
    );
}

/** Uma ficha para a tela do Cadastro. */
export async function supplierSheetView(user: User, sheetId: string) {
  if (!isWellmix(user)) return null;
  const store = getStore();
  const sheet = await store
    .get("supplier_product_sheets", sheetId)
    .catch(() => null);
  if (!sheet) return null;
  const [product, supplier, quote] = await Promise.all([
    store.get("products", sheet.productId),
    store.get("parties", sheet.supplierId),
    sheet.quoteId ? store.get("purchase_quotes", sheet.quoteId) : null,
  ]);
  return {
    sheet,
    product,
    supplier,
    quote,
    canReview: sheet.review === "pending" && can(user, "supplierSheet.review"),
  };
}

/** Pendências do Cadastro: uma por correção esperando a revisão. */
export async function supplierSheetTaskDrafts(user: User) {
  type Draft = {
    kind: "supplier_sheet_review";
    title: string;
    detail: string;
    link: string;
    dueAt: string | null;
  };
  if (!isWellmix(user) || !can(user, "supplierSheet.review"))
    return [] as Draft[];
  const rows = await listSupplierSheets(user, { review: "pending" });
  return rows.map(({ sheet, product, supplier }): Draft => ({
    kind: "supplier_sheet_review",
    title: `Ficha técnica: ${supplier?.name ?? sheet.supplierId}`,
    detail: product?.name ?? sheet.productId,
    link: `/app/supplier-sheets/${sheet.id}`,
    dueAt: null,
  }));
}
