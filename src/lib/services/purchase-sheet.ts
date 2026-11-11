import "server-only";

import { formatAmount } from "@/lib/workflow/money";
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
import { catalogPhotoKinds, masterSheetInput } from "./product-sheet";
import { completeFromOrderSheet } from "./variant-sales";
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
  supplierMissing,
  REQUIRED_SHEET_PHOTOS,
  normalizeLots,
  isPiecesUnit,
  planSheet,
  sheetTotalPieces,
  withBoxCbm,
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
/**
 * Fotos opcionais da ficha (Fase B): foto HD do produto e die cut (faca),
 * pedidas ao fornecedor para o Marketing. Não contam como obrigatórias.
 */
export const EXTRA_SHEET_PHOTO_KINDS = [
  "hd",
  "die_cut",
] as const satisfies readonly PhotoKind[];
/** Tudo o que se pode adicionar na ficha (obrigatórias + opcionais). */
export const ADDABLE_SHEET_PHOTO_KINDS = [
  ...SHEET_PHOTO_KINDS,
  ...EXTRA_SHEET_PHOTO_KINDS,
] as const;
export type SheetPhotoKind = (typeof ADDABLE_SHEET_PHOTO_KINDS)[number];
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
  "averageWeightPcKg",
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
/** Programação de compra: só a Wellmix preenche (dono, 10/11/2026). */
export const SCHEDULE_FIELDS = [
  "productionStartAt",
  "lots",
  "containerType",
] as const satisfies readonly (typeof SUPPLIER_FIELDS)[number][];
/** Campos do despachante (e da Wellmix). */
export const CUSTOMS_FIELDS = [
  "ncm",
  "importTaxPercent",
  "ipiPercent",
  // Fase B: antidumping, média e necessidade de certificação.
  "dumping",
  "dumpingNote",
  "averagePrice",
  "certificationRequired",
  "certificationNote",
] as const;

export type SheetField =
  (typeof SUPPLIER_FIELDS)[number] | (typeof CUSTOMS_FIELDS)[number];

/**
 * Colunas novas da ficha (Fase B): só vão ao banco quando têm valor, para
 * fichas seguirem salvando antes de o esquema ser publicado.
 */
export const OPTIONAL_SHEET_FIELDS: readonly string[] = [
  "dumping",
  "dumpingNote",
  "averagePrice",
  "certificationRequired",
  "certificationNote",
  "averageWeightPcKg",
];

/** Tira as colunas novas vazias de um objeto de ficha (muda no lugar). */
export function dropEmptyOptional<T extends Record<string, unknown>>(
  row: T,
): T {
  for (const k of OPTIONAL_SHEET_FIELDS)
    if (row[k] === null || row[k] === undefined) delete row[k];
  return row;
}
/**
 * Apagar uma coluna nova (valor vazio) só vai ao banco quando a ficha já tem
 * valor nela: aí a coluna com certeza existe. Sem valor gravado, o vazio não
 * muda nada e sai do pacote (a ficha continua salvando antes de o esquema
 * ser publicado). Muda o pacote no lugar.
 */
export function dropUnsavedEmptyOptional(
  patch: Record<string, unknown>,
  existing: Partial<PurchaseSheet> | null | undefined,
): void {
  for (const k of OPTIONAL_SHEET_FIELDS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v !== null && v !== undefined) continue;
    const saved = (existing as Record<string, unknown> | null | undefined)?.[k];
    if (saved === null || saved === undefined) delete patch[k];
  }
}
export type SheetInput = Partial<Pick<PurchaseSheet, SheetField>>;

export interface SheetAccess {
  view: boolean;
  editSupplier: boolean;
  editCustoms: boolean;
  /** Fotos: quem edita a parte do fornecedor. */
  addPhotos: boolean;
}

/**
 * Campos da ficha que a certificadora não recebe. Hoje nenhum: ela vê tudo
 * do pedido (decisão do dono, 10/11/2026). Para tirar um campo dela, basta
 * incluí-lo aqui (ex.: "price", "moq"): ele não sai do servidor.
 */
export const CERTIFIER_HIDDEN_FIELDS: readonly SheetField[] = [];

