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
  applySimilar,
  cleanValues,
  groupPath,
  leafGroups,
  similarCandidates,
  valuesFromSankhyaRow,
  nameKey,
  type GroupNode,
  type GroupPath,
  invalidFields,
  isColumnName,
  mergeValues,
  missingRequired,
  prefillValues,
  productPatch,
  registrationCompleteness,
  registrationState,
  resolveColumns,
  sankhyaPayload,
  type ColumnResolution,
  type ProductDictionary,
  type RegistrationSource,
  type RegistrationState,
  type RegistrationCompleteness,
  type RegistrationValues,
} from "@/lib/product-registration";
import { audit } from "./audit";
import {
  readLookupSources,
  registrationLookups,
  type ListKind,
  type RegistrationLookups,
} from "./sankhya-lookups";

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

/* ------------------------------------------------------------------------ */
/* Lista com os dados do item, a completude e o prazo (dono, 27/11/2026)     */
/* ------------------------------------------------------------------------ */

export interface RegistrationOverviewRow extends RegistrationRow {
  /** Foto do item (a do book). */
  photoId: string | null;
  factoryCode: string | null;
  variation: string | null;
  /** Peças por embalagem da cotação de um SKU (1 = a unitária). */
  units: number;
  quantity: number;
  /** Condições combinadas na cotação (o preço só com "Ver preço de compra"). */
  price: number | null;
  currency: string | null;
  incoterm: string | null;
  ncm: string | null;
  completeness: RegistrationCompleteness;
  /** Quem cuida: quem gravou o rascunho por último ou, antes, o GP do book. */
  responsible: { name: string; kind: "saved" | "owner" } | null;
  /** Desde quando o cadastro corre (amostra aprovada ou cotação aprovada). */
  sinceAt: string | null;
  /** Prazo: desde + o prazo do cadastro (Configurações, "Cadastro e fiscal"). */
  dueAt: string | null;
  late: boolean;
}

export interface RegistrationOverview {
  rows: RegistrationOverviewRow[];
  /** Os números do passo (sempre das em aberto) e quantas já estão feitas. */
  kpis: {
    open: number;
    toRegister: number;
    waitingSample: number;
    toSend: number;
    late: number;
    done: number;
    /** Média da completude das em aberto. */
    averagePercent: number;
    /** Em aberto com algum obrigatório faltando. */
    missingRequired: number;
  };
  /** Os campos que mais faltam nas em aberto (os 6 primeiros). */
  topMissing: Array<{ id: string; n: number }>;
  slaDays: number;
}

/**
 * A lista Cadastrar produto com o que já temos de cada item (dono,
 * 27/11/2026): a foto, o código da fábrica, a variação, a quantidade, as
 * condições combinadas e o NCM; a completude do cadastro pelos mesmos
 * valores da tela (o que o processo preencheu e o rascunho); quem cuida e o
 * prazo, contado da amostra aprovada (ou da aprovação, sem amostragem) com o
 * prazo "Cadastro e fiscal" das Configurações (`purchaseRegistrationSlaDays`).
 */
