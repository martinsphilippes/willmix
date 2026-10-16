import "server-only";

import { formatNcm, normalizeNcm } from "@/lib/fiscal";
import {
  getStore,
  type Order,
  type OrderItem,
  type PhotoKind,
  type ProductPhoto,
  type PurchaseSheet,
  type User,
} from "@/lib/db";
import { assertWellmix, canViewOrder, isWellmix } from "@/lib/auth/permissions";
import { canSubmitRequirement, submitRequirement } from "@/lib/workflow/engine";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import {
  catalogPhotoKinds,
  completeMasterFromSheet,
  masterSheetInput,
} from "./product-sheet";
import {
  fillRecordsFromSheet,
  productForSupplier,
  productOfSupplier,
  recordFields,
  sheetRecords,
  withRecordDefaults,
  type SheetRecords,
} from "./sheet-records";
import { productSupplierLink } from "./product-suppliers";
import { scheduleToLots } from "@/lib/workflow/request-schedule";
import { storePhotoDocument, type PhotoSource } from "./documents";
import {
  missingForCompletion,
  REQUIRED_SHEET_PHOTOS,
  normalizeLots,
  isPiecesUnit,
  planSheet,
  sheetTotalPieces,
  type SheetMissing,
  type SheetPlan,
} from "./purchase-sheet-calc";
import { notify, notifyWellmix, requesterTarget } from "./notifications";
import { openReview, resolveReviews } from "./reviews";

export class PurchaseSheetError extends Error {}

/** Fotos da ficha (planilha COMPRAS + mais ângulos): as 5 fotos do produto, que o fornecedor envia. */
export const SHEET_PHOTO_KINDS = [
  "weight_scale",
  "dimension_scale",
  "dimension_side",
  "angle",
  "original",
] as const satisfies readonly PhotoKind[];
export type SheetPhotoKind = (typeof SHEET_PHOTO_KINDS)[number];
/**
 * Tipos que já fizeram parte da ficha (foto de referência e cartão de visita):
 * não são do fornecedor e saíram do formulário. Fotos antigas desses tipos
 * continuam visíveis e excluíveis na ficha; nunca contam como obrigatórias.
 */
export const LEGACY_SHEET_PHOTO_KINDS = [
  "prompt",
  "business_card",
] as const satisfies readonly PhotoKind[];
const VISIBLE_SHEET_PHOTO_KINDS: readonly string[] = [
  ...SHEET_PHOTO_KINDS,
  ...LEGACY_SHEET_PHOTO_KINDS,
];

/** Campos que o fornecedor (e a Wellmix) preenchem. */
export const SUPPLIER_FIELDS = [
  "sheetDate",
  "location",
  "supplierName",
  "supplierStore",
  "supplierPhone",
  "factoryItemCode",
  "incoterm",
  "currency",
  "price",
  "moq",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "heightCm",
  "widthCm",
  "lengthCm",
  "capacityMl",
  "packageType",
  "colorAssortment",
  "colorPantones",
  "material",
  "powerSource",
  "powerDetail",
  "productionStartAt",
  "lots",
  "containerType",
  "ecommerceDescription",
  "notes",
] as const;
/** Campos do despachante (e da Wellmix). */
export const CUSTOMS_FIELDS = [
  "ncm",
  "importTaxPercent",
  "ipiPercent",
] as const;

export type SheetField =
  (typeof SUPPLIER_FIELDS)[number] | (typeof CUSTOMS_FIELDS)[number];
export type SheetInput = Partial<Pick<PurchaseSheet, SheetField>>;

export interface SheetAccess {
  view: boolean;
  editSupplier: boolean;
  editCustoms: boolean;
  /** Fotos: quem edita a parte do fornecedor. */
  addPhotos: boolean;
}

/**
 * Quem vê: Wellmix, o fornecedor do pedido e o despachante do pedido. Cliente
 * nunca (fornecedor, contato e preço). Pedido encerrado: só a Wellmix edita.
 */