/**
 * Certificadora (OCP) do pedido: precisa do pedido completo para gerar o
 * selo de certificação (docs/CERTIFICATION.md). Lê a ficha, não edita nada.
 */
export function isSheetCertifier(
  user: Pick<User, "role" | "partyId">,
  order: Pick<Order, "ocpId">,
): boolean {
  return user.role === "ocp" && !!user.partyId && order.ocpId === user.partyId;
}

/**
 * Quem vê: Wellmix, o fornecedor do pedido, o despachante do pedido e a
 * certificadora do pedido (só leitura). Cliente
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
  if (isSheetCertifier(user, order)) return { ...none, view: true };
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

/** Rascunho a partir do cadastro (produto, fornecedor): menos digitação. */
/** De onde veio o rascunho da ficha ainda não salva no pedido. */
export type SheetPrefillSource = "previous" | "catalog" | "master";

/**
 * Campos que valem da ficha de um pedido anterior: tudo menos a programação
 * dos lotes, a data da ficha e o início da produção (são deste pedido).
 */
const reusableFields = () =>
  [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].filter(
    (k) => k !== "lots" && k !== "sheetDate" && k !== "productionStartAt",
  );

/**
 * Ficha já preenchida antes: na recompra, a do último pedido do mesmo
 * produto com o mesmo fornecedor.
 */