export async function registrationOverview(
  user: User,
  tab: "open" | "done",
  now = new Date(),
): Promise<RegistrationOverview> {
  const [open, done] = await Promise.all([
    listRegistrations(user, "open"),
    listRegistrations(user, "done"),
  ]);
  const store = getStore();
  const { getSettings } = await import("@/lib/settings");
  const { agreedConditions } = await import("./supplier-request-product");
  const { samplingRequired } = await import("@/lib/supplier-request-sampling");
  const slaDays = (await getSettings()).purchaseRegistrationSlaDays;
  const all = [...open, ...done];
  const itemIds = [
    ...new Set(all.map((r) => r.request.bookingItemId).filter(Boolean)),
  ];
  const lotIds = [
    ...new Set(all.map((r) => r.request.bookingLotId).filter(Boolean)),
  ];
  const [items, lots, lines] = await Promise.all([
    itemIds.length
      ? store.list("booking_items", { filter: { id: itemIds } })
      : ([] as BookingItem[]),
    lotIds.length
      ? store.list("booking_lots", { filter: { id: lotIds } })
      : ([] as BookingLot[]),
    store.list("product_lines", { filter: { active: true } }),
  ]);
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const partyIds = [
    ...new Set([
      ...all.map((r) => r.request.supplierId),
      ...lots.map((l) => l.supplierId).filter((x): x is string => !!x),
    ]),
  ];
  const userIds = [
    ...new Set(
      all
        .flatMap((r) => [
          r.request.registration?.savedByUserId,
          lotOf.get(r.request.bookingLotId)?.ownerUserId,
          r.request.createdByUserId,
        ])
        .filter((x): x is string => !!x),
    ),
  ];
  const [parties, users] = await Promise.all([
    partyIds.length
      ? store.list("parties", { filter: { id: partyIds } })
      : ([] as Party[]),
    userIds.length
      ? store.list("users", { filter: { id: userIds } })
      : ([] as User[]),
  ]);
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const userOf = new Map(users.map((u) => [u.id, u]));

  const enrich = async (
    row: RegistrationRow,
  ): Promise<RegistrationOverviewRow> => {
    const r = row.request;
    const item = r.bookingItemId ? (itemOf.get(r.bookingItemId) ?? null) : null;
    const lot = r.bookingLotId ? (lotOf.get(r.bookingLotId) ?? null) : null;
    const supplier = partyOf.get(r.supplierId) ?? null;
    const factory = lot?.supplierId
      ? (partyOf.get(lot.supplierId) ?? null)
      : null;
    const prefill = prefillValues(
      await prefillSource(r, item, lot, supplier, factory, lines),
    );
    const values = mergeValues(prefill, r.registration?.values ?? null);
    const deal = agreedConditions(r);
    const savedBy = r.registration?.savedByUserId
      ? userOf.get(r.registration.savedByUserId)
      : null;
    const owner = userOf.get(lot?.ownerUserId ?? r.createdByUserId) ?? null;
    // O prazo corre do momento em que dá para cadastrar: a amostra aprovada
    // (com "Necessita amostragem") ou a aprovação da cotação.
    const running = row.state === "to_register" || row.state === "to_send";
    const sinceAt = !running
      ? null
      : samplingRequired(r) && r.sampling?.reviewedAt
        ? r.sampling.reviewedAt
        : (r.decidedAt ?? r.createdAt);
    const dueAt = sinceAt
      ? new Date(Date.parse(sinceAt) + slaDays * 86_400_000).toISOString()
      : null;
    return {
      ...row,
      photoId: r.item.photoDocumentId ?? null,
      factoryCode: r.item.factoryItemCode ?? null,
      variation: r.variant?.variation ?? null,
      units: Math.max(1, r.variant?.units ?? 1),
      quantity: r.quantity,
      price: deal.price ?? null,
      currency: deal.currency ?? null,
      incoterm: deal.incoterm ?? null,
      ncm: values.ncm?.trim() || null,
      completeness: registrationCompleteness(values),
      responsible: savedBy
        ? { name: savedBy.name, kind: "saved" }
        : owner
          ? { name: owner.name, kind: "owner" }
          : null,
      sinceAt,
      dueAt,
      late: !!dueAt && Date.parse(dueAt) < now.getTime(),
    };
  };
  const openRows = await Promise.all(open.map(enrich));
  const rows = tab === "done" ? await Promise.all(done.map(enrich)) : openRows;
  const missingCount = new Map<string, number>();
  for (const row of openRows)
    for (const id of row.completeness.missing)
      missingCount.set(id, (missingCount.get(id) ?? 0) + 1);
  return {
    rows,
    kpis: {
      open: openRows.length,
      toRegister: openRows.filter((x) => x.state === "to_register").length,
      waitingSample: openRows.filter((x) => x.state === "waiting_sample")
        .length,
      toSend: openRows.filter((x) => x.state === "to_send").length,
      late: openRows.filter((x) => x.late).length,
      done: done.length,
      averagePercent: openRows.length
        ? Math.floor(
            openRows.reduce((s, x) => s + x.completeness.percent, 0) /
              openRows.length,
          )
        : 0,
      missingRequired: openRows.filter(
        (x) => x.completeness.missingRequired.length > 0,
      ).length,
    },
    topMissing: [...missingCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, n]) => ({ id, n })),
    slaDays,
  };
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

/** Um Grupo do Sankhya na lista, com os níveis acima dele. */
export interface GroupChoice {
  /** O valor gravado: o CODGRUPOPROD (ou o id da linha do portal, sem o Sankhya). */
  value: string;
  path: GroupPath;
}