export function sheetAccess(user: User, order: Order): SheetAccess {
  const none = {
    view: false,
    editSupplier: false,
    editCustoms: false,
    addPhotos: false,
  };
  if (!canViewOrder(user, order)) return none;
  const closed = order.status === "CLOSED" || order.status === "CANCELLED";
  if (isWellmix(user))
    return {
      view: true,
      editSupplier: true,
      editCustoms: true,
      addPhotos: true,
    };
  if (user.role === "supplier" && order.supplierId === user.partyId)
    return {
      view: true,
      editSupplier: !closed,
      editCustoms: false,
      addPhotos: !closed,
    };
  if (user.role === "broker" && order.brokerId === user.partyId)
    return {
      view: true,
      editSupplier: false,
      editCustoms: !closed,
      addPhotos: false,
    };
  return none;
}

export async function containerCapacity(type: string | null): Promise<{
  type: string | null;
  capacity: number | null;
  types: Array<{ code: string; capacityCbm: number }>;
}> {
  const { containerTypes } = await getSettings();
  const pick =
    containerTypes.find((c) => c.code === type) ??
    containerTypes.find((c) => c.code === "40HC") ??
    [...containerTypes].sort((a, b) => b.capacityCbm - a.capacityCbm)[0];
  return {
    type: pick?.code ?? null,
    capacity: pick?.capacityCbm ?? null,
    types: containerTypes,
  };
}

/** Rascunho a partir do cadastro (produto, cotação escolhida, fornecedor): menos digitação. */
/** De onde veio o rascunho da ficha ainda não salva no pedido. */
export type SheetPrefillSource = "quote" | "previous" | "catalog" | "master";

/**
 * Campos que valem de outra ficha. Da cotação deste pedido vem tudo menos a
 * programação dos lotes; de um pedido anterior, também não vêm a data da
 * ficha nem o início da produção (são deste pedido).
 */
const reusableFields = (source: "quote" | "previous") =>
  [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].filter(
    (k) =>
      k !== "lots" &&
      (source === "quote" || (k !== "sheetDate" && k !== "productionStartAt")),
  );

/**
 * Ficha já preenchida antes para este pedido: a da cotação escolhida (pedidos
 * de antes da cópia automática) ou, na recompra, a do último pedido do mesmo
 * produto com o mesmo fornecedor.
 */
async function earlierSheet(
  order: Order,
  request: { productId: string | null; selectedQuoteId: string | null } | null,
): Promise<{ sheet: PurchaseSheet; source: "quote" | "previous" } | null> {
  const store = getStore();
  if (request?.selectedQuoteId) {
    const [fromQuote] = await store.list("purchase_sheets", {
      filter: { orderId: request.selectedQuoteId },
      limit: 1,
    });
    if (fromQuote) return { sheet: fromQuote, source: "quote" };
  }
  if (!request?.productId) return null;
  const sameProduct = await store.list("requests", {
    filter: { productId: request.productId },
  });
  const orderIds = sameProduct
    .map((r) => r.orderId)
    .filter((id): id is string => !!id && id !== order.id);
  if (!orderIds.length) return null;
  const orders = await store.list("orders", {
    filter: { id: orderIds, supplierId: order.supplierId },
  });
  if (!orders.length) return null;
  // Ficha do pedido anterior ou, se ainda não salva lá, a da cotação dele.
  const ids = orders.flatMap((o) => [
    o.id,
    sameProduct.find((r) => r.orderId === o.id)?.selectedQuoteId ?? o.id,
  ]);
  const [last] = await store.list("purchase_sheets", {
    filter: { orderId: [...new Set(ids)] },
    orderBy: "updatedAt",
    direction: "desc",
    limit: 1,
  });
  return last ? { sheet: last, source: "previous" } : null;
}

async function prefill(
  order: Order,
): Promise<
  SheetInput & { productId: string | null; prefillSource: SheetPrefillSource }
> {
  const base = await prefillBase(order);
  // NCM confirmado na solicitação vale quando a ficha não trouxe um.
  if (base.ncm) return base;
  const request = await getStore().get("requests", order.requestId);
  const confirmed = normalizeNcm(request?.ncm);
  return confirmed ? { ...base, ncm: formatNcm(confirmed) } : base;
}

async function prefillBase(
  order: Order,
): Promise<
  SheetInput & { productId: string | null; prefillSource: SheetPrefillSource }