async function earlierSheet(
  order: Order,
  request: { productId: string | null } | null,
): Promise<{ sheet: PurchaseSheet; source: "previous" } | null> {
  const store = getStore();
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
  const [last] = await store.list("purchase_sheets", {
    filter: { orderId: orders.map((o) => o.id) },
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
  const [product, supplier, link] = await Promise.all([
    request?.productId ? store.get("products", request.productId) : null,
    store.get("parties", order.supplierId),
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
  // Ficha mestre do produto (cadastro): vale quando não há ficha de uma
  // compra anterior com o mesmo fornecedor; na recompra,
  // só completa o que a ficha dele não tem (a mestre pode ter vindo da compra
  // com outro fornecedor).
  const master = await masterSheetInput(
    product?.id ?? null,
    request?.variant ?? null,
  );
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
      currency: master.currency ?? null,
      price: master.price ?? null,
      lots: requestLots(master.masterCartonQty),
      ...records,
    };
  }
  if (earlier) {
    const reused = dropEmptyOptional(
      Object.fromEntries(
        reusableFields().map((k) => [k, earlier.sheet[k] ?? null]),
      ),
    ) as SheetInput;
    if (master) {
      const bag = reused as Record<string, unknown>;
      for (const [k, v] of Object.entries(master))
        if (k !== "lots" && (bag[k] === null || bag[k] === undefined))
          bag[k] = v;
    }
    return {
      ...reused,
      productId: product?.id ?? earlier.sheet.productId ?? null,
      lots: requestLots(earlier.sheet.masterCartonQty),
      prefillSource: earlier.source,
      ...records,
    };
  }
  return {
    prefillSource: "catalog",
    productId: product?.id ?? null,
    ...records,
    currency: currencyOf(link?.currency ?? (own ? product?.currency : null)),
    price: link?.price ?? (own ? (product?.price ?? null) : null),
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
  /** Início da produção automático (contrato assinado + prazo das Configurações). */
  productionStart: import("./order-signature").ProductionStart;
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
  const full = existing ? withRecordDefaults(existing, records) : stored;
  // Certificadora: a ficha inteira, menos os campos de CERTIFIER_HIDDEN_FIELDS.
  const sheet = isSheetCertifier(user, order)
    ? {
        ...full,
        ...Object.fromEntries(CERTIFIER_HIDDEN_FIELDS.map((k) => [k, null])),
      }
    : { ...full };
  // Início da produção: vem do contrato assinado mais o prazo das
  // Configurações. Ficha sem a data gravada mostra a calculada.
  const { productionStartFor } = await import("./order-signature");
  const productionStart = await productionStartFor(orderId);
  if (productionStart.auto)
    sheet.productionStartAt = productionStart.at ?? sheet.productionStartAt;
  const photos = await getSheetPhotos(orderId);
  const container = await containerCapacity(sheet.containerType ?? null);
  return {
    order,
    access,
    sheet,
    productionStart,
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
    // Programação de compra é da Wellmix: para os outros, não é pendência.
    missing: ((all) => (isWellmix(user) ? all : supplierMissing(all)))(
      missingForCompletion(sheet, await photoKindsDone(orderId, photos)),
    ),
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
  // Programação de compra (lotes, container, início): só a Wellmix grava.
  if (!isWellmix(user)) for (const key of SCHEDULE_FIELDS) delete patch[key];
  // Início da produção automático (contrato assinado): não se digita.
  if ("productionStartAt" in patch) {
    const { productionStartFor } = await import("./order-signature");
    if ((await productionStartFor(orderId)).auto)
      delete patch.productionStartAt;
  }
  if ("lots" in patch) patch.lots = normalizeLots(patch.lots as never);
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  dropUnsavedEmptyOptional(patch, existing);
  // CBM da caixa: com as três medidas, o calculado (como no cadastro).
  if (allowed.has("cbmPerCarton")) withBoxCbm(patch, existing);
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
      [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS]
        .filter((k) => !OPTIONAL_SHEET_FIELDS.includes(k))
        .map((k) => [k, null]),
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
    // Item com variação: a Wellmix adota na variação (o produto espelha a de
    // referência); sem variação, no produto como sempre.
    const [item] = adopt
      ? await store.list("order_items", { filter: { orderId }, limit: 1 })
      : [];
    await completeFromOrderSheet(
      user,
      sheet.productId ?? null,
      changed,
      order.supplierId,
      adopt ? "adopt" : "fill",
      item?.variantId ?? null,
    );
  }
  const missing = await syncRequirements(user, order, sheet);
  // Programação de compra é da Wellmix: para os outros não é pendência.
  return {
    sheet,
    missing: isWellmix(user) ? missing : supplierMissing(missing),
  };
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
        kind: "action",
      });
    return;
  }
  if (supplierPaid) {
    // Uma revisão por mudança: a mais recente desta regra já é esta (de/para)
    // → salvar outro campo não reabre o que foi tratado ou dispensado; uma
    // mudança nova (mesmo que repita uma antiga) abre de novo.
    const [latest] = await store.list("review_items", {
      filter: {
        entity: "order",
        entityId: order.id,
        rule: "order.quantity_after_payment",
      },
      orderBy: "createdAt",
      direction: "desc",
      limit: 1,
    });
    const seen =
      previousPieces === pieces &&
      !!latest &&
      latest.expected === String(item.quantity) &&
      latest.found === String(pieces);
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
    kind: "info",
    link: `/app/orders/${order.id}`,
    text: (t) => ({
      subject: t("notif.quantityAdjusted.subject", { n: order.number }),
      body:
        t("notif.quantityAdjusted.body", {
          item: item.name,
          from: item.quantity.toLocaleString(t.intl),
          to: pieces.toLocaleString(t.intl),
          unit: item.unit,
        }) +
        (sellPrice !== null && order.sellCurrency
          ? t("notif.quantityAdjusted.price", {
              total: formatAmount(sellPrice, order.sellCurrency, t.intl),
            })
          : ""),
    }),
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
      kind: "action",
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
  // "Ficha de compra" é a parte do fornecedor: conclui sem a programação
  // de compra, que é da Wellmix (ela trava a validação do comprador).
  if (
    sheetReq &&
    !supplierMissing(missing).length &&
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
    // A parte do fornecedor (é o que o item "Ficha de compra" espera).
    missing: supplierMissing(
      missingForCompletion(
        existing ?? draft,
        await photoKindsDone(order.id, photos),
      ),
    ),
  };
}

/**
 * A Wellmix já fez a programação de compra (1º lote) deste pedido? Pedido
 * sem ficha de compra (linha sem ficha, pedido antigo) não tem o que programar.
 */
export async function scheduleDone(orderId: string): Promise<boolean> {
  const [sheet] = await getStore().list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  if (!sheet) return true;
  const first = normalizeLots(sheet.lots)[0];
  return (
    typeof first.masterCartons === "number" &&
    first.masterCartons > 0 &&
    typeof first.departureIntervalDays === "number"
  );
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