export interface RegistrationContext {
  request: SupplierRequest;
  item: BookingItem | null;
  lot: BookingLot | null;
  supplier: Party | null;
  /** A Factory do book (pode ser o próprio Supplier). */
  factory: Party | null;
  product: Product | null;
  lines: ProductLine[];
  values: RegistrationValues;
  /** O que o processo preencheu (sem o rascunho): base do "semelhante". */
  prefill: RegistrationValues;
  columns: Record<string, ColumnResolution>;
  dictionary: ProductDictionary | null;
  overrides: Record<string, string>;
  state: RegistrationState;
  /** Foto do produto na balança (amostra ou ficha da cotação), se houver. */
  photoDocumentIds: string[];
  /** Listas do Sankhya (linha, embalagem, unidades, marcas, país). */
  lookups: RegistrationLookups;
  lookupSources: Partial<Record<ListKind, string>>;
  /**
   * Grupos para escolher: os do último nível da árvore do Sankhya; sem ela,
   * as linhas do portal (`fromSankhya` falso).
   */
  groups: GroupChoice[];
  groupsFromSankhya: boolean;
  /** Família escolhida antes (a do book), para o aviso de divergência. */
  family: GroupNode | null;
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
  factory: Party | null,
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
  // Certificações: as da linha da família do book, quando só uma tem essa família.
  const familyLines = lot?.familyCode
    ? lines.filter((l) => l.familyCode === lot.familyCode)
    : [];
  const line = familyLines.length === 1 ? familyLines[0] : null;
  const variant = request.variant ?? null;
  // Factory (dono, 27/11/2026): o nº da loja digitado na importação do book
  // (o código da fábrica), senão o do cadastro dela ou o da planilha.
  const store_ =
    lot?.storeNumber?.trim() ||
    factory?.storeNumber?.trim() ||
    item?.sheetStore?.trim() ||
    null;
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
    supplierName: supplier?.name ?? lot?.supplierName ?? null,
    supplierCode: supplier?.sankhyaCode ?? null,
    factoryName: factory?.name ?? null,
    factoryStore: store_,
    factoryContact:
      [store_, factory?.address, factory?.phone].filter(Boolean).join(" / ") ||
      null,
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
    certifications: line?.requiredCertifications ?? [],
  };
}

/**
 * Os Grupos para escolher (dono, 27/11/2026): os do último nível da árvore do
 * Sankhya, cada um com Sub grupo, Coleção e Categoria. Sem a árvore (Sankhya
 * fora do ar ou não configurado, e nos testes), as linhas do portal.
 */
async function groupChoices(
  lines: ProductLine[],
): Promise<{ groups: GroupChoice[]; fromSankhya: boolean }> {
  const { sankhyaProductGroups } = await import("./sankhya-product-families");
  const tree = await sankhyaProductGroups().catch(
    () => new Map<string, { name: string; parent: string | null }>(),
  );
  if (tree.size) {
    const groups = leafGroups(tree)
      .map((code) => groupPath(code, tree))
      .filter((p): p is GroupPath => !!p)
      .map((path) => ({ value: path.group.code, path }))
      .sort((a, b) => a.path.group.name.localeCompare(b.path.group.name));
    return { groups, fromSankhya: true };
  }
  return {
    groups: lines.map((l) => ({
      value: l.id,
      path: {
        group: { code: l.sankhyaCode ?? "", name: l.name },
        subgroup: null,
        collection: null,
        category: l.familyCode
          ? { code: l.familyCode, name: l.familyCode }
          : null,
      },
    })),
    fromSankhya: false,
  };
}

/**
 * A linha do portal do Grupo escolhido: o id de uma linha (escolhida sem a
 * lista do Sankhya) ou o CODGRUPOPROD, que acha a linha pelo código; grupo
 * do Sankhya sem linha no portal ganha a linha, como na carga do Sankhya.
 */
