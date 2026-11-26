import "server-only";

import { assertWellmix, isAdmin } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type BookingItem,
  type BookingLot,
  type Party,
  type Product,
  type ProductLine,
  type SupplierRequest,
  type SupplierRequestRegistration,
  type User,
} from "@/lib/db";
import { normalizeNcm } from "@/lib/fiscal";
import {
  OFF,
  REGISTRATION_FIELDS,
  cleanValues,
  invalidFields,
  isColumnName,
  mergeValues,
  missingRequired,
  prefillValues,
  productPatch,
  registrationState,
  resolveColumns,
  sankhyaPayload,
  type ColumnResolution,
  type ProductDictionary,
  type RegistrationSource,
  type RegistrationState,
  type RegistrationValues,
} from "@/lib/product-registration";
import { audit } from "./audit";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): a
 * etapa depois da Cotação, numa tela própria. O produto da cotação aprovada
 * (o que veio do book) ganha o cadastro completo do Sankhya no portal, com o
 * que o processo juntou já preenchido, e vai ao Sankhya pela API.
 *
 * Quem cadastra: a Wellmix com a tela Produtos (Cadastros). Associar a um
 * produto que já existe, liberar na vitrine e o CODPROD digitado continuam
 * com as regras de antes (supplier-request-product.ts).
 */

export class ProductRegistrationError extends Error {
  constructor(
    code: string,
    /** Campos apontados na tela (data-field-error). */
    readonly fields: string[] = [],
  ) {
    super(code);
  }
}

const DICTIONARY_KEY = "sankhya.productDictionary";
const OVERRIDES_KEY = "sankhya.productFieldMap";

export function assertRegistration(user: User) {
  assertWellmix(user);
  assertScreen(user, "productRegistration");
}

async function settings() {
  return import("@/lib/integrations/sankhya-settings");
}

export async function readProductDictionary(): Promise<ProductDictionary | null> {
  const { readSetting } = await settings();
  return readSetting<ProductDictionary>(DICTIONARY_KEY);
}

export async function readFieldOverrides(): Promise<Record<string, string>> {
  const { readSetting } = await settings();
  return (await readSetting<Record<string, string>>(OVERRIDES_KEY)) ?? {};
}

/* ------------------------------------------------------------------------ */
/* Dicionário do Sankhya (TDDCAM e TDDOPC da TGFPRO)                         */
/* ------------------------------------------------------------------------ */

const text = (v: unknown) => (v == null ? "" : String(v).trim());

/**
 * Lê do Sankhya os campos da TGFPRO (nome, descrição e tipo) e as opções dos
 * campos de lista, e guarda no portal: a tela e o envio usam a cópia (o
 * dicionário muda pouco). Sem o Sankhya, recusa com o código dele.
 */
export async function loadProductDictionary(
  user: User,
): Promise<ProductDictionary> {
  assertRegistration(user);
  const { executeQuery } = await import("@/lib/integrations/sankhya-client");
  const fields = await executeQuery(
    "SELECT NUCAMPO, NOMECAMPO, DESCRCAMPO, TIPCAMPO FROM TDDCAM WHERE NOMETAB = 'TGFPRO' ORDER BY NOMECAMPO",
  );
  const options: ProductDictionary["options"] = {};
  try {
    const rows = await executeQuery(
      "SELECT C.NOMECAMPO, O.VALOR, O.OPCAO FROM TDDOPC O JOIN TDDCAM C ON C.NUCAMPO = O.NUCAMPO WHERE C.NOMETAB = 'TGFPRO' ORDER BY C.NOMECAMPO, O.VALOR",
    );
    for (const r of rows.rows) {
      const column = text(r.NOMECAMPO).toUpperCase();
      const value = text(r.VALOR);
      if (!column || !value) continue;
      (options[column] ??= []).push({
        value,
        label: text(r.OPCAO) || value,
      });
    }
  } catch (error) {
    // Sem as opções, os campos de lista vão com o texto digitado.
    console.error("[product-registration] TDDOPC", error);
  }
  const dictionary: ProductDictionary = {
    loadedAt: new Date().toISOString(),
    fields: fields.rows
      .map((r) => ({
        column: text(r.NOMECAMPO).toUpperCase(),
        label: text(r.DESCRCAMPO),
        type: text(r.TIPCAMPO) || null,
      }))
      .filter((x) => isColumnName(x.column)),
    options,
  };
  const { writeSetting } = await settings();
  await writeSetting(DICTIONARY_KEY, dictionary);
  await audit(
    user,
    "product_registration.dictionary",
    "settings",
    DICTIONARY_KEY,
    `Campos da TGFPRO lidos do Sankhya: ${dictionary.fields.length}`,
  );
  return dictionary;
}

