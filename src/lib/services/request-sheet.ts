import "server-only";
import { getStore, type User } from "@/lib/db";
import type {
  BookingItem,
  BookingLot,
  Order,
  OrderItem,
  Party,
  PaymentCondition,
  PaymentTermInstallment,
  Product,
  ProductLine,
  PurchaseSheet,
  Request,
  SupplierRequest,
} from "@/lib/db/schema";
import { listByIds } from "@/lib/db/lookup";
import { canViewOrder, isWellmix } from "@/lib/auth/permissions";
import {
  canSeeMoney,
  canSeePurchasePrice,
} from "@/lib/auth/function-access";
import type { RequestSchedule } from "@/lib/workflow/request-schedule";
import {
  normLabel,
  parseRequestSpec,
  type ParsedSpec,
  type SpecLine,
  type SpecMeasure,
} from "@/lib/request-spec-parse";
import { describeTerms, termWhen } from "@/components/supplier-terms-text";
import { productNameText, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { withoutPlaceholder } from "@/lib/placeholder-name";
import { productPurchaseView } from "./product-sheet";
import {
  customerPaymentView,
  type CustomerPaymentView,
} from "./customer-payment";
import type { PaymentPlanEvent } from "@/lib/customer-payment";
import { isPieceUnit } from "./purchase-history";
import {
  PORTAL_ORDER_LABELS,
  dimsMeasure,
  packingCandidates,
  pickBook,
  pickNegotiation,
  cbmForBox,
  resolvePacking,
} from "./request-packing";
import type { PackingBasis } from "@/lib/strategy-packing";

/*
 * Ficha completa da solicitação (dono, 15/11/2026; docs/REQUEST_SHEET.md).
 * Uma linha por produto (esta solicitação e as do mesmo lote que o login
 * vê) com os dados principais e, em "Ver ficha completa", quatro grupos:
 * Produto, Embalagem e cubagem, Valores e Pagamento.
 *
 * Cada dado diz de onde veio, nesta ordem: o que a solicitação gravou (o
 * texto da especificação, a variação pedida e a programação), o pedido
 * (item e ficha de compra), a negociação com o fornecedor, o Book e, por
 * último, a ficha atual do produto (cadastro e ficha mestre), marcada como
 * "Ficha atual". Caixas e cubagem calculadas pelas regras do portal saem
 * como "Calculado". Sem dado: "Não informado" (valor nulo).
 *
 * Permissões no servidor (o que o perfil não pode ver não sai daqui):
 * - Wellmix: códigos, caixa, medidas, cubagem e a ficha atual (como no
 *   Histórico de compras).
 * - Preço de compra (cotação, negociado, pedido, o custo registrado do
 *   cadastro, que é o da última compra, e as faixas de preço) e condições do
 *   fornecedor: Wellmix com "Ver preço de compra" ou "Ver valores e margem"
 *   (`canSeePurchasePrice`; dono, 15/11/2026, docs/LINHA_DE_VISAO.md).
 * - Análise do Superplan (custo nacionalizado, venda sugerida, margem): só
 *   Wellmix com "Ver valores e margem" (`canSeeMoney`).
 * - Venda ao cliente e sinal: Wellmix com "Ver valores e margem"; o login do
 *   cliente vê a venda e o sinal das solicitações dele.
 * - O cliente vê só o que a própria solicitação gravou (o texto que ele já
 *   vê), a quantidade, a programação e a venda dele.
 */

export interface SheetAccess {
  /** Códigos, caixa, medidas, cubagem e a ficha atual do produto. */
  technical: boolean;
  /**
   * Compra (cotação, negociado, pedido), custo registrado do cadastro (o da
   * última compra), faixas de preço e condições do fornecedor.
   */
  purchase: boolean;
  /** Análise do Superplan: custo nacionalizado, venda sugerida e margem. */
  cost: boolean;
  /** Venda ao cliente e sinal. */
  sale: boolean;
}

export function sheetAccess(user: User): SheetAccess {
  const wellmix = isWellmix(user);
  const money = wellmix && canSeeMoney(user);
  return {
    technical: wellmix,
    purchase: wellmix && canSeePurchasePrice(user),
    cost: money,
    sale: wellmix ? money : user.role === "customer",
  };
}

export type SourceKind =
  | "request"
  | "schedule"
  | "variant"
  | "order"
  | "negotiation"
  | "book"
  | "superplan"
  | "current"
  | "line"
  | "supplier"
  | "calculated";

export interface SheetSource {
  kind: SourceKind;
  /** "Solicitação", "Pedido nº 12", "Ficha atual", "Calculado"… */
  label: string;
  /** Tela do registro (pedido, negociação), para quem pode abrir. */
  href?: string | null;
}

export interface SheetField {
  /** Chave estável (testes e âncoras). */
  key: string;
  label: string;
  /** Texto pronto; nulo = "Não informado". */
  value: string | null;
  source: SheetSource | null;
  /** A conta ou a observação ("2 programações: 1.000 + 1.000"). */
  note?: string | null;
}

export interface SheetSection {
  key: string;
  title: string | null;
  fields: SheetField[];
}

export type SheetGroupKey = "product" | "packing" | "values" | "payment";

export interface SheetGroup {
  key: SheetGroupKey;
  title: string;
  sections: SheetSection[];
  /** O perfil não vê este grupo: o aviso (os dados não saíram do servidor). */
  restricted: string | null;
}

export interface SheetRow {
  requestId: string;
  /** A solicitação aberta na tela (as outras são do mesmo lote). */
  current: boolean;
  name: string;
  /** SKU (só Wellmix). */
  code: string | null;
  variant: string | null;
  main: {
    pieces: SheetField;
    /** Nulo: o perfil não vê caixas e cubagem. */
    boxes: SheetField | null;
    cbm: SheetField | null;
    deadline: string | null;
    /** Nulo: o perfil não vê. */
    cost: SheetField | null;
    purchase: SheetField | null;
    sale: SheetField | null;
  };
  groups: SheetGroup[];
  warnings: string[];
  schedule: RequestSchedule | null;
  unit: string;
  /**
   * Foto do produto na primeira coluna (dono, 22/11/2026): a primeira da
   * vitrine do catálogo, a mesma que o cliente pode abrir; nula sem foto.
   */
  photoId?: string | null;
}

export interface RequestSheetView {
  access: SheetAccess;
  rows: SheetRow[];
}

/** Tudo o que alimenta a ficha de uma solicitação (o que o perfil pode ver). */
export interface SheetInputs {
  request: Request;
  product: Product | null;
  master: PurchaseSheet | null;
  line: ProductLine | null;
  order: Order | null;
  orderItem: OrderItem | null;
  orderSheet: PurchaseSheet | null;
  /** Itens do pedido (para saber se o total do pedido é deste produto). */
  orderItemCount: number;
  negotiation: SupplierRequest | null;
  book: BookingItem | null;
  bookLot: BookingLot | null;
  supplier: Party | null;
  /** De onde veio o fornecedor: pedido, negociação ou ficha atual. */
  supplierFrom: "order" | "negotiation" | "current" | null;
  paymentCondition: PaymentCondition | null;
  /**
   * Forma de pagamento do cliente no pedido (docs/CUSTOMER_PAYMENT.md), já
   * pela regra de quem vê do pedido (`customerPaymentView`); nulo: sem
   * pedido, sem forma ou o perfil não vê.
   */
  customerPayment?: CustomerPaymentView | null;
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const pos = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const text = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v ? v : null;
};
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Moeda da ficha (RMB) no código do Intl (CNY). */
const isoCurrency = (c: string | null | undefined) => {
  const v = (c ?? "").trim().toUpperCase();
  return v === "RMB" ? "CNY" : v || null;
};

export function moneyText(
  t: Translate,
  amount: number,
  currency: string | null | undefined,
  /** "unit": preço por peça (até 4 casas); "exact": o preço inteiro, na conta escrita. */
  unit: boolean | "exact" = false,
): string {
  const code = isoCurrency(currency);
  // Preço por peça com até 4 casas (US$ 0,0809); total com 2. Na conta
  // escrita ("24.000 peças × R$ 0,61877083"), o preço inteiro, para a conta
  // bater com o total (que usa o preço gravado, sem arredondar).
  const digits =
    unit === "exact"
      ? { minimumFractionDigits: 2, maximumFractionDigits: 8 }
      : unit
        ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (!code)
    return amount.toLocaleString(t.intl, digits) + " " + t("requestSheet.noCurrency");
  try {
    return new Intl.NumberFormat(t.intl, {
      style: "currency",
      currency: code,
      ...digits,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString(t.intl, digits)}`;
  }
}

const count = (t: Translate, n: number) => n.toLocaleString(t.intl);
const decimal = (t: Translate, n: number, digits = 4) =>
  n.toLocaleString(t.intl, { maximumFractionDigits: digits });

function quantityText(t: Translate, n: number, unit: string) {
  return isPieceUnit(unit)
    ? t("requestSheet.pieces", { n: count(t, n) })
    : `${count(t, n)} ${unit}`;
}

/* ------------------------------------------------------------------ */
/* Origem                                                              */
/* ------------------------------------------------------------------ */

function sourceOf(
  t: Translate,
  kind: SourceKind,
  inputs: SheetInputs,
): SheetSource {
  switch (kind) {
    case "order":
      return {
        kind,
        label: t("requestSheet.src.order", { n: inputs.order?.number ?? "" }),
        href: inputs.order ? `/app/orders/${inputs.order.id}` : null,
      };
    case "negotiation":
      return {
        kind,
        label: t("requestSheet.src.negotiation", {
          n: inputs.negotiation?.number ?? "",
        }),
        href: inputs.negotiation
          ? `/app/supplier-requests/${inputs.negotiation.id}`
          : null,
      };
    case "book":
      return {
        kind,
        label: inputs.bookLot
          ? t("requestSheet.src.book", { n: inputs.bookLot.number })
          : t("requestSheet.src.bookPlain"),
      };
    case "superplan":
      return {
        kind,
        label: inputs.bookLot
          ? t("requestSheet.src.superplan", { n: inputs.bookLot.number })
          : t("requestSheet.src.superplanPlain"),
      };
    default:
      return { kind, label: t(`requestSheet.src.${kind}` as DictionaryKey) };
  }
}

/** Um valor candidato com a origem (o primeiro que existe vale). */
interface Candidate<T> {
  value: T | null | undefined;
  kind: SourceKind;
}
function pick<T>(
  candidates: Candidate<T>[],
): { value: T; kind: SourceKind } | null {
  for (const c of candidates) {
    if (c.value === null || c.value === undefined) continue;
    if (typeof c.value === "string" && !c.value.trim()) continue;
    if (typeof c.value === "number" && !pos(c.value)) continue;
    return { value: c.value, kind: c.kind };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Especificação                                                       */
/* ------------------------------------------------------------------ */

/** Títulos de cada atributo nas especificações (pt, en, zh), normalizados. */
const SYNONYMS: Record<string, readonly string[]> = {
  material: ["material", "materiais", "composicao", "composition", "材质", "材料"],
  colors: ["cor", "cores", "color", "colors", "colour", "colours", "颜色"],
  pantone: ["pantone", "cores pantone"],
  package: ["embalagem", "packaging", "package", "包装"],
  capacity: ["capacidade", "capacity", "容量"],
  power: ["energia", "power", "alimentacao", "电源"],
  category: ["categoria", "category", "类别"],
};

const hasLabel = (lines: readonly SpecLine[], attr: keyof typeof SYNONYMS) =>
  lines.some(
    (l) => l.label && SYNONYMS[attr].includes(normLabel(l.label)),
  );

function measureText(t: Translate, m: Pick<SpecMeasure, "values">) {
  const known = m.values.every((v) => v.axis);
  const unitOf = (u: string | null) => (u ? ` ${u}` : "");
  if (known)
    return m.values
      .map(
        (v) =>
          `${t(`requestSheet.axis.${v.axis}` as DictionaryKey)} ${decimal(t, v.value, 2)}${unitOf(v.unit)}`,
      )
      .join(" · ");
  const units = new Set(m.values.map((v) => v.unit));
  const same = units.size === 1 ? [...units][0] : null;
  return (
    m.values
      .map((v) => `${decimal(t, v.value, 2)}${same ? "" : unitOf(v.unit)}`)
      .join(" × ") + unitOf(same)
  );
}

function measureNote(t: Translate, m: Pick<SpecMeasure, "values">) {
  const notes: string[] = [];
  if (!m.values.every((v) => v.axis)) notes.push(t("requestSheet.note.noAxes"));
  if (m.values.some((v) => !v.unit)) notes.push(t("requestSheet.note.noUnit"));
  return notes.length ? notes.join(" ") : null;
}

/* ------------------------------------------------------------------ */
/* Construção da ficha (pura)                                          */
/* ------------------------------------------------------------------ */

function termsSummary(t: Translate, terms: PaymentTermInstallment[]) {
  const deposit = terms
    .filter((x) => x.base === "order_created" && x.days === 0)
    .reduce((s, x) => s + x.percent, 0);
  const last = terms[terms.length - 1];
  return {
    full: describeTerms(t, terms),
    deposit:
      deposit > 0
        ? t("requestSheet.depositPct", {
            pct: deposit.toLocaleString(t.intl, { maximumFractionDigits: 2 }),
          })
        : t("requestSheet.noDeposit"),
    installments: t("requestSheet.installments", { n: terms.length }),
    term: last ? termWhen(t, last.base, last.days) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Embalagem: a Estratégia de compra (as fontes da ficha, uma lista    */
/* só em src/lib/services/request-packing.ts, `packingCandidates`)     */
/* ------------------------------------------------------------------ */

/** Embalagem da Estratégia de compra, pelas fontes da ficha. */
export interface PackingFacts {
  basis: PackingBasis;
  /** De onde veio cada dado (nulo: sem o dado). */
  from: {
    perMaster: SourceKind | null;
    perInner: SourceKind | null;
    cbm: SourceKind | null;
  };
}

/**
 * A embalagem de uma solicitação para a Estratégia de compra (dono,
 * 18/11/2026; docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia"),
 * com as fontes da ficha completa (a mesma ordem, para os números baterem).
 * Duas diferenças, pedidas para esta tela: 0 peças por inner gravado é "sem
 * caixa inner" (a ficha pula o 0), e o CBM só vale se for da mesma caixa
 * contada (CBM de uma caixa com outra quantidade de peças fica de fora, com
 * o aviso). Só para a Wellmix (dados técnicos).
 */
export function packingFactsOf(inputs: SheetInputs): PackingFacts {
  const tech = true;
  const view = inputs.product
    ? productPurchaseView(inputs.product, inputs.master)
    : null;
  const spec = parseRequestSpec(inputs.request.specification, PORTAL_ORDER_LABELS);
  const candidates = packingCandidates(inputs, tech, spec, view);
  const perMaster = pick<number>(candidates.perBox);
  // A primeira inner informada vale, com o 0 (sem caixa inner) contando.
  const innerHit =
    candidates.inner.find(
      (c) =>
        typeof c.value === "number" &&
        Number.isInteger(c.value) &&
        c.value >= 0,
    ) ?? null;
  // CBM da mesma caixa contada (a mesma regra da ficha e dos totais desde
  // 19/11/2026; src/lib/services/request-packing.ts, `cbmForBox`).
  const { hit: cbmHit, otherBox } = cbmForBox(
    candidates.cbm,
    perMaster?.value ?? null,
  );
  return {
    basis: {
      perMaster: perMaster?.value ?? null,
      perInner: (innerHit?.value as number | undefined) ?? null,
      cbmPerMaster: cbmHit ? r4(cbmHit.value as number) : null,
      cbmOtherBox: otherBox ? (otherBox.boxQty as number) : null,
    },
    from: {
      perMaster: perMaster?.kind ?? null,
      perInner: innerHit?.kind ?? null,
      cbm: cbmHit ? (cbmHit.calc ? "calculated" : cbmHit.kind) : null,
    },
  };
}

/**
 * A ficha de uma solicitação. Pura: recebe o que o perfil pode ver (o
 * carregador não lê o que o perfil não vê) e devolve os textos prontos.
 */
export function buildSheetRow(
  inputs: SheetInputs,
  access: SheetAccess,
  t: Translate,
  current: boolean,
): SheetRow {
  const { request, product, line, order, orderItem, orderSheet, negotiation, book } =
    inputs;
  // O que vem de fora da solicitação só para quem vê a ficha técnica.
  const tech = access.technical;
  const view = tech && product ? productPurchaseView(product, inputs.master) : null;
  const master = view?.master ?? null;
  const variant = request.variant ?? null;
  const neg = tech ? (negotiation?.item ?? null) : null;
  const bk = tech ? book : null;
  const sheet = tech ? orderSheet : null;
  const spec = parseRequestSpec(request.specification, PORTAL_ORDER_LABELS);
  const productSpec =
    tech && product?.specification
      ? parseRequestSpec(product.specification, PORTAL_ORDER_LABELS)
      : null;
  const src = (kind: SourceKind) => sourceOf(t, kind, inputs);
  const field = (
    key: string,
    label: string,
    value: string | null,
    kind: SourceKind | null,
    note?: string | null,
  ): SheetField => ({
    key,
    label,
    value,
    source: value !== null && kind ? src(kind) : null,
    note: note ?? null,
  });
  const L = (key: string) => t(`requestSheet.f.${key}` as DictionaryKey);
  const warnings: string[] = [];

  /* ---------- Quantidades, caixas e cubagem ----------
     A mesma regra da lista de Encomendas, da página da encomenda e do CSV
     (src/lib/services/request-packing.ts; dono, 18/11/2026): os números
     batem entre as telas. As fontes são as mesmas da Estratégia de compra
     (`packingCandidates`). Aqui ficam só os textos e as notas. */
  const packing = resolvePacking(inputs, tech, spec);
  const { schedule, perBox, boxUnit, scheduled, pieces, boxDims, inner, moq, cbmTotal } =
    packing;
  if (scheduled !== null && scheduled !== request.quantity)
    warnings.push(
      t("requestSheet.warn.scheduleMismatch", {
        qty: quantityText(t, request.quantity, request.unit),
        total: quantityText(t, scheduled, request.unit),
      }),
    );
  const scheduleNote = schedule
    ? t("requestSheet.note.schedule", {
        n: schedule.items.length,
        list: schedule.items.map((i) => count(t, i.quantity)).join(" + "),
      })
    : null;
  const piecesText = (n: number) =>
    boxUnit ? t("requestSheet.pieces", { n: count(t, n) }) : quantityText(t, n, request.unit);
  const piecesField = field(
    "pieces",
    L("totalPieces"),
    pieces ? piecesText(pieces.value) : null,
    pieces?.kind ?? null,
    pieces?.kind === "calculated" && perBox
      ? t("requestSheet.note.piecesFromBoxes", {
          boxes: count(t, scheduled ?? request.quantity),
          perBox: count(t, perBox.value),
        })
      : scheduleNote,
  );

  /* Caixas master: em caixas, o gravado; em peças, uma conta por
     programação (cada rodada em caixas inteiras, para cima, como o
     gerador), ou do total sem programação. */
  const boxesNote = (() => {
    const b = packing.boxes;
    if (!b || boxUnit || !perBox) return null;
    if (b.perRound) {
      const list = b.perRound.map((n) => count(t, n)).join(" + ");
      return b.exact
        ? t("requestSheet.note.boxesRoundsExact", { list, perBox: count(t, perBox.value) })
        : t("requestSheet.note.boxesRounds", { list, perBox: count(t, perBox.value) });
    }
    return pieces
      ? t("requestSheet.note.boxesTotal", {
          pieces: count(t, pieces.value),
          perBox: count(t, perBox.value),
          exact: decimal(t, pieces.value / perBox.value, 2),
          boxes: count(t, b.value),
        })
      : null;
  })();
  const boxes: { value: number; kind: SourceKind; note: string | null } | null =
    packing.boxes
      ? { value: packing.boxes.value, kind: packing.boxes.kind, note: boxesNote }
      : null;
  const boxesField = field(
    "boxes",
    L("boxes"),
    boxes ? t("requestSheet.boxesN", { n: count(t, boxes.value) }) : null,
    boxes?.kind ?? null,
    boxes?.note,
  );

  /* Caixa master: cubagem por caixa (o gravado na fonte; sem ele, das
     medidas da caixa da mesma fonte, Calculado) e a total, com o m³ como foi
     gravado (sem arredondar antes de multiplicar). */
  const cbmPerBox = packing.cbmPerBox
    ? {
        value: packing.cbmPerBox.value,
        kind: packing.cbmPerBox.kind as SourceKind,
        note: packing.cbmPerBox.calculated
          ? t("requestSheet.note.cbmFromDims", {
              from: src(packing.cbmPerBox.from).label,
            })
          : null,
      }
    : null;
  /* CBM de uma caixa com outra quantidade de peças: fica de fora, com o
     aviso (dono, 19/11/2026; a mesma regra da Estratégia de compra). */
  const cbmOtherNote =
    !cbmPerBox && packing.cbmOtherBox && perBox
      ? t("requestSheet.note.cbmOtherBox", {
          from: src(packing.cbmOtherBox.kind).label,
          qty: count(t, packing.cbmOtherBox.boxQty),
          perBox: count(t, perBox.value),
        })
      : null;
  const cbmPerBoxField = field(
    "cbmPerBox",
    L("cbmPerBox"),
    // Até 7 casas: o m³ como foi gravado (0,1476375), o mesmo da conta.
    cbmPerBox ? `${decimal(t, cbmPerBox.value, 7)} m³` : null,
    cbmPerBox?.kind ?? null,
    cbmPerBox?.note ?? cbmOtherNote,
  );
  const cbmTotalField = field(
    "cbmTotal",
    L("cbmTotal"),
    cbmTotal !== null ? `${decimal(t, cbmTotal)} m³` : null,
    cbmTotal !== null ? "calculated" : null,
    cbmTotal !== null && boxes && cbmPerBox
      ? t("requestSheet.note.cbmTotal", {
          boxes: count(t, boxes.value),
          cbm: decimal(t, cbmPerBox.value, 7),
        })
      : null,
  );

  const packingFields: SheetField[] = [
    piecesField,
    ...(scheduled !== null && (scheduled !== request.quantity || boxUnit)
      ? [
          field(
            "requested",
            L("requested"),
            quantityText(t, request.quantity, request.unit),
            "request",
          ),
        ]
      : []),
    field("innerQty", L("innerQty"), inner ? count(t, inner.value) : null, inner?.kind ?? null),
    field("perBox", L("perBox"), perBox ? count(t, perBox.value) : null, perBox?.kind ?? null),
    boxesField,
  ];
  const cartonFields: SheetField[] = [
    field(
      "boxDims",
      L("boxDims"),
      boxDims ? measureText(t, boxDims.value) : null,
      boxDims?.kind ?? null,
    ),
    cbmPerBoxField,
    cbmTotalField,
    ...(tech
      ? [field("moq", L("moq"), moq ? count(t, moq.value) : null, moq?.kind ?? null)]
      : []),
  ];

  /* ---------- Produto ---------- */
  const identity: SheetField[] = [];
  if (tech) {
    identity.push(
      field("sku", L("sku"), text(product?.sku), "current"),
      field("erp", L("erp"), text(product?.sankhyaCode), "current"),
      ...((): SheetField[] => {
        const factory = pick<string>([
          { value: variant?.factoryItemCode, kind: "variant" },
          { value: sheet?.factoryItemCode, kind: "order" },
          { value: neg?.factoryItemCode, kind: "negotiation" },
          { value: bk?.factoryItemCode, kind: "book" },
          { value: product?.supplierSku ?? master?.factoryItemCode, kind: "current" },
        ]);
        return [field("factory", L("factory"), factory?.value ?? null, factory?.kind ?? null)];
      })(),
      field("ean", L("ean"), text(product?.ean), "current"),
      ...((): SheetField[] => {
        const ncm = pick<string>([
          { value: request.ncm, kind: "request" },
          { value: sheet?.ncm, kind: "order" },
          { value: bk?.ncm, kind: "book" },
          { value: product?.ncm, kind: "current" },
        ]);
        return [field("ncm", L("ncm"), ncm?.value ?? null, ncm?.kind ?? null)];
      })(),
      field("line", L("line"), text(line?.name), "current"),
      field("brand", L("brand"), text(product?.brand), "current"),
    );
  }
  if (variant)
    identity.push(field("variant", L("variant"), text(variant.name), "request"));
  identity.push(
    field(
      "description",
      L("description"),
      text(request.description ? withoutPlaceholder(request.description) : null),
      "request",
    ),
  );
  if (text(request.notes))
    identity.push(field("notes", L("notes"), text(request.notes), "request"));

  /* Especificação: as linhas gravadas na solicitação; o que a ficha atual
     tem e a solicitação não (pelo título), como "Ficha atual". */
  const specFields: SheetField[] = [];
  const loose = spec.lines.filter((l) => !l.label).map((l) => l.value);
  if (loose.length)
    specFields.push(field("spec", L("spec"), loose.join("\n"), "request"));
  spec.lines
    .filter((l): l is SpecLine & { label: string } => !!l.label)
    .forEach((l, i) => specFields.push(field(`spec.${i}`, l.label, l.value, "request")));
  const seen = new Set(
    spec.lines.filter((l) => l.label).map((l) => normLabel(l.label as string)),
  );
  if (productSpec) {
    productSpec.lines
      .filter((l): l is SpecLine & { label: string } => !!l.label && !seen.has(normLabel(l.label)))
      .forEach((l, i) => {
        seen.add(normLabel(l.label));
        specFields.push(field(`spec.current.${i}`, l.label, l.value, "current"));
      });
  }
  if (tech) {
    const all = [
      ...spec.lines,
      ...(productSpec?.lines ?? []),
    ];
    const complement = (
      attr: keyof typeof SYNONYMS,
      key: string,
      candidates: Candidate<string>[],
    ) => {
      if (hasLabel(all, attr)) return;
      const hit = pick<string>(candidates);
      if (hit) specFields.push(field(key, L(key), hit.value, hit.kind));
    };
    complement("category", "category", [{ value: product?.category, kind: "current" }]);
    complement("material", "material", [
      { value: variant?.material, kind: "variant" },
      { value: sheet?.material, kind: "order" },
      { value: neg?.material, kind: "negotiation" },
      { value: bk?.material, kind: "book" },
      { value: product?.material ?? master?.material, kind: "current" },
    ]);
    complement("colors", "colors", [
      { value: variant?.colorAssortment, kind: "variant" },
      { value: sheet?.colorAssortment, kind: "order" },
      { value: neg?.colorAssortment, kind: "negotiation" },
      { value: bk?.colorAssortment, kind: "book" },
      { value: product?.color ?? master?.colorAssortment, kind: "current" },
    ]);
    complement("pantone", "pantone", [
      {
        value:
          text(product?.pantone) ??
          (product?.colorPantones?.length
            ? product.colorPantones.map((c) => `PANTONE ${c.code}`).join(" / ")
            : null),
        kind: "current",
      },
    ]);
    complement("package", "package", [
      { value: variant?.packageType, kind: "variant" },
      { value: sheet?.packageType, kind: "order" },
      { value: neg?.packageType, kind: "negotiation" },
      { value: bk?.packageType, kind: "book" },
      { value: master?.packageType, kind: "current" },
    ]);
    const ml = pick<number>([
      { value: sheet?.capacityMl, kind: "order" },
      { value: neg?.capacityMl, kind: "negotiation" },
      { value: bk?.capacityMl, kind: "book" },
      { value: master?.capacityMl, kind: "current" },
    ]);
    complement("capacity", "capacity", ml ? [{ value: `${decimal(t, ml.value, 1)} ml`, kind: ml.kind }] : []);
    const powerOf = (s: { powerSource?: string | null; powerDetail?: string | null } | null | undefined) => {
      if (!s) return null;
      const source = s.powerSource && s.powerSource !== "none"
        ? t(`sheet.power.${s.powerSource}` as DictionaryKey)
        : null;
      const detail = text(s.powerDetail);
      return source && detail ? `${source} (${detail})` : (source ?? detail);
    };
    complement("power", "power", [
      { value: powerOf(sheet), kind: "order" },
      { value: text(neg?.powerDetail), kind: "negotiation" },
      { value: text(bk?.powerDetail), kind: "book" },
      { value: powerOf(master), kind: "current" },
    ]);
  }

  /* Exigências da linha (atributos que a ficha deve ter e certificações). */
  const lineFields: SheetField[] = [];
  if (tech && line) {
    const known = [...spec.lines, ...(productSpec?.lines ?? [])];
    for (const [i, attr] of (line.prompts?.requiredAttributes ?? []).entries()) {
      const a = normLabel(attr);
      const found = known.find(
        (l) => l.label && (normLabel(l.label) === a || normLabel(l.label).includes(a)),
      );
      lineFields.push(
        field(`lineAttr.${i}`, attr, found?.value ?? null, found ? (spec.lines.includes(found) ? "request" : "current") : null),
      );
    }
    if (line.requiredCertifications?.length)
      lineFields.push(
        field("certifications", L("certifications"), line.requiredCertifications.join(", "), "line"),
      );
  }

  /* Medidas e pesos da peça. */
  const measureFields: SheetField[] = [];
  if (spec.measures.length) {
    spec.measures.forEach((m, i) =>
      measureFields.push(
        field(`measure.${i}`, m.label, measureText(t, m), "request", measureNote(t, m)),
      ),
    );
  } else {
    const dims = pick<Pick<SpecMeasure, "values">>([
      { value: tech && variant ? dimsMeasure(variant.lengthCm, variant.widthCm, variant.heightCm) : null, kind: "variant" },
      // Book e negociação: SIZE LENGTH/WIDTH/HEIGHT são as medidas da peça.
      { value: neg ? dimsMeasure(neg.lengthCm, neg.widthCm, neg.heightCm) : null, kind: "negotiation" },
      { value: bk ? dimsMeasure(bk.lengthCm, bk.widthCm, bk.heightCm) : null, kind: "book" },
      { value: tech && product ? dimsMeasure(product.lengthCm, product.widthCm, product.heightCm) : null, kind: "current" },
    ]);
    measureFields.push(
      field("pieceDims", L("pieceDims"), dims ? measureText(t, dims.value) : null, dims?.kind ?? null),
    );
  }
  const weight = (
    key: "netWeight" | "grossWeight",
    fromSpec: ParsedSpec["netWeight"],
    variantKg: number | null | undefined,
    sheetKg: number | null | undefined,
    negKg: number | null | undefined,
    bookKg: number | null | undefined,
    currentKg: number | null | undefined,
  ) => {
    if (fromSpec)
      return field(key, L(key), `${decimal(t, fromSpec.value, 5)} ${fromSpec.unit}`, "request");
    const hit = pick<number>([
      { value: tech ? variantKg : null, kind: "variant" },
      { value: sheetKg, kind: "order" },
      { value: negKg, kind: "negotiation" },
      { value: bookKg, kind: "book" },
      { value: tech ? currentKg : null, kind: "current" },
    ]);
    // Peso com até 5 casas: 0,01295 kg (12,95 g) não vira 0,013.
    return field(key, L(key), hit ? `${decimal(t, hit.value, 5)} kg` : null, hit?.kind ?? null);
  };
  measureFields.push(
    weight("netWeight", spec.netWeight, variant?.netWeightKg, sheet?.netWeightPcKg, neg?.netWeightPcKg, bk?.netWeightPcKg, view?.netWeightPcKg),
    weight("grossWeight", spec.grossWeight, variant?.grossWeightKg, sheet?.grossWeightPcKg, neg?.grossWeightPcKg, bk?.grossWeightPcKg, view?.grossWeightPcKg),
  );

  const productGroup: SheetGroup = {
    key: "product",
    title: t("requestSheet.g.product"),
    restricted: null,
    sections: [
      { key: "identity", title: t("requestSheet.s.identity"), fields: identity },
      ...(specFields.length
        ? [{ key: "spec", title: t("requestSheet.s.spec"), fields: specFields }]
        : []),
      ...(lineFields.length
        ? [{ key: "line", title: t("requestSheet.s.line"), fields: lineFields }]
        : []),
      { key: "measures", title: t("requestSheet.s.measures"), fields: measureFields },
    ],
  };
  const packingGroup: SheetGroup = {
    key: "packing",
    title: t("requestSheet.g.packing"),
    restricted: null,
    sections: [
      { key: "quantity", title: t("requestSheet.s.quantity"), fields: packingFields },
      { key: "carton", title: t("requestSheet.s.carton"), fields: cartonFields },
    ],
  };

  /* ---------- Valores ---------- */
  const piecesN = pieces?.value ?? null;
  const fob = isoCurrency(order?.fobCurrency) ?? null;
  // Venda: o pedido (item ou pedido de um produto só); senão a solicitação (total).
  const saleUnit = access.sale
    ? (() => {
        if (order && pos(orderItem?.sellUnitPrice))
          return { amount: orderItem.sellUnitPrice, currency: order.sellCurrency, kind: "order" as const, note: null };
        if (order && pos(order.sellPrice) && inputs.orderItemCount <= 1 && piecesN)
          return {
            amount: order.sellPrice / piecesN,
            currency: order.sellCurrency,
            kind: "calculated" as const,
            note: t("requestSheet.note.unitFromTotal", {
              total: moneyText(t, order.sellPrice, order.sellCurrency),
              pieces: count(t, piecesN),
            }),
          };
        if (pos(request.sellPrice) && piecesN)
          return {
            amount: request.sellPrice / piecesN,
            currency: request.sellCurrency,
            kind: "calculated" as const,
            note: t("requestSheet.note.unitFromTotal", {
              total: moneyText(t, request.sellPrice, request.sellCurrency),
              pieces: count(t, piecesN),
            }),
          };
        return null;
      })()
    : null;
  const saleTotal = access.sale
    ? (() => {
        if (order && pos(order.sellPrice) && inputs.orderItemCount <= 1)
          return { amount: order.sellPrice, currency: order.sellCurrency, kind: "order" as const, note: null };
        if (order && pos(orderItem?.sellUnitPrice) && piecesN)
          return {
            amount: orderItem.sellUnitPrice * piecesN,
            currency: order.sellCurrency,
            kind: "calculated" as const,
            note: t("requestSheet.note.times", {
              pieces: count(t, piecesN),
              price: moneyText(t, orderItem.sellUnitPrice, order.sellCurrency, "exact"),
            }),
          };
        if (pos(request.sellPrice))
          return { amount: request.sellPrice, currency: request.sellCurrency, kind: "request" as const, note: null };
        return null;
      })()
    : null;
  const moneyField = (
    key: string,
    m: { amount: number; currency: string | null | undefined; kind: SourceKind; note?: string | null } | null,
    unit: boolean,
  ) =>
    field(key, L(key), m ? moneyText(t, m.amount, m.currency, unit) : null, m?.kind ?? null, m?.note ?? null);

  // Compra: pedido → negociado → cotação do Book.
  const negotiated =
    access.purchase && negotiation && pos(negotiation.supplierPrice)
      ? { amount: negotiation.supplierPrice, currency: negotiation.supplierCurrency, kind: "negotiation" as const }
      : null;
  const pendingProposal = (() => {
    if (!access.purchase || !negotiation?.negotiation?.length) return null;
    const last = negotiation.negotiation[negotiation.negotiation.length - 1];
    return last.kind === "proposal" && pos(last.price)
      ? { amount: last.price, currency: last.currency ?? negotiation.supplierCurrency }
      : null;
  })();
  const quoted =
    access.purchase && book && pos(book.price)
      ? { amount: book.price, currency: book.currency, kind: "book" as const }
      : access.purchase && negotiation && pos(negotiation.item?.price)
        ? { amount: negotiation.item.price, currency: negotiation.item.currency, kind: "book" as const }
        : null;
  const orderUnit =
    access.purchase && order && pos(orderItem?.unitPrice)
      ? { amount: orderItem.unitPrice, currency: fob, kind: "order" as const }
      : null;
  const purchaseUnit = orderUnit ?? negotiated ?? quoted;
  const purchaseTotal = access.purchase
    ? order && pos(order.fobTotal) && inputs.orderItemCount <= 1
      ? { amount: order.fobTotal, currency: order.fobCurrency, kind: "order" as const, note: null }
      : purchaseUnit && piecesN
        ? {
            amount: purchaseUnit.amount * piecesN,
            currency: purchaseUnit.currency,
            kind: "calculated" as const,
            note: t("requestSheet.note.timesFrom", {
              pieces: count(t, piecesN),
              price: moneyText(t, purchaseUnit.amount, purchaseUnit.currency, "exact"),
              from: src(purchaseUnit.kind).label,
            }),
          }
        : null
    : null;
  // Custo registrado: o da variação pedida (copiado na solicitação); senão o da ficha atual.
  const cost = !access.purchase
    ? null
    : variant && pos(variant.price)
      ? { amount: variant.price, currency: variant.currency, kind: "variant" as const }
      : view && pos(view.price)
        ? { amount: view.price, currency: view.currency, kind: "current" as const }
        : null;
  const costTotal =
    cost && piecesN
      ? {
          amount: cost.amount * piecesN,
          currency: cost.currency,
          kind: "calculated" as const,
          note: t("requestSheet.note.times", {
            pieces: count(t, piecesN),
            price: moneyText(t, cost.amount, cost.currency, "exact"),
          }),
        }
      : null;
  const incoterm = access.purchase
    ? pick<string>([
        { value: order?.incoterm, kind: "order" },
        { value: sheet?.incoterm, kind: "order" },
        { value: negotiation?.supplierIncoterm, kind: "negotiation" },
        { value: book?.incoterm, kind: "book" },
        { value: inputs.master?.incoterm, kind: "current" },
      ])
    : null;

  const valuesSections: SheetSection[] = [];
  if (access.sale)
    valuesSections.push({
      key: "sale",
      title: t("requestSheet.s.sale"),
      fields: [moneyField("saleUnit", saleUnit, true), moneyField("saleTotal", saleTotal, false)],
    });
  if (access.purchase || access.cost) {
    const analysis = access.cost ? (book?.analysis ?? null) : null;
    const purchaseFields: SheetField[] = [
      moneyField("quote", quoted, true),
      field(
        "negotiated",
        L("negotiated"),
        negotiated ? moneyText(t, negotiated.amount, negotiated.currency, true) : null,
        negotiated ? "negotiation" : null,
        negotiation
          ? t(`requestSheet.negStatus.${negotiation.status}` as DictionaryKey)
          : null,
      ),
      ...(pendingProposal
        ? [
            field(
              "proposal",
              L("proposal"),
              moneyText(t, pendingProposal.amount, pendingProposal.currency, true),
              "negotiation",
              t("requestSheet.note.proposalPending"),
            ),
          ]
        : []),
      moneyField("purchaseUnit", orderUnit, true),
      moneyField("purchaseTotal", purchaseTotal, false),
      field("incoterm", L("incoterm"), incoterm?.value ?? null, incoterm?.kind ?? null),
    ];
    const costFields: SheetField[] = [
      ...(access.purchase ? [moneyField("cost", cost, true)] : []),
      ...(cost ? [moneyField("costTotal", costTotal, false)] : []),
      ...(access.purchase && product?.priceTiers?.length
        ? [
            field(
              "tiers",
              L("tiers"),
              product.priceTiers
                .map((tier) =>
                  t("requestSheet.tier", {
                    qty: count(t, tier.minQty),
                    price: moneyText(t, tier.price, view?.currency ?? product.currency, true),
                  }),
                )
                .join(" · "),
              "current",
            ),
          ]
        : []),
      ...(analysis
        ? [
            moneyField(
              "landed",
              pos(analysis.costBrl) ? { amount: analysis.costBrl, currency: "BRL", kind: "superplan" } : null,
              true,
            ),
            moneyField(
              "suggested",
              pos(analysis.salePriceBrl) ? { amount: analysis.salePriceBrl, currency: "BRL", kind: "superplan" } : null,
              true,
            ),
            field(
              "margin",
              L("margin"),
              analysis.profitPct !== null && Number.isFinite(analysis.profitPct)
                ? `${analysis.profitPct.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%`
                : null,
              "superplan",
            ),
          ]
        : []),
    ];
    if (access.purchase)
      valuesSections.push({
        key: "purchase",
        title: t("requestSheet.s.purchase"),
        fields: purchaseFields,
      });
    if (costFields.length)
      valuesSections.push({ key: "cost", title: t("requestSheet.s.cost"), fields: costFields });
  }
  const valuesGroup: SheetGroup = {
    key: "values",
    title: t("requestSheet.g.values"),
    sections: valuesSections,
    restricted: valuesSections.length ? null : t("requestSheet.restricted.values"),
  };

  /* ---------- Pagamento ---------- */
  const paymentSections: SheetSection[] = [];
  if (access.purchase) {
    const orderTerms = order?.supplierPaymentTerms?.length ? order.supplierPaymentTerms : null;
    const partyTerms = inputs.supplier?.paymentTerms?.length ? inputs.supplier.paymentTerms : null;
    const terms = orderTerms ?? partyTerms;
    const termsKind: SourceKind | null = orderTerms ? "order" : partyTerms ? "supplier" : null;
    const summary = terms ? termsSummary(t, terms) : null;
    const supplierKind: SourceKind | null =
      inputs.supplierFrom === "order"
        ? "order"
        : inputs.supplierFrom === "negotiation"
          ? "negotiation"
          : inputs.supplierFrom === "current"
            ? "current"
            : null;
    const depositAmount =
      terms && purchaseTotal
        ? (() => {
            const pct = terms
              .filter((x) => x.base === "order_created" && x.days === 0)
              .reduce((s, x) => s + x.percent, 0);
            return pct > 0
              ? t("requestSheet.note.depositAmount", {
                  amount: moneyText(t, (purchaseTotal.amount * pct) / 100, purchaseTotal.currency),
                })
              : null;
          })()
        : null;
    paymentSections.push({
      key: "supplierPay",
      title: t("requestSheet.s.supplierPay"),
      fields: [
        field("supplier", L("supplier"), text(inputs.supplier?.name), supplierKind),
        field("terms", L("terms"), summary?.full ?? null, termsKind),
        field("method", L("method"), text(inputs.supplier?.paymentTermsNote), "supplier"),
        field("deposit", L("deposit"), summary?.deposit ?? null, termsKind, depositAmount),
        field("installments", L("installments"), summary?.installments ?? null, termsKind),
        field("term", L("term"), summary?.term ?? null, termsKind),
        field(
          "erpCondition",
          L("erpCondition"),
          inputs.paymentCondition
            ? `${inputs.paymentCondition.name} (${inputs.paymentCondition.code})`
            : null,
          "order",
        ),
        field(
          "leadTime",
          L("leadTime"),
          negotiation && pos(negotiation.supplierLeadTimeDays)
            ? t("requestSheet.days", { n: negotiation.supplierLeadTimeDays })
            : null,
          "negotiation",
        ),
      ],
    });
  }
  if (access.sale) {
    /* Forma de pagamento do cliente escolhida no pedido (#467): nome, situação
       da alçada, parcelas por evento (com o valor sobre a venda do pedido),
       sinal e prazo da última parcela. Sem forma: "Não informado". */
    const cp = inputs.customerPayment ?? null;
    const plan = cp?.plan ?? null;
    const eventText = (event: PaymentPlanEvent, days: number) => {
      const name = t(`customerPayment.event.${event}` as DictionaryKey);
      return days > 0
        ? t("customerPayment.eventDays", { event: name, days })
        : name;
    };
    const pct = (n: number) =>
      `${n.toLocaleString(t.intl, { maximumFractionDigits: 2 })}%`;
    const installments = plan
      ? (cp?.installments.length
          ? cp.installments
          : plan.installments.map((i, k) => ({ ...i, index: k + 1, amount: null }))
        ).map(
          (i) =>
            `${pct(i.percent)} ${eventText(i.event, i.days).toLocaleLowerCase(t.intl)}` +
            (i.amount !== null && i.amount !== undefined && i.percent > 0
              ? ` (${moneyText(t, i.amount, cp?.currency)})`
              : ""),
        )
      : [];
    const planDeposit = plan
      ? plan.installments
          .filter((i) => i.event === "order" && i.days === 0 && i.percent > 0)
          .reduce((sum, i) => sum + i.percent, 0)
      : 0;
    const last = plan?.installments[plan.installments.length - 1] ?? null;
    paymentSections.push({
      key: "customerPay",
      title: t("requestSheet.s.customerPay"),
      fields: [
        field(
          "saleTerms",
          L("saleTerms"),
          plan ? plan.name : null,
          plan ? "order" : null,
          plan
            ? t(`customerPayment.status.${plan.status}` as DictionaryKey)
            : null,
        ),
        field(
          "saleInstallments",
          L("saleInstallments"),
          installments.length ? installments.join("\n") : null,
          installments.length ? "order" : null,
        ),
        pos(request.downPaymentAmount)
          ? field(
              "saleDeposit",
              L("saleDeposit"),
              moneyText(t, request.downPaymentAmount, request.sellCurrency),
              "request",
            )
          : field(
              "saleDeposit",
              L("saleDeposit"),
              plan
                ? planDeposit > 0
                  ? t("requestSheet.depositPct", { pct: planDeposit.toLocaleString(t.intl, { maximumFractionDigits: 2 }) })
                  : t("requestSheet.noDeposit")
                : null,
              plan ? "order" : null,
            ),
        field(
          "saleTerm",
          L("saleTerm"),
          last ? eventText(last.event, last.days) : null,
          last ? "order" : null,
        ),
      ],
    });
  }
  const paymentGroup: SheetGroup = {
    key: "payment",
    title: t("requestSheet.g.payment"),
    sections: paymentSections,
    restricted: paymentSections.length ? null : t("requestSheet.restricted.payment"),
  };

  return {
    requestId: request.id,
    current,
    name: productNameText(t, request.productName),
    code: tech ? text(product?.sku) : null,
    variant: variant?.name ?? null,
    main: {
      pieces: piecesField,
      boxes: tech ? boxesField : null,
      cbm: tech ? cbmTotalField : null,
      deadline: request.deadline,
      cost: access.purchase ? moneyField("cost", cost, true) : null,
      purchase: access.purchase
        ? field(
            "purchase",
            t("requestSheet.col.purchase"),
            purchaseUnit ? moneyText(t, purchaseUnit.amount, purchaseUnit.currency, true) : null,
            purchaseUnit?.kind ?? null,
          )
        : null,
      sale: access.sale
        ? saleTotal
          ? moneyField("saleTotal", saleTotal, false)
          : moneyField("saleUnit", saleUnit, true)
        : null,
    },
    groups: [productGroup, packingGroup, valuesGroup, paymentGroup],
    warnings,
    schedule,
    unit: request.unit,
  };
}

/* ------------------------------------------------------------------ */
/* Carregador                                                          */
/* ------------------------------------------------------------------ */

/**
 * A ficha das solicitações (esta e as do lote que o login vê), na ordem em
 * que foram criadas. Lê só o que o perfil pode ver.
 */
export async function loadRequestSheet(
  user: User,
  request: Request,
  siblings: readonly Request[],
  t: Translate,
): Promise<RequestSheetView> {
  const access = sheetAccess(user);
  const requests = [request, ...siblings].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const rows = await loadSheetInputs(user, requests);
  // Pagamento do cliente: só com acesso à venda na ficha e pela regra do
  // pedido (o cliente vê a forma aprovada; a Wellmix, quem vê valores…).
  const payments = await Promise.all(
    rows.map((inputs) =>
      access.sale && inputs.order
        ? customerPaymentView(user, inputs.order)
        : Promise.resolve(null),
    ),
  );
  const photos = await sheetPhotos(user, requests).catch((error) => {
    console.error("[request-sheet] fotos", error);
    return new Map<string, string>();
  });
  return {
    access,
    rows: rows.map((inputs, i) => ({
      ...buildSheetRow(
        { ...inputs, customerPayment: payments[i] },
        access,
        t,
        inputs.request.id === request.id,
      ),
      photoId: inputs.request.productId
        ? (photos.get(inputs.request.productId) ?? null)
        : null,
    })),
  };
}

/**
 * A foto de cada produto da ficha (dono, 22/11/2026): a primeira da vitrine
 * do catálogo (`catalogShowcasePhotos`: nunca o cartão do fornecedor nem a
 * foto de referência). Fora da Wellmix, só a que a pessoa pode abrir: a de
 * produto ativo e não escondido pelo Book (a regra de `canAccessDocument`),
 * para a miniatura não aparecer quebrada.
 */
async function sheetPhotos(
  user: User,
  requests: readonly Request[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const productIds = [
    ...new Set(
      requests.map((r) => r.productId).filter((v): v is string => !!v),
    ),
  ];
  if (!productIds.length) return out;
  const { catalogShowcasePhotos } = await import("./documents");
  const showcase = await catalogShowcasePhotos(productIds);
  let allowed = (id: string) => showcase.has(id);
  if (!isWellmix(user)) {
    const { hiddenBookingProductIds } = await import("./booking-visibility");
    const [products, hidden] = await Promise.all([
      listByIds(getStore(), "products", productIds),
      hiddenBookingProductIds(),
    ]);
    const active = new Set(products.filter((p) => p.active).map((p) => p.id));
    allowed = (id) => showcase.has(id) && active.has(id) && !hidden.has(id);
  }
  for (const id of productIds) {
    const first = allowed(id) ? showcase.get(id)?.[0] : undefined;
    if (first) out.set(id, first.documentId);
  }
  return out;
}

/**
 * O que alimenta a ficha de cada solicitação (só o que o perfil pode ver),
 * na ordem recebida: produto, ficha mestre, pedido, negociação, Book,
 * fornecedor. A Estratégia de compra lê a embalagem pelas mesmas entradas
 * (`packingFactsOf`).
 */
export async function loadSheetInputs(
  user: User,
  requests: readonly Request[],
): Promise<SheetInputs[]> {
  const access = sheetAccess(user);
  const store = getStore();
  const productIds = [
    ...new Set(requests.map((r) => r.productId).filter((v): v is string => !!v)),
  ];
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter((v): v is string => !!v)),
  ];
  const fromProduct = access.technical || access.purchase || access.cost;
  const [products, masters, ordersRaw, items, orderSheets, negotiations, books] =
    await Promise.all([
      fromProduct ? listByIds(store, "products", productIds) : Promise.resolve([]),
      fromProduct && productIds.length
        ? store.list("purchase_sheets", { filter: { orderId: productIds } })
        : Promise.resolve([] as PurchaseSheet[]),
      orderIds.length && (access.technical || access.sale)
        ? listByIds(store, "orders", orderIds)
        : Promise.resolve([] as Order[]),
      orderIds.length && (access.technical || access.sale)
        ? store.list("order_items", { filter: { orderId: orderIds } })
        : Promise.resolve([] as OrderItem[]),
      orderIds.length && access.technical
        ? store.list("purchase_sheets", { filter: { orderId: orderIds } })
        : Promise.resolve([] as PurchaseSheet[]),
      fromProduct && productIds.length
        ? store.list("supplier_requests", { filter: { productId: productIds } })
        : Promise.resolve([] as SupplierRequest[]),
      fromProduct && productIds.length
        ? store.list("booking_items", { filter: { productId: productIds } })
        : Promise.resolve([] as BookingItem[]),
    ]);
  // O cliente vê a venda só dos pedidos que ele pode abrir.
  const orders = ordersRaw.filter((o) => isWellmix(user) || canViewOrder(user, o));
  const productById = new Map(products.map((p) => [p.id, p]));
  const masterByProduct = new Map(masters.map((s) => [s.orderId, s]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const sheetByOrder = new Map(orderSheets.map((s) => [s.orderId, s]));
  const chosen = new Map(
    requests.map((r) => [r.id, pickNegotiation(negotiations, r)]),
  );
  // Book: o item da negociação escolhida; senão o mais recente do produto.
  const bookChoice = new Map(
    requests.map((r) => [r.id, pickBook(books, r, chosen.get(r.id) ?? null)]),
  );
  const [lines, lots, parties, conditions] = await Promise.all([
    access.technical
      ? listByIds(store, "product_lines", products.map((p) => p.lineId))
      : Promise.resolve([] as ProductLine[]),
    fromProduct
      ? listByIds(
          store,
          "booking_lots",
          [...bookChoice.values()].map((b) => b?.lotId),
        )
      : Promise.resolve([] as BookingLot[]),
    access.purchase
      ? listByIds(store, "parties", [
          ...orders.map((o) => o.supplierId),
          ...[...chosen.values()].map((n) => n?.supplierId),
          ...products.map((p) => p.supplierId),
        ])
      : Promise.resolve([] as Party[]),
    access.purchase
      ? listByIds(
          store,
          "payment_conditions",
          orders.map((o) => o.paymentConditionId),
        )
      : Promise.resolve([] as PaymentCondition[]),
  ]);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const conditionById = new Map(conditions.map((c) => [c.id, c]));

  const rows = requests.map((r) => {
    const product = r.productId ? (productById.get(r.productId) ?? null) : null;
    const order = r.orderId ? (orderById.get(r.orderId) ?? null) : null;
    const orderItems = order ? items.filter((i) => i.orderId === order.id) : [];
    const orderItem =
      orderItems.find(
        (i) =>
          i.productId === r.productId &&
          (!r.variantId || !i.variantId || i.variantId === r.variantId),
      ) ?? (orderItems.length === 1 ? orderItems[0] : null);
    const negotiation = chosen.get(r.id) ?? null;
    const book = bookChoice.get(r.id) ?? null;
    const supplierEntry: [Party | null, SheetInputs["supplierFrom"]] = order
      ? [partyById.get(order.supplierId) ?? null, "order"]
      : negotiation
        ? [partyById.get(negotiation.supplierId) ?? null, "negotiation"]
        : product?.supplierId
          ? [partyById.get(product.supplierId) ?? null, "current"]
          : [null, null];
    const inputs: SheetInputs = {
      request: r,
      product,
      master: product ? (masterByProduct.get(product.id) ?? null) : null,
      line: product ? (lineById.get(product.lineId) ?? null) : null,
      order,
      orderItem,
      orderSheet: order ? (sheetByOrder.get(order.id) ?? null) : null,
      orderItemCount: orderItems.length,
      negotiation,
      book,
      bookLot: book ? (lotById.get(book.lotId) ?? null) : null,
      supplier: supplierEntry[0],
      supplierFrom: supplierEntry[0] ? supplierEntry[1] : null,
      paymentCondition: order?.paymentConditionId
        ? (conditionById.get(order.paymentConditionId) ?? null)
        : null,
    };
    return inputs;
  });
  return rows;
}
