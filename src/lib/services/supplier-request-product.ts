import "server-only";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  PRODUCT_EXTRA_DEFAULTS,
  type BookingItem,
  type BookingLot,
  type Product,
  type SupplierRequest,
  type User,
} from "@/lib/db";
import {
  itemSearchText,
  matchesItemSearch,
  searchWords,
} from "@/lib/supplier-requests";
import { normalizeNcm } from "@/lib/fiscal";
import { audit } from "./audit";
import type { SheetInput } from "./purchase-sheet";

/*
 * Depois da solicitação ao fornecedor aprovada (docs/SUPPLIER_REQUESTS.md,
 * "Produto"): o analista cria o produto (nome correto e linha; o resto vem do
 * item e da resposta do fornecedor) ou associa a um que já existe, liga a
 * ele os itens iguais de vários bookings e grava o código do Sankhya
 * (CODPROD). O produto criado fica fora da vitrine até ser liberado.
 *
 * Só a Wellmix com as telas Cotações (a solicitação) e Produtos (o cadastro).
 */

export class RequestProductError extends Error {}

const MAX_ITEMS = 60;
const ITEM_SEARCH_MAX = 40;
const PRODUCT_SEARCH_MAX = 20;

function assertCatalog(user: User) {
  assertWellmix(user);
  assertScreen(user, "quotes");
  assertScreen(user, "products");
}