> {
  const store = getStore();
  const request = await store.get("requests", order.requestId);
  const [product, supplier, quote, link] = await Promise.all([
    request?.productId ? store.get("products", request.productId) : null,
    store.get("parties", order.supplierId),
    request?.selectedQuoteId
      ? store.get("quotes", request.selectedQuoteId)
      : null,
    productSupplierLink(request?.productId, order.supplierId),
  ]);
  // Preço e MOQ do próprio fornecedor do pedido (nunca os do principal, se é outro).
  const own = productOfSupplier(supplier, product);
  const currencyOf = (c: string | null | undefined) => {
    const v = (c ?? "").toUpperCase();
    if (v === "CNY" || v === "RMB") return "RMB" as const;
    return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
  };
  const earlier = await earlierSheet(order, request ?? null);
  // Programação de entregas pedida pelo cliente: as programações da ficha nascem dela.
  const requestLots = (cartonQty: number | null | undefined) =>
    scheduleToLots(request?.schedule, cartonQty ?? null) ?? normalizeLots(null);
  // Ficha mestre do produto (cadastro): vale quando não há ficha desta compra
  // (cotação) nem de uma compra anterior com o mesmo fornecedor; na recompra,
  // só completa o que a ficha dele não tem (a mestre pode ter vindo da compra
  // com outro fornecedor).
  const master = await masterSheetInput(product?.id ?? null);
  // Bloco Fornecedor vem dos cadastros (fornecedor e produto) e prevalece.
  const records = recordFields(
    supplier,
    productForSupplier(product, order.supplierId, link),
  );
  if (master && !earlier) {
    return {
      prefillSource: "master",
      ...master,
      productId: product?.id ?? null,
      supplierName: supplier?.name ?? master.supplierName ?? null,
      supplierPhone: supplier?.phone ?? master.supplierPhone ?? null,
      currency: currencyOf(quote?.currency) ?? master.currency ?? null,
      price: quote?.price ?? master.price ?? null,
      lots: requestLots(master.masterCartonQty),
      ...records,
    };
  }
  if (earlier) {
    const reused = Object.fromEntries(
      reusableFields(earlier.source).map((k) => [k, earlier.sheet[k] ?? null]),
    ) as SheetInput;
    if (earlier.source === "previous" && master) {
      const bag = reused as Record<string, unknown>;
      for (const [k, v] of Object.entries(master))
        if (k !== "lots" && (bag[k] === null || bag[k] === undefined))
          bag[k] = v;
    }
    return {
      ...reused,
      productId: product?.id ?? earlier.sheet.productId ?? null,
      lots:
        earlier.source === "quote" &&
        earlier.sheet.lots?.some((l) => l.masterCartons)
          ? normalizeLots(earlier.sheet.lots)
          : requestLots(earlier.sheet.masterCartonQty),
      prefillSource: earlier.source,
      ...records,
    };
  }
  return {
    prefillSource: "catalog",
    productId: product?.id ?? null,
    ...records,
    currency: currencyOf(
      quote?.currency ?? link?.currency ?? (own ? product?.currency : null),
    ),
    price:
      quote?.price ?? link?.price ?? (own ? (product?.price ?? null) : null),
    moq: link?.moq ?? (own ? (product?.moq ?? null) : null),
    masterCartonQty: product?.masterBoxQty ?? null,
    innerQty: product?.innerBoxQty ?? null,
    netWeightPcKg: product?.netWeightKg ?? null,
    grossWeightPcKg: product?.grossWeightKg ?? null,
    cbmPerCarton: product?.cbm ?? null,
    heightCm: product?.boxHeightCm ?? null,
    widthCm: product?.boxWidthCm ?? null,
    lengthCm: product?.boxLengthCm ?? null,
    colorAssortment: product?.color ?? null,
    colorPantones: product?.colorPantones ?? null,
    material: product?.material ?? null,
    ncm: product?.ncm ?? null,
    lots: requestLots(product?.masterBoxQty),
  };
}

export async function getSheetPhotos(orderId: string): Promise<ProductPhoto[]> {
  const photos = await getStore().list("product_photos", {
    filter: { orderId },
    orderBy: "createdAt",
  });
  return photos.filter((p) => VISIBLE_SHEET_PHOTO_KINDS.includes(p.kind));
}