/** De-para escolhido pelo administrador (coluna ou "-" para não enviar). */
export async function saveFieldOverrides(
  user: User,
  raw: Record<string, string>,
): Promise<number> {
  assertRegistration(user);
  if (!isAdmin(user))
    throw new ProductRegistrationError("registration_admin_only");
  const out: Record<string, string> = {};
  const bad: string[] = [];
  for (const field of REGISTRATION_FIELDS) {
    const v = (raw[field.id] ?? "").trim().toUpperCase();
    if (!v) continue;
    if (v === OFF || isColumnName(v)) out[field.id] = v;
    else bad.push(`map.${field.id}`);
  }
  if (bad.length)
    throw new ProductRegistrationError("registration_column_invalid", bad);
  const before = await readFieldOverrides();
  const { writeSetting } = await settings();
  await writeSetting(OVERRIDES_KEY, out);
  await audit(
    user,
    "product_registration.field_map",
    "settings",
    OVERRIDES_KEY,
    `De-para do cadastro de produto: ${Object.keys(out).length} campo(s)`,
    before,
    out,
  );
  return Object.keys(out).length;
}

/* ------------------------------------------------------------------------ */
/* Lista                                                                     */
/* ------------------------------------------------------------------------ */

export interface RegistrationRow {
  request: SupplierRequest;
  product: Product | null;
  supplierName: string | null;
  lotNumber: number | null;
  state: RegistrationState;
  /** Nome do produto (o do cadastro, o gravado no rascunho ou o do item). */
  name: string;
}

/** A cotação passa por aqui: veio do book ou criou o produto nesta etapa. */
const listed = (r: SupplierRequest) =>
  r.status === "approved" &&
  (!!r.bookingItemId || r.productAction === "created");