const clip = (s: string | null | undefined, max: number) => {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

async function approvedRequest(id: string): Promise<SupplierRequest> {
  const request = await getStore().get("supplier_requests", id);
  if (!request) throw new RequestProductError("not_found");
  if (request.status !== "approved")
    throw new RequestProductError("request_product_not_approved");
  return request;
}

/* ------------------------------------------------------------------------ */
/* Busca (itens e produtos)                                                  */
/* ------------------------------------------------------------------------ */

export interface ItemChoice {
  item: BookingItem;
  lot: BookingLot | null;
  supplierName: string | null;
}

/**
 * Itens que podem ser ligados ao produto: o escolhido e as alternativas da
 * solicitação, mais os que a busca achar nos bookings fechados (os já
 * ligados a outro produto ficam de fora).
 */
export async function requestItemChoices(
  request: SupplierRequest,
  query: string,
): Promise<{ suggested: ItemChoice[]; found: ItemChoice[] }> {
  const store = getStore();
  const baseIds = [
    request.bookingItemId,
    ...(request.alternativeItemIds ?? []),
  ];
  const base = await store.list("booking_items", { filter: { id: baseIds } });
  let found: BookingItem[] = [];
  const words = searchWords(query);
  if (words.length) {
    const lots = await store.list("booking_lots", {
      filter: { status: ["closed", "in_progress", "done"] },
    });
    found = lots.length
      ? (
          await store.list("booking_items", {
            filter: { lotId: lots.map((l) => l.id) },
          })
        )
          .filter(
            (i) =>
              !baseIds.includes(i.id) &&
              !i.productId &&
              matchesItemSearch(itemSearchText(i), words),
          )
          .slice(0, ITEM_SEARCH_MAX)
      : [];
  }
  const all = [...base, ...found];
  const lotIds = [...new Set(all.map((i) => i.lotId))];
  const lots = lotIds.length
    ? await store.list("booking_lots", { filter: { id: lotIds } })
    : [];
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const supplierIds = [
    ...new Set(lots.map((l) => l.supplierId).filter((s): s is string => !!s)),
  ];
  const parties = supplierIds.length
    ? await store.list("parties", { filter: { id: supplierIds } })
    : [];
  const nameOf = new Map(parties.map((p) => [p.id, p.name]));
  const choice = (item: BookingItem): ItemChoice => {
    const lot = lotOf.get(item.lotId) ?? null;
    return {
      item,
      lot,
      supplierName: lot?.supplierId
        ? (nameOf.get(lot.supplierId) ?? null)
        : null,
    };
  };
  // O escolhido primeiro, depois as alternativas na ordem guardada.
  const order = new Map(baseIds.map((id, i) => [id, i]));
  return {
    suggested: base
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(choice),
    found: found.map(choice),
  };
}

/** Produtos do catálogo pelo nome, código ou código da fábrica (para associar). */
export async function searchCatalogProducts(query: string): Promise<Product[]> {
  const words = searchWords(query);
  if (!words.length) return [];
  const products = await getStore().list("products", { orderBy: "name" });
  const fold = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return products
    .filter((p) =>
      matchesItemSearch(
        fold(
          [p.name, p.sku, p.supplierSku, p.sankhyaCode].filter(Boolean).join(" "),
        ),
        words,
      ),
    )
    .slice(0, PRODUCT_SEARCH_MAX);
}

/* ------------------------------------------------------------------------ */
/* Criar ou associar                                                         */
/* ------------------------------------------------------------------------ */

/** Ficha mestre do produto: o item do booking, com preço, moeda e MOQ da resposta. */
export function sheetFromRequest(
  request: SupplierRequest,
  item: BookingItem | null,
  supplierName: string | null,
): SheetInput {
  const it = request.item;
  const price = request.supplierPrice ?? it.price;
  const currency =
    request.supplierPrice !== null ? request.supplierCurrency : it.currency;
  const out: SheetInput = {
    supplierName: supplierName ?? undefined,
    factoryItemCode: it.factoryItemCode ?? undefined,
    incoterm: it.incoterm ?? undefined,
    currency: currency ?? undefined,
    price: price ?? undefined,
    moq: request.supplierMoq ?? it.moq ?? undefined,
    masterCartonQty: it.masterCartonQty ?? undefined,
    innerQty: it.innerQty ?? undefined,
    netWeightPcKg: it.netWeightPcKg ?? undefined,
    grossWeightPcKg: it.grossWeightPcKg ?? undefined,
    cbmPerCarton: it.cbmPerCarton ?? undefined,
    heightCm: it.heightCm ?? undefined,
    widthCm: it.widthCm ?? undefined,
    lengthCm: it.lengthCm ?? undefined,
    capacityMl: it.capacityMl ?? undefined,
    packageType: it.packageType ?? undefined,
    colorAssortment: it.colorAssortment ?? undefined,
    material: it.material ?? undefined,
    powerDetail: it.powerDetail ?? undefined,
    ncm: normalizeNcm(item?.ncm) ?? undefined,
  };
  if (item?.purchaseSchedule || request.needs)
    out.notes = [
      request.needs ? `Wellmix: ${request.needs}` : null,
      item?.purchaseSchedule
        ? `Purchase schedule: ${item.purchaseSchedule}`
        : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);
  return out;
}

/**
 * Liga os itens ao produto e os fornecedores deles à lista do produto. O
 * escolhido sempre entra; item ligado a outro produto recusa (não muda de
 * produto sem querer).
 */
async function linkItems(
  user: User,
  request: SupplierRequest,
  product: Product,
  itemIds: string[],
): Promise<number> {
  const store = getStore();
  const ids = [...new Set([request.bookingItemId, ...itemIds])].slice(
    0,
    MAX_ITEMS,
  );
  const items = await store.list("booking_items", { filter: { id: ids } });
  for (const item of items)
    if (item.productId && item.productId !== product.id)
      throw new RequestProductError("request_product_item_taken");
  const lotIds = [...new Set(items.map((i) => i.lotId))];
  const lots = lotIds.length
    ? await store.list("booking_lots", { filter: { id: lotIds } })
    : [];
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const { linkSupplierFromBooking } = await import("./product-suppliers");
  for (const item of items) {
    if (item.productId !== product.id)
      await store.update("booking_items", item.id, {
        productId: product.id,
        updatedByUserId: user.id,
      });
    const supplierId = lotOf.get(item.lotId)?.supplierId;
    if (!supplierId) continue;
    const isChosen = item.id === request.bookingItemId;
    await linkSupplierFromBooking(
      user,
      product.id,
      supplierId,
      isChosen
        ? {
            supplierSku: item.factoryItemCode,
            price: request.supplierPrice ?? item.price,
            currency:
              request.supplierPrice !== null
                ? request.supplierCurrency
                : item.currency,
            moq: request.supplierMoq ?? item.moq,
            leadTimeDays: request.supplierLeadTimeDays,
          }
        : {
            supplierSku: item.factoryItemCode,
            price: item.price,
            currency: item.currency,
            moq: item.moq,
            leadTimeDays: null,
          },
      isChosen ? "quote" : "manual",
    );
  }
  return items.length;
}

async function copyPhoto(
  user: User,
  productId: string,
  documentId: string | null,
) {
  if (!documentId) return;
  try {
    const store = getStore();
    const doc = await store.get("documents", documentId);
    const file = doc ? await store.getFile(doc.storageKey) : null;
    if (!doc || !file) return;
    const { addPhotos } = await import("./sourcing");
    await addPhotos(
      user,
      { productId },
      [new File([new Uint8Array(file.bytes)], doc.name, { type: doc.mime })],
      "supplier",
    );
  } catch (error) {
    // Foto é conveniência: o produto nasce sem ela.
    console.error("copyPhoto(supplier_request)", error);
  }
}

export interface CreateRequestProductInput {
  name: string;
  lineId: string;
  itemIds: string[];
}

/** Cria o produto (fora da vitrine) a partir da solicitação aprovada. */
export async function createProductFromRequest(
  user: User,
  requestId: string,
  input: CreateRequestProductInput,
): Promise<Product> {
  assertCatalog(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (request.productId)
    throw new RequestProductError("request_product_exists");
  const name = clip(input.name, 160);
  if (!name) throw new RequestProductError("request_product_name_required");
  const line = await store.get("product_lines", input.lineId);
  if (!line || !line.active)
    throw new RequestProductError("request_product_line_invalid");
  const supplier = await store.get("parties", request.supplierId);
  const item = await store.get("booking_items", request.bookingItemId);
  const it = request.item;
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: line.id,
    name,
    sku: null,
    specification: null,
    active: true,
    supplierId: request.supplierId,
    supplierSku: clip(it.factoryItemCode, 60),
    material: clip(it.material, 120),
    lengthCm: it.lengthCm,
    widthCm: it.widthCm,
    heightCm: it.heightCm,
    source: "import",
    // NCM do item escolhido (aproximação, despachante ou Wellmix).
    ncm: normalizeNcm(item?.ncm) ?? null,
  });
  // Fora da vitrine já: a marca vai na solicitação antes de qualquer outra gravação.
  const now = new Date().toISOString();
  await store.update("supplier_requests", request.id, {
    productId: product.id,
    productAction: "created",
    productLinkedAt: now,
    productLinkedByUserId: user.id,
    showcaseReleasedAt: null,
    showcaseReleasedByUserId: null,
  });
  const { saveProductSheet } = await import("./product-sheet");
  await saveProductSheet(
    user,
    product.id,
    sheetFromRequest(request, item, supplier?.name ?? null),
  );
  const linked = await linkItems(user, request, product, input.itemIds);
  await copyPhoto(user, product.id, it.photoDocumentId);
  await audit(
    user,
    "product.create",
    "product",
    product.id,
    `${name} (solicitação ao fornecedor nº ${request.number}, ${linked} itens de booking)`,
  );
  return product;
}