/** Tipos de foto já enviados; o item antigo "Foto na balança" concluído conta como balança. */
async function photoKindsDone(orderId: string, photos: ProductPhoto[]) {
  const kinds = new Set(photos.map((p) => p.kind as string));
  // Fotos do cadastro do produto contam como enviadas (ficam no catálogo).
  const store0 = getStore();
  const order0 = await store0.get("orders", orderId);
  const request0 = order0
    ? await store0.get("requests", order0.requestId)
    : null;
  for (const k of await catalogPhotoKinds(request0?.productId)) kinds.add(k);
  if (!kinds.has("weight_scale")) {
    const store = getStore();
    const [stage] = await store.list("stages", {
      filter: { orderId, key: "PREPARATION" },
      limit: 1,
    });
    if (stage) {
      const [req] = await store.list("requirements", {
        filter: { stageId: stage.id, key: "photo_scale", status: "done" },
        limit: 1,
      });
      if (req) kinds.add("weight_scale");
    }
  }
  return [...kinds];
}

export interface SheetView {
  order: Order;
  access: SheetAccess;
  /** Ficha gravada, ou o rascunho pré-preenchido quando ainda não existe. */
  sheet: SheetInput & {
    id?: string;
    productId?: string | null;
    completedAt?: string | null;
    updatedAt?: string;
  };
  saved: boolean;
  /** Ficha ainda não salva: de onde veio o rascunho (cotação, pedido anterior ou catálogo). */
  prefillSource: SheetPrefillSource | null;
  photos: ProductPhoto[];
  /** Tipos de foto cobertos pelo cadastro do produto (não precisam ser reenviadas). */
  catalogPhotoKinds: string[];
  /** Bloco Fornecedor: o que falta nos cadastros do fornecedor e do produto. */
  records: SheetRecords;
  plan: SheetPlan;
  missing: SheetMissing[];
  containerType: string | null;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
}

export async function getSheetForUser(
  user: User,
  orderId: string,
): Promise<SheetView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) return null;
  const access = sheetAccess(user, order);
  if (!access.view) return null;
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  const draft = existing ? null : await prefill(order);
  const stored = existing ?? draft!;
  const request = await store.get("requests", order.requestId);
  const records = await sheetRecords(
    user,
    order.supplierId,
    stored.productId ?? request?.productId ?? null,
  );
  // Ficha gravada com campo do cadastro em branco: mostra o valor do cadastro.
  const sheet = existing ? withRecordDefaults(existing, records) : stored;
  const photos = await getSheetPhotos(orderId);
  const container = await containerCapacity(sheet.containerType ?? null);
  return {
    order,
    access,
    sheet,
    saved: !!existing,
    prefillSource: draft?.prefillSource ?? null,
    photos,
    records,
    plan: planSheet(
      {
        lots: sheet.lots ?? null,
        masterCartonQty: sheet.masterCartonQty ?? null,
        cbmPerCarton: sheet.cbmPerCarton ?? null,
        productionStartAt: sheet.productionStartAt ?? null,
        heightCm: sheet.heightCm ?? null,
        widthCm: sheet.widthCm ?? null,
        lengthCm: sheet.lengthCm ?? null,
      },
      container.capacity,
    ),
    missing: missingForCompletion(sheet, await photoKindsDone(orderId, photos)),
    catalogPhotoKinds: await catalogPhotoKinds(request?.productId),
    containerType: container.type,
    containerTypes: container.types,
  };
}