export async function listRegistrations(
  user: User,
  tab: "open" | "done",
): Promise<RegistrationRow[]> {
  assertRegistration(user);
  const store = getStore();
  let requests: SupplierRequest[];
  try {
    requests = (
      await store.list("supplier_requests", { filter: { status: "approved" } })
    ).filter(listed);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const { samplingApproved } = await import("@/lib/supplier-request-sampling");
  const productIds = [
    ...new Set(requests.map((r) => r.productId).filter(Boolean)),
  ] as string[];
  const supplierIds = [...new Set(requests.map((r) => r.supplierId))];
  const lotIds = [
    ...new Set(requests.map((r) => r.bookingLotId).filter(Boolean)),
  ];
  const [products, suppliers, lots] = await Promise.all([
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : [],
    supplierIds.length
      ? store.list("parties", { filter: { id: supplierIds } })
      : [],
    lotIds.length ? store.list("booking_lots", { filter: { id: lotIds } }) : [],
  ]);
  const productOf = new Map(products.map((p) => [p.id, p]));
  const supplierOf = new Map(suppliers.map((p) => [p.id, p]));
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  return requests
    .map((r): RegistrationRow => {
      const product = r.productId ? (productOf.get(r.productId) ?? null) : null;
      return {
        request: r,
        product,
        supplierName: supplierOf.get(r.supplierId)?.name ?? null,
        lotNumber: lotOf.get(r.bookingLotId)?.number ?? null,
        state: registrationState({
          productId: r.productId ?? null,
          sankhyaCode: product?.sankhyaCode ?? null,
          sampleApproved: samplingApproved(r),
        }),
        name:
          product?.name ??
          r.registration?.values.descrPt ??
          r.item.productName ??
          r.item.description ??
          r.item.factoryItemCode ??
          "—",
      };
    })
    .filter((row) => (tab === "done") === (row.state === "done"))
    .sort((a, b) => b.request.number - a.request.number);
}

/** Pendências "Cadastrar o produto": amostra aprovada e sem produto. */
export async function registrationTaskRows(): Promise<SupplierRequest[]> {
  const store = getStore();
  let rows: SupplierRequest[];
  try {
    rows = await store.list("supplier_requests", {
      filter: { status: "approved" },
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const { samplingApproved } = await import("@/lib/supplier-request-sampling");
  return rows.filter(
    (r) => !!r.bookingItemId && !r.productId && samplingApproved(r),
  );
}

/* ------------------------------------------------------------------------ */
/* A tela de um produto                                                      */
/* ------------------------------------------------------------------------ */

export interface RegistrationContext {
  request: SupplierRequest;
  item: BookingItem | null;
  lot: BookingLot | null;
  supplier: Party | null;
  product: Product | null;
  lines: ProductLine[];
  values: RegistrationValues;
  columns: Record<string, ColumnResolution>;
  dictionary: ProductDictionary | null;
  overrides: Record<string, string>;
  state: RegistrationState;
  /** Foto do produto na balança (amostra ou ficha da cotação), se houver. */
  photoDocumentIds: string[];
}

/** O mais frequente de uma lista (empate: o primeiro). */
function mostCommon(values: Array<string | null | undefined>): string | null {
  const count = new Map<string, number>();
  for (const v of values) if (v) count.set(v, (count.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [v, c] of count)
    if (c > n) {
      best = v;
      n = c;
    }
  return best;
}

async function prefillSource(
  request: SupplierRequest,
  item: BookingItem | null,
  lot: BookingLot | null,
  supplier: Party | null,
  lines: ProductLine[],
): Promise<RegistrationSource> {
  const store = getStore();
  const { agreedConditions } = await import("./supplier-request-product");
  const it = request.item;
  const deal = agreedConditions(request);
  // País e porto: os dos outros produtos do mesmo fornecedor no Sankhya.
  const siblings = supplier
    ? await store
        .list("products", { filter: { supplierId: supplier.id }, limit: 200 })
        .catch(() => [] as Product[])
    : [];
  const refs = siblings.map((p) => p.sankhyaRefs ?? {});
  const ownerId = lot?.ownerUserId ?? request.createdByUserId;
  const owner = ownerId
    ? await store.get("users", ownerId).catch(() => null)
    : null;
  // Linha: a da família do book, quando só uma linha tem essa família.
  const familyLines = lot?.familyCode
    ? lines.filter((l) => l.familyCode === lot.familyCode)
    : [];
  const line = familyLines.length === 1 ? familyLines[0] : null;
  const variant = request.variant ?? null;
  return {
    name: it.productName ?? it.description ?? null,
    description: it.description ?? it.productName ?? null,
    factoryCode: it.factoryItemCode,
    material: it.material,
    colors: it.colorAssortment,
    variation: variant?.variation ?? null,
    capacityMl: it.capacityMl,
    powerDetail: it.powerDetail,
    packageType: it.packageType,
    piecesPerPackage: variant && variant.units > 1 ? variant.units : null,
    lengthCm: it.lengthCm,
    widthCm: it.widthCm,
    heightCm: it.heightCm,
    netWeightKg: it.netWeightPcKg,
    grossWeightKg: it.grossWeightPcKg,
    masterQty: it.masterCartonQty,
    masterCbm: it.cbmPerCarton,
    innerQty: it.innerQty,
    ncm: normalizeNcm(item?.ncm) ?? null,
    leadTimeDays: deal.leadTimeDays,
    supplierName: supplier?.name ?? null,
    supplierCode: supplier?.sankhyaCode ?? null,
    supplierContact:
      [supplier?.address, supplier?.city, supplier?.phone]
        .filter(Boolean)
        .join(" / ") || null,
    countryCode: mostCommon(
      refs.map((r) => (r.CODPAIS == null ? null : String(r.CODPAIS))),
    ),
    countryName: supplier?.country ?? null,
    portCode: mostCommon(
      refs.map((r) => (r.AD_IDPORTO == null ? null : String(r.AD_IDPORTO))),
    ),
    productManager: owner?.name ?? null,
    notes:
      [
        request.needs ? `Wellmix: ${request.needs}` : null,
        item?.purchaseSchedule
          ? `Purchase schedule: ${item.purchaseSchedule}`
          : null,
      ]
        .filter(Boolean)
        .join("\n") || null,
    lineId: line?.id ?? null,
    certifications: line?.requiredCertifications ?? [],
  };
}

export async function registrationContext(
  user: User,
  requestId: string,
): Promise<RegistrationContext | null> {
  assertRegistration(user);
  const store = getStore();
  const request = await store.get("supplier_requests", requestId);
  if (!request || request.status !== "approved") return null;
  const [item, lot, supplier, product, lines, dictionary, overrides] =
    await Promise.all([
      request.bookingItemId
        ? store.get("booking_items", request.bookingItemId)
        : null,
      request.bookingLotId
        ? store.get("booking_lots", request.bookingLotId)
        : null,
      store.get("parties", request.supplierId),
      request.productId ? store.get("products", request.productId) : null,
      store.list("product_lines", {
        filter: { active: true },
        orderBy: "name",
      }),
      readProductDictionary(),
      readFieldOverrides(),
    ]);
  // Dicionário ainda não lido: lê uma vez do Sankhya (com a credencial) e
  // guarda; sem ele, só os campos padrão têm coluna.
  let dict = dictionary;
  if (!dict) {
    const { getSankhyaConfigStatus } = await settings();
    if ((await getSankhyaConfigStatus()).config)
      dict = await loadProductDictionary(user).catch((error) => {
        console.error("[product-registration] dicionário", error);
        return null;
      });
  }
  const { samplingApproved } = await import("@/lib/supplier-request-sampling");
  const prefill = prefillValues(
    await prefillSource(request, item, lot, supplier, lines),
  );
  const photos = [
    request.item.photoDocumentId,
    ...(item?.extraPhotoDocumentIds ?? []),
  ].filter((x): x is string => !!x);
  return {
    request,
    item,
    lot,
    supplier,
    product,
    lines,
    values: mergeValues(prefill, request.registration?.values),
    columns: resolveColumns(dict, overrides),
    dictionary: dict,
    overrides,
    state: registrationState({
      productId: request.productId ?? null,
      sankhyaCode: product?.sankhyaCode ?? null,
      sampleApproved: samplingApproved(request),
    }),
    photoDocumentIds: [...new Set(photos)].slice(0, 12),
  };
}

/* ------------------------------------------------------------------------ */
/* Gravar, cadastrar e enviar                                                */
/* ------------------------------------------------------------------------ */

async function approvedRequest(id: string): Promise<SupplierRequest> {
  const request = await getStore().get("supplier_requests", id);
  if (!request) throw new ProductRegistrationError("not_found");
  if (request.status !== "approved")
    throw new ProductRegistrationError("request_product_not_approved");
  return request;
}

/** Valores do formulário conferidos (número e data legíveis). */
function checked(raw: Record<string, string>): RegistrationValues {
  const values = cleanValues(raw);
  const bad = invalidFields(values);
  if (bad.length)
    throw new ProductRegistrationError(
      "registration_invalid",
      bad.map((id) => `f.${id}`),
    );
  return values;
}

async function saveValues(
  user: User,
  request: SupplierRequest,
  values: RegistrationValues,
  send?: Pick<
    SupplierRequestRegistration,
    "sendStatus" | "sendDetail" | "skipped"
  >,
): Promise<SupplierRequestRegistration> {
  const now = new Date().toISOString();
  const before = request.registration ?? null;
  const registration: SupplierRequestRegistration = {
    ...(before ?? {}),
    values,
    savedAt: now,
    savedByUserId: user.id,
    ...(send ? { ...send, sentAt: now, sentByUserId: user.id } : {}),
  };
  await getStore().update("supplier_requests", request.id, { registration });
  return registration;
}

/** Grava o rascunho (dá para ir preenchendo antes da amostra aprovada). */
export async function saveRegistrationDraft(
  user: User,
  requestId: string,
  raw: Record<string, string>,
): Promise<void> {
  assertRegistration(user);
  const request = await approvedRequest(requestId);
  await saveValues(user, request, cleanValues(raw));
}

export type SendOutcome = "done" | "error" | "off";

export interface RegisterResult {
  product: Product;
  send: SendOutcome;
}

/** As colunas do produto do portal com o que o formulário tem. */
async function applyToProduct(
  user: User,
  product: Product,
  values: RegistrationValues,
): Promise<Product> {
  const store = getStore();
  const patch = productPatch(values);
  const { ncm, ...rest } = patch;
  const update: Partial<Product> = { ...rest };
  if (ncm) update.ncm = normalizeNcm(ncm) ?? product.ncm;
  const saved = Object.keys(update).length
    ? await store.update("products", product.id, update)
    : product;
  // Ficha mestre: caixa, pesos e CBM da caixa como no formulário.
  const sheet: Record<string, unknown> = {};
  if (patch.masterBoxQty !== undefined)
    sheet.masterCartonQty = patch.masterBoxQty;
  if (patch.innerBoxQty !== undefined) sheet.innerQty = patch.innerBoxQty;
  if (patch.netWeightKg !== undefined) sheet.netWeightPcKg = patch.netWeightKg;
  if (patch.grossWeightKg !== undefined)
    sheet.grossWeightPcKg = patch.grossWeightKg;
  if (patch.cbm !== undefined) sheet.cbmPerCarton = patch.cbm;
  if (patch.boxHeightCm !== undefined) sheet.heightCm = patch.boxHeightCm;
  if (patch.boxWidthCm !== undefined) sheet.widthCm = patch.boxWidthCm;
  if (patch.boxLengthCm !== undefined) sheet.lengthCm = patch.boxLengthCm;
  if (patch.material !== undefined) sheet.material = patch.material;
  if (update.ncm) sheet.ncm = update.ncm;
  if (Object.keys(sheet).length) {
    const { saveProductSheet } = await import("./product-sheet");
    await saveProductSheet(user, product.id, sheet);
  }
  return saved;
}

/**
 * Cadastra o produto no portal com o formulário (nome, linha e o resto da
 * ficha), liga os itens do book e tenta enviar ao Sankhya. O envio que não
 * acontece (execução desligada, sem credencial, erro do ERP) não desfaz o
 * produto: fica o "Enviar ao Sankhya" para depois.
 */
export async function registerProduct(
  user: User,
  requestId: string,
  raw: Record<string, string>,
  itemIds: string[],
): Promise<RegisterResult> {
  assertRegistration(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (request.productId)
    throw new ProductRegistrationError("request_product_exists");
  const values = checked(raw);
  const missing = missingRequired(values, "portal");
  if (missing.length)
    throw new ProductRegistrationError(
      "registration_required",
      missing.map((id) => `f.${id}`),
    );
  const { createProductFromRequest } =
    await import("./supplier-request-product");
  const created = await createProductFromRequest(
    user,
    request.id,
    {
      name: values.descrPt,
      lineId: values.lineId,
      itemIds,
    },
    { access: "registration" },
  );
  const product = await applyToProduct(user, created, values);
  const fresh = (await store.get("supplier_requests", request.id)) ?? request;
  const send = await sendNow(user, fresh, product, values);
  return { product, send };
}

/**
 * Grava o formulário no produto já cadastrado e envia ao Sankhya: inclui
 * (sem CODPROD) ou altera (com CODPROD).
 */
export async function sendRegistration(
  user: User,
  requestId: string,
  raw: Record<string, string>,
): Promise<SendOutcome> {
  assertRegistration(user);
  const store = getStore();
  const request = await approvedRequest(requestId);
  if (!request.productId)
    throw new ProductRegistrationError("request_product_missing");
  const current = await store.get("products", request.productId);
  if (!current) throw new ProductRegistrationError("request_product_not_found");
  const values = checked(raw);
  const product = await applyToProduct(user, current, values);
  return sendNow(user, request, product, values);
}

async function findByRef(ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  const { loadRecords } = await import("@/lib/integrations/sankhya-client");
  const found = await loadRecords({
    entity: "Produto",
    fields: "CODPROD",
    where: "REFFORN = ?",
    params: [{ type: "S", value: ref }],
  });
  const code = found.rows[0]?.CODPROD;
  return code == null ? null : String(code);
}

const errorText = (error: unknown) => {
  const e = error as { code?: string; detail?: string; message?: string };
  return `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`.slice(
    0,
    1500,
  );
};

/** Envia e grava o resultado na cotação (e em process_events). */
async function sendNow(
  user: User,
  request: SupplierRequest,
  product: Product,
  values: RegistrationValues,
): Promise<SendOutcome> {
  const store = getStore();
  const { getSankhyaErpSettings, getSankhyaConfigStatus, syncedStamp } =
    await Promise.all([
      settings(),
      import("@/lib/integrations/sankhya-sync"),
    ]).then(([a, b]) => ({ ...a, syncedStamp: b.syncedStamp }));
  const [erp, credentials] = await Promise.all([
    getSankhyaErpSettings(),
    getSankhyaConfigStatus(),
  ]);
  // Credencial: a gravada em Configurações → Integração Sankhya (ou as
  // variáveis de ambiente), a mesma do cliente do Sankhya. Sem ela ou com a
  // execução no Sankhya desligada (Configurações → Sankhya → Processos): o
  // cadastro fica gravado no portal, sem envio.
  const configured = !!credentials.config;
  if (!configured || !erp.ordersEnabled) {
    await saveValues(user, request, values, {
      sendStatus: "off",
      sendDetail: !configured ? "not_configured" : "execution_off",
      skipped: null,
    });
    return "off";
  }
  const missing = missingRequired(values, "sankhya");
  const line = await store.get("product_lines", product.lineId);
  if (!line?.sankhyaCode) missing.push("lineId");
  if (missing.length) {
    await saveValues(user, request, values, {
      sendStatus: "error",
      sendDetail: `missing: ${[...new Set(missing)].join(", ")}`,
      skipped: null,
    });
    throw new ProductRegistrationError(
      "registration_sankhya_required",
      [...new Set(missing)].map((id) => `f.${id}`),
    );
  }
  let dictionary = await readProductDictionary();
  if (!dictionary)
    dictionary = await loadProductDictionary(user).catch(() => null);
  const columns = resolveColumns(dictionary, await readFieldOverrides());
  const payload = sankhyaPayload(values, columns, line!.sankhyaCode!);
  const skipped = payload.skipped.map((s) => `${s.id}:${s.reason}`);
  let status: SendOutcome;
  let detail: string;
  let code = product.sankhyaCode ?? null;
  const kind = code ? "update" : "create";
  try {
    const { datasetSave } = await import("@/lib/integrations/sankhya-client");
    if (!code) code = await findByRef(payload.values.REFFORN);
    if (!code) {
      await datasetSave({
        entity: "Produto",
        values: {
          ...(erp.productDefaults ?? {}),
          ...payload.values,
          ATIVO: "S",
        },
      });
      code = await findByRef(payload.values.REFFORN);
      if (!code)
        throw new Error(
          "incluído, mas não achei o CODPROD pela referência do fornecedor",
        );
      detail = `Sankhya: produto ${code} incluído`;
    } else {
      await datasetSave({
        entity: "Produto",
        pk: { CODPROD: code },
        values: payload.values,
      });
      detail =
        kind === "create"
          ? `Sankhya: vinculado ao produto ${code} (mesma referência) e alterado`
          : `Sankhya: produto ${code} alterado`;
    }
    await store.update("products", product.id, {
      sankhyaCode: code,
      sankhyaSyncedAt: syncedStamp(),
    });
    await store.update("supplier_requests", request.id, {
      erpCheckedAt: new Date().toISOString(),
    });
    status = "done";
  } catch (error) {
    status = "error";
    detail = `Sankhya: ${product.name}: ${errorText(error)}`;
  }
  await saveValues(user, request, values, {
    sendStatus: status,
    sendDetail: detail,
    skipped,
  });
  try {
    await store.create("process_events", {
      event: `sync:product:${kind}`,
      requestId: null,
      orderId: null,
      stockAction: "none",
      sankhyaAction: kind,
      top: null,
      status: status === "done" ? "done" : "error",
      detail,
      nunotaBefore: null,
      nunotaAfter: null,
      createdByUserId: user.id,
      entity: "product",
      entityId: product.id,
    });
  } catch (error) {
    console.error("[product-registration] log", error);
  }
  await audit(
    user,
    "product.registration_send",
    "product",
    product.id,
    `${detail} (cotação nº ${request.number}; ${Object.keys(payload.values).length} campos; fora: ${skipped.length})`,
  );
  return status;
}

/* ------------------------------------------------------------------------ */
/* Pendências                                                                */
/* ------------------------------------------------------------------------ */

export interface RegistrationTaskDraft {
  kind: "product_registration";
  title: string;
  detail: string;
  text: {
    title: "productRegistration.task.title";
    detail: "productRegistration.task.detail";
    values: Record<string, string>;
  };
  link: string;
  dueAt: null;
  sinceAt: string | null;
  loadedAt: string | null;
  ownerUserId: string | null;
}

/**
 * "Cadastrar o produto": a cotação aprovada do book com a amostra aprovada
 * e sem produto. Para a Wellmix que abre Produtos (o passo Cadastrar produto
 * do menu conta estas).
 */
export async function registrationTaskDrafts(
  user: User,
): Promise<RegistrationTaskDraft[]> {
  const { isWellmix } = await import("@/lib/auth/permissions");
  const { canOpen } = await import("@/lib/auth/screens");
  if (!isWellmix(user) || !canOpen(user, "productRegistration")) return [];
  const rows = await registrationTaskRows();
  return rows
    .sort((a, b) => a.number - b.number)
    .map((r) => {
      const product =
        r.registration?.values.descrPt ??
        r.item.productName ??
        r.item.description ??
        r.item.factoryItemCode ??
        "—";
      const values = { n: String(r.number), product };
      return {
        kind: "product_registration" as const,
        title: `Cadastrar o produto: cotação nº ${r.number}`,
        detail: product,
        text: {
          title: "productRegistration.task.title" as const,
          detail: "productRegistration.task.detail" as const,
          values,
        },
        link: `/app/product-registration/${r.id}`,
        dueAt: null,
        sinceAt: r.sampling?.reviewedAt ?? r.decidedAt ?? r.createdAt,
        loadedAt: r.createdAt,
        ownerUserId: null,
      };
    });
}