/** Associa a solicitação aprovada a um produto que já existe (continua como está na vitrine). */
export async function linkRequestToProduct(
  user: User,
  requestId: string,
  input: { productId: string; itemIds: string[] },
): Promise<Product> {
  assertCatalog(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (request.productId)
    throw new RequestProductError("request_product_exists");
  const product = await store.get("products", input.productId);
  if (!product || !product.active)
    throw new RequestProductError("request_product_not_found");
  await store.update("supplier_requests", request.id, {
    productId: product.id,
    productAction: "linked",
    productLinkedAt: new Date().toISOString(),
    productLinkedByUserId: user.id,
  });
  const linked = await linkItems(user, request, product, input.itemIds);
  await audit(
    user,
    "product.link_booking",
    "product",
    product.id,
    `Solicitação ao fornecedor nº ${request.number} associada (${linked} itens de booking)`,
  );
  return product;
}

/** Liga mais itens ao produto da solicitação (depois de criado ou associado). */
export async function linkMoreItems(
  user: User,
  requestId: string,
  itemIds: string[],
): Promise<number> {
  assertCatalog(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (!request.productId)
    throw new RequestProductError("request_product_missing");
  const product = await store.get("products", request.productId);
  if (!product) throw new RequestProductError("request_product_not_found");
  return linkItems(user, request, product, itemIds);
}

/** Libera na vitrine o produto criado pela solicitação. */
export async function releaseRequestProduct(
  user: User,
  requestId: string,
): Promise<void> {
  assertCatalog(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (request.productAction !== "created" || !request.productId)
    throw new RequestProductError("request_product_missing");
  if (request.showcaseReleasedAt) return;
  await store.update("supplier_requests", request.id, {
    showcaseReleasedAt: new Date().toISOString(),
    showcaseReleasedByUserId: user.id,
  });
  await audit(
    user,
    "product.showcase_release",
    "product",
    request.productId,
    `Liberado na vitrine (solicitação ao fornecedor nº ${request.number})`,
  );
}

/* ------------------------------------------------------------------------ */
/* Sankhya                                                                   */
/* ------------------------------------------------------------------------ */

export type ErpSearch =
  | {
      status: "ok";
      rows: Array<{ code: string; name: string; ref: string | null }>;
    }
  | { status: "not_configured" }
  | { status: "error"; code: string };

/** Produtos do Sankhya pela descrição (parte) ou pela referência do fornecedor. */
export async function searchSankhyaProducts(term: string): Promise<ErpSearch> {
  const q = term.trim().slice(0, 60);
  if (!q) return { status: "ok", rows: [] };
  const { loadRecords, SankhyaError } =
    await import("@/lib/integrations/sankhya-client");
  try {
    const result = await loadRecords({
      entity: "Produto",
      fields: "CODPROD, DESCRPROD, REFFORN",
      where: "UPPER(DESCRPROD) LIKE ? OR UPPER(REFFORN) = ?",
      params: [
        { type: "S", value: `%${q.toUpperCase()}%` },
        { type: "S", value: q.toUpperCase() },
      ],
    });
    return {
      status: "ok",
      rows: result.rows.slice(0, 30).map((r) => ({
        code: String(r.CODPROD ?? ""),
        name: String(r.DESCRPROD ?? ""),
        ref: r.REFFORN ? String(r.REFFORN) : null,
      })),
    };
  } catch (error) {
    if (error instanceof SankhyaError)
      return error.code === "sankhya_not_configured"
        ? { status: "not_configured" }
        : { status: "error", code: error.code };
    throw error;
  }
}

/**
 * Grava o CODPROD no produto da solicitação. Com o Sankhya configurado, o
 * código é conferido no ERP (inexistente recusa); sem ele, fica gravado como
 * "não conferido". Vazio tira o código.
 */
export async function setRequestProductErpCode(
  user: User,
  requestId: string,
  rawCode: string,
): Promise<{ checked: boolean }> {
  assertCatalog(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (!request.productId)
    throw new RequestProductError("request_product_missing");
  const code = rawCode.trim();
  if (code && !/^\d{1,10}$/.test(code))
    throw new RequestProductError("request_erp_code_invalid");
  let checked = false;
  if (code) {
    const { loadRecords, SankhyaError } =
      await import("@/lib/integrations/sankhya-client");
    try {
      const found = await loadRecords({
        entity: "Produto",
        fields: "CODPROD",
        where: "CODPROD = ?",
        params: [{ type: "I", value: code }],
      });
      if (!found.rows.length)
        throw new RequestProductError("request_erp_code_not_found");
      checked = true;
    } catch (error) {
      // Sem credencial ou ERP fora do ar: grava sem conferir (a tela diz).
      if (!(error instanceof SankhyaError)) throw error;
    }
  }
  const product = await store.get("products", request.productId);
  if (!product) throw new RequestProductError("request_product_not_found");
  // Coluna nova: o vazio só vai ao banco para apagar um código já gravado.
  if (code || product.sankhyaCode)
    await store.update("products", product.id, { sankhyaCode: code || null });
  await store.update("supplier_requests", request.id, {
    erpCheckedAt: checked ? new Date().toISOString() : null,
  });
  await audit(
    user,
    "product.erp_code",
    "product",
    product.id,
    `CODPROD ${code || "-"} ${checked ? "(conferido no Sankhya)" : "(não conferido)"}`,
    { sankhyaCode: product.sankhyaCode ?? null },
    { sankhyaCode: code || null },
  );
  return { checked };
}

/* ------------------------------------------------------------------------ */
/* Vitrine                                                                   */
/* ------------------------------------------------------------------------ */

/** Produtos criados por solicitação ao fornecedor que ainda não foram liberados na vitrine. */
export async function unreleasedRequestProductIds(): Promise<Set<string>> {
  const rows = await getStore().list("supplier_requests", {
    filter: { productAction: "created" },
  });
  return new Set(
    rows
      .filter((r) => r.productId && !r.showcaseReleasedAt)
      .map((r) => r.productId as string),
  );
}