/** Grava só os campos que o papel pode editar; o resto fica como está. */
export async function saveSheet(
  user: User,
  orderId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new PurchaseSheetError("not_found");
  const access = sheetAccess(user, order);
  if (!access.editSupplier && !access.editCustoms)
    throw new PurchaseSheetError("forbidden");
  const allowed = new Set<string>([
    ...(access.editSupplier ? SUPPLIER_FIELDS : []),
    ...(access.editCustoms ? CUSTOMS_FIELDS : []),
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key) && value !== undefined) patch[key] = value;
  }
  if ("lots" in patch) patch.lots = normalizeLots(patch.lots as never);
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  let sheet: PurchaseSheet;
  if (existing) {
    sheet = await store.update("purchase_sheets", existing.id, {
      ...patch,
      updatedByUserId: user.id,
    });
  } else {
    const { prefillSource: _source, ...base } = await prefill(order);
    void _source;
    const blank = Object.fromEntries(
      [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].map((k) => [k, null]),
    );
    sheet = await store.create("purchase_sheets", {
      ...blank,
      ...base,
      ...patch,
      lots: normalizeLots((patch.lots ?? base.lots) as never),
      orderId,
      updatedByUserId: user.id,
      completedAt: null,
    } as Omit<PurchaseSheet, "id" | "createdAt" | "updatedAt">);
  }
  await audit(
    user,
    existing ? "purchase_sheet.update" : "purchase_sheet.create",
    "order",
    orderId,
    `Ficha de compra: ${Object.keys(patch).length} campo(s)`,
  );
  // Completa o cadastro do fornecedor/produto com o que ele não tinha.
  if (access.editSupplier)
    await fillRecordsFromSheet(
      user,
      order.supplierId,
      sheet.productId ?? null,
      sheet,
    );
  if ("lots" in patch || "masterCartonQty" in patch)
    await syncOrderQuantity(
      user,
      order,
      sheet,
      existing ? sheetTotalPieces(existing) : null,
    );
  // O cadastro do produto acompanha a ficha do pedido: a Wellmix atualiza com
  // a compra de verdade; o fornecedor só completa o que falta. Na atualização
  // vai só o que este salvamento mudou (salvar o NCM de um pedido antigo não
  // devolve ao cadastro o preço e a caixa daquela compra); pedido encerrado
  // ou cancelado não mexe no cadastro.
  if (
    access.editSupplier &&
    order.status !== "CLOSED" &&
    order.status !== "CANCELLED"
  ) {
    const adopt = isWellmix(user);
    const before = existing as unknown as Record<string, unknown> | undefined;
    const after = sheet as unknown as Record<string, unknown>;
    const changed =
      adopt && before
        ? Object.fromEntries(
            Object.keys(patch)
              .filter(
                (k) =>
                  JSON.stringify(before[k] ?? null) !==
                  JSON.stringify(after[k] ?? null),
              )
              .map((k) => [k, after[k]]),
          )
        : sheet;
    await completeMasterFromSheet(
      user,
      sheet.productId ?? null,
      changed,
      order.supplierId,
      adopt ? "adopt" : "fill",
    );
  }
  const missing = await syncRequirements(user, order, sheet);
  return { sheet, missing };
}

/** Etapas em que a quantidade ainda acompanha a programação (antes da inspeção). */
export const QUANTITY_FOLLOWS_SHEET: readonly Order["status"][] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
];

/**
 * A quantidade do pedido acompanha as caixas da programação (caixas × peças
 * por caixa master), quando a unidade é peça: quem fecha o container tirando
 * ou pondo caixas já ajusta o pedido. Preço por unidade não muda; FOB e valor
 * ao cliente acompanham. Regras de segurança:
 * - só a Wellmix muda o pedido (valor ao cliente é dela); fornecedor que muda
 *   as caixas avisa a Wellmix, que confirma salvando a ficha;
 * - antes da inspeção, e só antes de pagar o fornecedor: depois do pagamento
 *   abre um item de revisão (acerto à mão), sem mexer em valores sozinho;
 * - pedido já no Sankhya ou com caixas alocadas em container: a Wellmix é
 *   avisada para atualizar lá.
 */