export async function lineForGroup(
  value: string | undefined,
): Promise<{ line: ProductLine; groupCode: string | null }> {
  const store = getStore();
  const v = (value ?? "").trim();
  if (!v)
    throw new ProductRegistrationError("registration_required", ["f.group"]);
  const byId = /^\d+$/.test(v) ? null : await store.get("product_lines", v);
  if (byId) return { line: byId, groupCode: byId.sankhyaCode ?? null };
  if (!/^\d{1,12}$/.test(v))
    throw new ProductRegistrationError("registration_invalid", ["f.group"]);
  const [existing] = await store.list("product_lines", {
    filter: { sankhyaCode: v },
    limit: 1,
  });
  if (existing) return { line: existing, groupCode: v };
  const { sankhyaProductGroups } = await import("./sankhya-product-families");
  const tree = await sankhyaProductGroups();
  const path = groupPath(v, tree);
  if (!path)
    throw new ProductRegistrationError("registration_group_unknown", [
      "f.group",
    ]);
  const { LINE_EXTRA_DEFAULTS } = await import("@/lib/db");
  const { DEFAULT_PREPARATION_REQUIREMENTS } =
    await import("@/lib/workflow/templates");
  const line = await store.create("product_lines", {
    ...LINE_EXTRA_DEFAULTS,
    name: path.group.name,
    manualDocumentId: null,
    requirements: DEFAULT_PREPARATION_REQUIREMENTS,
    requiredCertifications: null,
    active: true,
    sankhyaCode: v,
    familyCode: path.category?.code ?? null,
  });
  return { line, groupCode: v };
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
  // Factory do book: o cadastro estimado pela planilha (pode ser o Supplier).
  const factory =
    lot?.supplierId && lot.supplierId !== supplier?.id
      ? await store.get("parties", lot.supplierId).catch(() => null)
      : lot?.supplierId
        ? supplier
        : null;
  const prefill = prefillValues(
    await prefillSource(request, item, lot, supplier, factory, lines),
  );
  const photos = [
    request.item.photoDocumentId,
    ...(item?.extraPhotoDocumentIds ?? []),
  ].filter((x): x is string => !!x);
  const [lookups, lookupSources, groupData, families] = await Promise.all([
    registrationLookups(),
    readLookupSources(),
    groupChoices(lines),
    lot?.familyCode
      ? import("./product-families")
          .then((m) => m.listProductFamilies({ includeInactive: true }))
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const familyRow = lot?.familyCode
    ? families.find((f) => f.code === lot.familyCode)
    : null;
  // Rascunho de antes da lista de grupos (27/11/2026): a linha do portal
  // escolhida vale como o Grupo.
  const saved = request.registration?.values ?? null;
  const draft =
    saved && saved.lineId && !saved.group
      ? { ...saved, group: saved.lineId }
      : saved;
  return {
    request,
    item,
    lot,
    supplier,
    factory,
    product,
    lines,
    values: mergeValues(prefill, draft),
    prefill,
    lookups,
    lookupSources,
    groups: groupData.groups,
    groupsFromSankhya: groupData.fromSankhya,
    family: lot?.familyCode
      ? { code: lot.familyCode, name: familyRow?.name ?? lot.familyCode }
      : null,
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
  // O Grupo escolhido leva à linha do portal (o produto do portal precisa dela).
  const { line } = await lineForGroup(values.group);
  const { createProductFromRequest } =
    await import("./supplier-request-product");
  const created = await createProductFromRequest(
    user,
    request.id,
    {
      name: values.descrPt,
      lineId: line.id,
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
  // Grupo trocado depois de cadastrar: o produto do portal muda de linha.
  let base = current;
  if (values.group) {
    const { line } = await lineForGroup(values.group);
    if (line.id !== current.lineId)
      base = await store.update("products", current.id, { lineId: line.id });
  }
  const product = await applyToProduct(user, base, values);
  return sendNow(user, request, product, values);
}

/* ------------------------------------------------------------------------ */
/* É semelhante a algum do catálogo?                                         */
/* ------------------------------------------------------------------------ */

const shownNumber = (n: number | null | undefined, factor = 1) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? undefined
    : String(Math.round(n * factor * 1e6) / 1e6).replace(".", ",");

/** O que o cadastro do portal tem do produto, nos campos do formulário. */
function portalProductValues(p: Product): RegistrationValues {
  const meters = (cm: number | null) => shownNumber(cm, 0.01);
  return cleanValues({
    descrPt: p.name,
    [nameKey("brand")]: p.brand ?? undefined,
    composition: p.material ?? undefined,
    colors: p.color ?? undefined,
    pantone: p.pantone ?? undefined,
    ncm: p.ncm ?? undefined,
    height: meters(p.heightCm),
    width: meters(p.widthCm),
    depth: meters(p.lengthCm),
    netWeight: shownNumber(p.netWeightKg),
    grossWeight: shownNumber(p.grossWeightKg),
    masterQty: shownNumber(p.masterBoxQty),
    innerQty: shownNumber(p.innerBoxQty),
    masterHeight: meters(p.boxHeightCm),
    masterWidth: meters(p.boxWidthCm),
    masterDepth: meters(p.boxLengthCm),
    masterCbm: shownNumber(p.cbm),
  } as Record<string, unknown>);
}

export interface SimilarProduct {
  product: Product;
  values: RegistrationValues;
  /** O cadastro veio do Sankhya (pelo CODPROD); senão, só o do portal. */
  fromSankhya: boolean;
}

/**
 * O cadastro de um produto do catálogo nos campos do formulário: o do
 * Sankhya (a linha da TGFPRO pelo CODPROD, pelo mesmo de-para do envio),
 * completado pelo do portal. Sem o Sankhya, só o do portal.
 */
export async function similarProduct(
  user: User,
  productId: string,
): Promise<SimilarProduct | null> {
  assertRegistration(user);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return null;
  const portal = portalProductValues(product);
  if (!product.sankhyaCode || !/^\d{1,12}$/.test(product.sankhyaCode))
    return { product, values: portal, fromSankhya: false };
  try {
    const { getSankhyaConfigStatus } = await settings();
    if (!(await getSankhyaConfigStatus()).config)
      return { product, values: portal, fromSankhya: false };
    const [dictionary, overrides, lookups] = await Promise.all([
      readProductDictionary(),
      readFieldOverrides(),
      registrationLookups(),
    ]);
    const columns = resolveColumns(dictionary, overrides);
    const wanted = [
      ...new Set(
        REGISTRATION_FIELDS.flatMap((f) => [
          columns[f.id]?.column ?? null,
          f.nameColumn ?? null,
        ]).filter((c): c is string => !!c),
      ),
    ];
    const { executeQuery } = await import("@/lib/integrations/sankhya-client");
    const result = await executeQuery(
      `SELECT ${wanted.join(", ")} FROM TGFPRO WHERE CODPROD = ${Number(product.sankhyaCode)}`,
    );
    const row = result.rows[0];
    if (!row) return { product, values: portal, fromSankhya: false };
    const fromErp = valuesFromSankhyaRow(row, columns, (field, code) =>
      field.lookup && field.lookup !== "group"
        ? (lookups.lists[field.lookup]?.options.find((o) => o.code === code)
            ?.name ?? null)
        : null,
    );
    return { product, values: { ...portal, ...fromErp }, fromSankhya: true };
  } catch (error) {
    console.error("[product-registration] semelhante no Sankhya", error);
    return { product, values: portal, fromSankhya: false };
  }
}

/** Os campos que o semelhante pode trazer para esta cotação. */
export async function similarChoices(
  user: User,
  ctx: Pick<RegistrationContext, "prefill">,
  productId: string,
): Promise<{ similar: SimilarProduct; fields: string[] } | null> {
  const similar = await similarProduct(user, productId);
  if (!similar) return null;
  return { similar, fields: similarCandidates(ctx.prefill, similar.values) };
}

/**
 * Traz para o rascunho os campos escolhidos do produto semelhante (dono,
 * 27/11/2026): só os que o processo não preencheu; o que foi digitado nos
 * outros fica.
 */
export async function applySimilarProduct(
  user: User,
  requestId: string,
  raw: Record<string, string>,
  productId: string,
  fields: string[],
): Promise<number> {
  assertRegistration(user);
  const ctx = await registrationContext(user, requestId);
  if (!ctx) throw new ProductRegistrationError("not_found");
  const choice = await similarChoices(user, ctx, productId);
  if (!choice) throw new ProductRegistrationError("request_product_not_found");
  const allowed = new Set(choice.fields);
  const chosen = fields.filter((id) => allowed.has(id));
  const values = applySimilar(cleanValues(raw), choice.similar.values, chosen);
  await saveValues(user, ctx.request, values);
  await audit(
    user,
    "product_registration.similar",
    "supplier_request",
    ctx.request.id,
    `Cotação nº ${ctx.request.number}: ${chosen.length} campo(s) trazidos do produto semelhante ${choice.similar.product.name}${choice.similar.product.sankhyaCode ? ` (CODPROD ${choice.similar.product.sankhyaCode})` : ""}`,
  );
  return chosen.length;
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
  if (!line?.sankhyaCode) missing.push("group");
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
  const present = new Set((dictionary?.fields ?? []).map((f) => f.column));
  const payload = sankhyaPayload(
    values,
    columns,
    line!.sankhyaCode!,
    (column) => !dictionary || present.has(column),
  );
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