async function syncOrderQuantity(
  user: User,
  orderAtStart: Order,
  sheet: PurchaseSheet,
  previousPieces: number | null,
) {
  if (!QUANTITY_FOLLOWS_SHEET.includes(orderAtStart.status)) return;
  const pieces = sheetTotalPieces(sheet);
  if (pieces === null) return;
  const store = getStore();
  // Leitura fresca do pedido e do item, juntas (outro salvamento pode ter mudado).
  const [order, items] = await Promise.all([
    store.get("orders", orderAtStart.id),
    store.list("order_items", {
      filter: { orderId: orderAtStart.id },
      limit: 1,
    }),
  ]);
  const item = items[0];
  if (!order || !item || !(item.quantity > 0) || item.quantity === pieces)
    return;
  if (!isPiecesUnit(item.unit)) return;
  const link = `/app/orders/${order.id}/purchase-sheet`;
  const supplierPaid = await supplierPaymentRegistered(order.id);
  if (!isWellmix(user)) {
    // Só quando a programação mudou neste salvamento (sem repetir o aviso).
    if (previousPieces !== pieces)
      await notifyWellmix({
        subject: `Pedido #${order.number}: o fornecedor mudou a programação`,
        body: `${item.name}: a programação soma ${pieces} ${item.unit}; o pedido tem ${item.quantity}. ${
          supplierPaid
            ? "Já há pagamento ao fornecedor registrado: confira o acerto e aplique a quantidade na ficha."
            : "Abra a ficha e salve para ajustar a quantidade e os valores."
        }`,
        link,
      });
    return;
  }
  if (supplierPaid) {
    // Uma revisão por mudança (de/para): salvar outro campo depois não reabre
    // o que já foi tratado ou dispensado.
    const seen = (
      await store.list("review_items", {
        filter: {
          entity: "order",
          entityId: order.id,
          rule: "order.quantity_after_payment",
        },
      })
    ).some(
      (r) => r.expected === String(item.quantity) && r.found === String(pieces),
    );
    if (!seen)
      await openReview(user, {
        orderId: order.id,
        entity: "order",
        entityId: order.id,
        rule: "order.quantity_after_payment",
        problem: `A programação passou a ${pieces} ${item.unit} (pedido: ${item.quantity}), mas já há pagamento ao fornecedor registrado. Confira o acerto com o fornecedor e use "Aplicar a quantidade" na ficha para ajustar quantidade, FOB e valor ao cliente.`,
        expected: item.quantity,
        found: pieces,
        responsibleRole: "operator",
        link,
      });
    return;
  }
  await applyQuantity(user, order, item, pieces, false);
}

/** Há pagamento ao fornecedor registrado (pedido, confirmado ou recebido)? */
export async function supplierPaymentRegistered(
  orderId: string,
): Promise<boolean> {
  const rows = await getStore().list("payments", {
    filter: { orderId, direction: "supplier_out" },
    limit: 1,
  });
  return rows.length > 0;
}

/**
 * "Aplicar a quantidade" (Wellmix): depois de pagar o fornecedor a ficha não
 * muda o pedido sozinha; quem confere o acerto aplica as caixas da
 * programação na quantidade, no FOB e no valor ao cliente, com auditoria.
 */
export async function applySheetQuantity(
  user: User,
  orderId: string,
): Promise<{ from: number; to: number } | null> {
  assertWellmix(user);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new PurchaseSheetError("not_found");
  if (!QUANTITY_FOLLOWS_SHEET.includes(order.status))
    throw new PurchaseSheetError("quantity_locked");
  const [[sheet], [item]] = await Promise.all([
    store.list("purchase_sheets", { filter: { orderId }, limit: 1 }),
    store.list("order_items", { filter: { orderId }, limit: 1 }),
  ]);
  const pieces = sheet ? sheetTotalPieces(sheet) : null;
  if (
    !item ||
    !(item.quantity > 0) ||
    pieces === null ||
    !isPiecesUnit(item.unit)
  )
    throw new PurchaseSheetError("quantity_locked");
  if (item.quantity === pieces) return null;
  const from = item.quantity;
  await applyQuantity(user, order, item, pieces, true);
  await resolveReviews(user, "order", order.id, {
    rulePrefix: "order.quantity_after_payment",
    note: `Quantidade aplicada: ${from} → ${pieces} ${item.unit}`,
  });
  return { from, to: pieces };
}

async function applyQuantity(
  user: User,
  order: Order,
  item: OrderItem,
  pieces: number,
  afterPayment: boolean,
) {
  const store = getStore();
  const ratio = pieces / item.quantity;
  const money = (v: number | null) =>
    v === null ? null : Math.round(v * ratio * 100) / 100;
  const fobTotal =
    item.unitPrice !== null
      ? Math.round(item.unitPrice * pieces * 100) / 100
      : money(order.fobTotal);
  const sellPrice = money(order.sellPrice);
  await store.update("order_items", item.id, { quantity: pieces });
  await store.update("orders", order.id, { fobTotal, sellPrice });
  await audit(
    user,
    "order.quantity_from_sheet",
    "order",
    order.id,
    `Quantidade ajustada à programação da ficha${
      afterPayment ? " (com pagamento ao fornecedor registrado)" : ""
    }: ${item.quantity} → ${pieces} ${item.unit}`,
    {
      quantity: item.quantity,
      fobTotal: order.fobTotal,
      sellPrice: order.sellPrice,
    },
    { quantity: pieces, fobTotal, sellPrice, afterPayment },
  );
  await notify(requesterTarget(order.requestedByUserId), {
    subject: `Pedido #${order.number}: quantidade ajustada`,
    body: `${item.name}: ${item.quantity} → ${pieces} ${item.unit} para fechar o container.${
      sellPrice !== null && order.sellCurrency
        ? ` Novo valor: ${order.sellCurrency} ${sellPrice.toFixed(2)}.`
        : ""
    }`,
    link: `/app/orders/${order.id}`,
  });
  // Fora do portal: Sankhya e containers já montados não mudam sozinhos.
  const allocated = await store.list("container_items", {
    filter: { orderItemId: item.id },
  });
  if (order.erpNumber || allocated.length)
    await notifyWellmix({
      subject: `Pedido #${order.number}: atualize a quantidade fora do portal`,
      body: [
        `${item.name}: ${item.quantity} → ${pieces} ${item.unit}.`,
        order.erpNumber
          ? `Atualize o pedido ${order.erpNumber} no Sankhya.`
          : null,
        allocated.length
          ? `Confira as caixas alocadas em container (${allocated.length} item(ns)).`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      link: `/app/orders/${order.id}`,
    });
}

/** Fotos da ficha (várias por tipo). Ficam no pedido, nunca no catálogo do cliente. */
export async function addSheetPhotos(
  user: User,
  orderId: string,
  kind: SheetPhotoKind,
  files: PhotoSource[],
): Promise<number> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new PurchaseSheetError("not_found");
  if (!sheetAccess(user, order).addPhotos)
    throw new PurchaseSheetError("forbidden");
  if (!(SHEET_PHOTO_KINDS as readonly string[]).includes(kind))
    throw new PurchaseSheetError("invalid_kind");
  if (!files.length) throw new PurchaseSheetError("photo_required");
  const now = new Date().toISOString();
  // Várias fotos sobem em paralelo (antes, uma depois da outra).
  await Promise.all(
    files.slice(0, 12).map(async (file) => {
      const doc = await storePhotoDocument(user, file, {
        orderId,
        type: "photo",
        // Fornecedor e Wellmix (e parceiros do pedido); cliente não (cartão, origem).
        visibility: "supplier",
      });
      await store.create("product_photos", {
        productId: null,
        sourcingItemId: null,
        orderId,
        documentId: doc.id,
        kind,
        caption: null,
        takenAt: now,
        takenByUserId: user.id,
        derivedFromPhotoId: null,
        isPrimary: false,
      });
    }),
  );
  // A foto na balança também cumpre o requisito "Foto na balança" da Preparação.
  if (kind === "weight_scale") {
    const prep = await activePreparation(orderId);
    const req = prep?.requirements.find(
      (r) => r.key === "photo_scale" && r.status !== "done",
    );
    const [photo] = (await getSheetPhotos(orderId)).filter(
      (p) => p.kind === "weight_scale",
    );
    if (req && photo && canSubmitRequirement(user, order, req))
      await submitRequirement(user, req.id, { documentId: photo.documentId });
  }
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  // Só fotos obrigatórias podem concluir a ficha; as outras não precisam recalcular.
  if (sheet && kind in REQUIRED_SHEET_PHOTOS)
    await syncRequirements(user, order, sheet);
  return Math.min(files.length, 12);
}

/**
 * Exclui uma foto da ficha: quem pode enviar fotos pode excluir. Some da ficha e
 * da lista de documentos do pedido; o arquivo é apagado. A exclusão fica na
 * auditoria (quem, quando, tipo e nome do arquivo).
 */
export async function removeSheetPhoto(
  user: User,
  orderId: string,
  photoId: string,
): Promise<void> {
  const store = getStore();
  const [order, photo] = await Promise.all([
    store.get("orders", orderId),
    store.get("product_photos", photoId),
  ]);
  if (!order || !photo || photo.orderId !== orderId)
    throw new PurchaseSheetError("not_found");
  if (!sheetAccess(user, order).addPhotos)
    throw new PurchaseSheetError("forbidden");
  if (!VISIBLE_SHEET_PHOTO_KINDS.includes(photo.kind))
    throw new PurchaseSheetError("not_found");
  const doc = await store.get("documents", photo.documentId);
  await store.remove("product_photos", photo.id);
  if (doc && doc.orderId === orderId) {
    await store.remove("documents", doc.id);
    await store.removeFile(doc.storageKey).catch((error) => {
      console.error("removeSheetPhoto: arquivo não apagado", error);
    });
  }
  await audit(
    user,
    "purchase_sheet.photo_remove",
    "order",
    orderId,
    `Foto excluída da ficha: ${photo.kind}${doc ? ` (${doc.name})` : ""}`,
  );
}

async function activePreparation(orderId: string) {
  const store = getStore();
  const [stage] = await store.list("stages", {
    filter: { orderId, key: "PREPARATION" },
    limit: 1,
  });
  if (!stage || (stage.status !== "active" && stage.status !== "blocked"))
    return null;
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  return { stage, requirements };
}

/**
 * Liga a ficha ao checklist da Preparação: ficha completa conclui "Ficha de
 * compra"; o peso líquido por peça preenche "Peso (kg)" (comparado na inspeção).
 */
async function syncRequirements(
  user: User,
  order: Order,
  sheet: PurchaseSheet,
): Promise<SheetMissing[]> {
  const store = getStore();
  const photos = await getSheetPhotos(order.id);
  const missing = missingForCompletion(
    sheet,
    await photoKindsDone(order.id, photos),
  );
  if (!missing.length && !sheet.completedAt) {
    await store.update("purchase_sheets", sheet.id, {
      completedAt: new Date().toISOString(),
    });
  }
  const prep = await activePreparation(order.id);
  if (!prep) return missing;
  const weight = prep.requirements.find(
    (r) => r.key === "weight" && r.status !== "done",
  );
  if (
    weight &&
    sheet.netWeightPcKg &&
    sheet.netWeightPcKg > 0 &&
    canSubmitRequirement(user, order, weight)
  ) {
    await submitRequirement(user, weight.id, {
      value: String(sheet.netWeightPcKg),
      note: "Peso líquido por peça (ficha de compra)",
    });
  }
  const sheetReq = prep.requirements.find(
    (r) => r.key === "purchase_sheet" && r.status !== "done",
  );
  if (
    sheetReq &&
    !missing.length &&
    canSubmitRequirement(user, order, sheetReq)
  ) {
    const container = await containerCapacity(sheet.containerType);
    const plan = planSheet(sheet, container.capacity);
    const summary = [
      `${sheet.incoterm ?? ""} ${sheet.currency ?? ""} ${sheet.price ?? ""}`.trim(),
      plan.totalPieces !== null ? `${plan.totalPieces} pcs` : null,
      plan.totalCbm !== null ? `${plan.totalCbm} m³` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    await submitRequirement(user, sheetReq.id, {
      value: summary || "Ficha completa",
    });
  }
  return missing;
}

/** Situação da ficha no checklist do pedido: salva? de onde vem o rascunho? o que falta? */
export async function sheetProgress(order: Order) {
  const store = getStore();
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId: order.id },
    limit: 1,
  });
  const draft = existing ? null : await prefill(order);
  const photos = await getSheetPhotos(order.id);
  return {
    saved: !!existing,
    prefillSource: draft?.prefillSource ?? null,
    missing: missingForCompletion(
      existing ?? draft,
      await photoKindsDone(order.id, photos),
    ),
  };
}

/**
 * Preparação acabou de começar: se a ficha (vinda da cotação) já está completa,
 * os requisitos se cumprem na hora e a etapa se conclui sozinha.
 */
export async function syncPreparationFromSheet(user: User, orderId: string) {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) return;
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  if (sheet) await syncRequirements(user, order, sheet);
}
