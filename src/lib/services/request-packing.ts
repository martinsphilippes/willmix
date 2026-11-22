import "server-only";
import { getStore } from "@/lib/db";
import type {
  BookingItem,
  Product,
  PurchaseSheet,
  Request,
  SupplierRequest,
} from "@/lib/db/schema";
import { columnsExcept, listColumns } from "@/lib/db/lookup";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { isPieceUnit } from "@/lib/moq";
import { cartonsFromPieces } from "@/lib/purchase-rounds";
import {
  normLabel,
  parseRequestSpec,
  type Axis,
  type ParsedSpec,
  type SpecMeasure,
} from "@/lib/request-spec-parse";
import {
  scheduleTotal,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";
import { translator } from "@/i18n";
import { requestRounds, type RequestRounds } from "@/lib/request-rounds";
import type { TotalsLine } from "@/lib/request-totals";
import { productPurchaseView } from "./product-sheet";
import { isBoxUnit } from "./purchase-history";

/*
 * Embalagem de uma solicitação, numa regra só (dono, 18/11/2026; decisões 2
 * e 3 dos totais de Encomendas): peças, peças por caixa master, caixas,
 * caixas inner, cubagem e pedido mínimo, com a origem de cada número. É a
 * conta da ficha completa (docs/REQUEST_SHEET.md, seção 3), e a mesma vale
 * para a lista de Encomendas, a página da encomenda e o CSV, para os
 * números baterem entre as telas (docs/ORDER_LEVEL_LISTS.md).
 *
 * - Origem, nesta ordem: o texto da solicitação → a variação pedida → a
 *   ficha de compra do pedido → a negociação → o Book → a ficha atual do
 *   produto (cadastro e ficha mestre). Sem `technical` (o cliente na
 *   ficha), só o que a própria solicitação gravou.
 * - Caixas master e caixas inner: em cada programação, em caixas inteiras
 *   (para cima, como o gerador), e a soma. Sem programação, do total.
 * - Cubagem: caixas × m³ da caixa master (o m³ como foi gravado; o total
 *   com 4 casas, e a tela formata). Só o m³ da caixa contada: o de uma
 *   caixa com outra quantidade de peças fica de fora (dono, 19/11/2026).
 * - Pedido mínimo (peças): variação → ficha mestre → cadastro.
 */

export type PackingSourceKind =
  | "request"
  | "schedule"
  | "variant"
  | "order"
  | "negotiation"
  | "book"
  | "current"
  | "calculated";

export interface Picked<T> {
  value: T;
  kind: PackingSourceKind;
}

/** O que alimenta a embalagem de uma solicitação. */
export interface PackingInputs {
  request: Pick<
    Request,
    "quantity" | "unit" | "schedule" | "variant" | "specification"
  > &
    Partial<Pick<Request, "innerRequirement">>;
  product: Product | null;
  /** Ficha mestre do produto (`purchase_sheets` com orderId = id do produto). */
  master: PurchaseSheet | null;
  /** Ficha de compra do pedido da solicitação. */
  orderSheet: PurchaseSheet | null;
  negotiation: SupplierRequest | null;
  book: BookingItem | null;
}

export interface RequestPacking {
  /** A especificação lida (a ficha usa o resto dela). */
  spec: ParsedSpec;
  /** Quantidade em caixas (CX, CTN…): peças = caixas × peças por caixa. */
  boxUnit: boolean;
  /** Quantidade em peças ou em caixas: outra unidade (kg, m) não soma peças. */
  countable: boolean;
  schedule: RequestSchedule | null;
  /** Soma da programação gravada (na unidade da solicitação). */
  scheduled: number | null;
  perBox: Picked<number> | null;
  /** Total de peças (a programação manda; sem ela, a quantidade). */
  pieces: Picked<number> | null;
  /** Peças de cada programação (uma só sem programação); nulo sem como contar. */
  roundPieces: number[] | null;
  boxes:
    | (Picked<number> & {
        /** Caixas de cada programação (nulo sem programação). */
        perRound: number[] | null;
        /** Todas as programações fecham em caixas inteiras. */
        exact: boolean;
      })
    | null;
  boxDims: Picked<Pick<SpecMeasure, "values">> | null;
  /** m³ por caixa master; `from` é a fonte das medidas quando calculado. */
  cbmPerBox:
    (Picked<number> & { from: PackingSourceKind; calculated: boolean }) | null;
  /**
   * CBM que ficou de fora por ser de uma caixa com outra quantidade de peças
   * (o primeiro deles e de quantas peças é a caixa dele); nulo quando não há.
   */
  cbmOtherBox: { boxQty: number; kind: PackingSourceKind } | null;
  /** Caixas × m³ da caixa, com o m³ cheio (o total com 4 casas). */
  cbmTotal: number | null;
  /** Peças por caixa inner. */
  inner: Picked<number> | null;
  /** Caixas inner (peças ÷ peças por inner, para cima, em cada programação). */
  innerBoxes: { value: number; perRound: number[] } | null;
  /** Pedido mínimo em peças (só com `technical`). */
  moq: Picked<number> | null;
}

const pos = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Títulos que o portal escreve em comprimento × largura × altura sem dizer os eixos. */
export const PORTAL_ORDER_LABELS = (["pt", "en", "zh"] as const).map((l) =>
  normLabel(translator(l)("catalog.dimensions")),
);

/** Um valor candidato com a origem (o primeiro que existe vale). */
export interface Candidate<T> {
  value: T | null | undefined;
  kind: PackingSourceKind;
}

/** Uma fonte do CBM da caixa master. */
export interface CbmCandidate {
  value: number | null | undefined;
  kind: PackingSourceKind;
  /** Das medidas da caixa da mesma fonte (Calculado). */
  calc: boolean;
  /** Peças por caixa master da mesma fonte (nula ou ausente: a fonte não diz). */
  boxQty: number | null | undefined;
}

export interface PackingCandidates {
  perBox: Candidate<number>[];
  inner: Candidate<number>[];
  cbm: CbmCandidate[];
}

const cbmFrom = (
  d:
    | {
        lengthCm?: number | null;
        widthCm?: number | null;
        heightCm?: number | null;
      }
    | null
    | undefined,
) => (d ? cbmFromDimensions(d.lengthCm, d.widthCm, d.heightCm) : null);

/**
 * Fontes da embalagem, na ordem da ficha (a primeira que existe vale): peças
 * por caixa master, peças por caixa inner e CBM da caixa master (o gravado;
 * sem ele, das medidas da caixa da mesma fonte). Uma lista só para a ficha
 * completa, a lista de Encomendas e a Estratégia de compra
 * (docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia").
 */
export function packingCandidates(
  inputs: PackingInputs,
  tech: boolean,
  spec: ParsedSpec,
  view: ReturnType<typeof productPurchaseView> | null,
): PackingCandidates {
  const { request, product } = inputs;
  const master = view?.master ?? null;
  const variant = request.variant ?? null;
  const neg = tech ? (inputs.negotiation?.item ?? null) : null;
  const bk = tech ? inputs.book : null;
  const sheet = tech ? inputs.orderSheet : null;
  const specBoxCbm =
    spec.boxDims && spec.boxDims.values.length === 3
      ? cbmFromDimensions(
          spec.boxDims.values[0].value,
          spec.boxDims.values[1].value,
          spec.boxDims.values[2].value,
        )
      : null;
  return {
    perBox: [
      { value: spec.perBox, kind: "request" },
      { value: tech ? variant?.masterBoxQty : null, kind: "variant" },
      { value: sheet?.masterCartonQty, kind: "order" },
      { value: neg?.masterCartonQty, kind: "negotiation" },
      { value: bk?.masterCartonQty, kind: "book" },
      { value: view?.pcsPerCarton, kind: "current" },
    ],
    inner: [
      // A caixa inner exigida pelo cliente vem antes de tudo (dono,
      // 21/11/2026; "Caixa inner exigida pelo cliente" na Nova solicitação).
      { value: request.innerRequirement?.qty ?? null, kind: "request" },
      { value: spec.innerQty, kind: "request" },
      { value: tech ? variant?.innerBoxQty : null, kind: "variant" },
      { value: sheet?.innerQty, kind: "order" },
      { value: neg?.innerQty, kind: "negotiation" },
      { value: bk?.innerQty, kind: "book" },
      {
        value: tech ? (product?.innerBoxQty ?? master?.innerQty) : null,
        kind: "current",
      },
    ],
    /* CBM por caixa: o gravado na fonte; sem ele, das medidas da caixa da
       mesma fonte (Calculado). `boxQty`: de quantas peças é essa caixa. */
    cbm: [
      {
        value: spec.cbmPerBox,
        kind: "request",
        calc: false,
        boxQty: spec.perBox,
      },
      { value: specBoxCbm, kind: "request", calc: true, boxQty: spec.perBox },
      {
        value: tech ? variant?.cbm : null,
        kind: "variant",
        calc: false,
        boxQty: variant?.masterBoxQty,
      },
      {
        value: sheet?.cbmPerCarton,
        kind: "order",
        calc: false,
        boxQty: sheet?.masterCartonQty,
      },
      {
        value: cbmFrom(sheet),
        kind: "order",
        calc: true,
        boxQty: sheet?.masterCartonQty,
      },
      {
        value: neg?.cbmPerCarton,
        kind: "negotiation",
        calc: false,
        boxQty: neg?.masterCartonQty,
      },
      {
        value: bk?.cbmPerCarton,
        kind: "book",
        calc: false,
        boxQty: bk?.masterCartonQty,
      },
      {
        value: tech ? product?.cbm : null,
        kind: "current",
        calc: false,
        boxQty: product?.masterBoxQty,
      },
      {
        value:
          tech && product
            ? cbmFromDimensions(
                product.boxLengthCm,
                product.boxWidthCm,
                product.boxHeightCm,
              )
            : null,
        kind: "current",
        calc: true,
        boxQty: product?.masterBoxQty,
      },
      {
        value: tech ? inputs.master?.cbmPerCarton : null,
        kind: "current",
        calc: false,
        boxQty: inputs.master?.masterCartonQty,
      },
      {
        value: tech ? cbmFrom(inputs.master) : null,
        kind: "current",
        calc: true,
        boxQty: inputs.master?.masterCartonQty,
      },
    ],
  };
}

/** O primeiro valor que existe (número só positivo; texto não vazio). */
function pick<T>(candidates: Candidate<T>[]): Picked<T> | null {
  for (const c of candidates) {
    if (c.value === null || c.value === undefined) continue;
    if (typeof c.value === "string" && !c.value.trim()) continue;
    if (typeof c.value === "number" && !pos(c.value)) continue;
    return { value: c.value, kind: c.kind };
  }
  return null;
}

/** Medidas em cm de três colunas (comprimento, largura, altura). */
export function dimsMeasure(
  length: number | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
): Pick<SpecMeasure, "values"> | null {
  const order: [Axis, number | null | undefined][] = [
    ["length", length],
    ["width", width],
    ["height", height],
  ];
  const values = order
    .filter(([, v]) => pos(v))
    .map(([axis, v]) => ({ axis, value: v as number, unit: "cm" }));
  return values.length ? { values } : null;
}

/**
 * O CBM da caixa contada (dono, 19/11/2026: a proteção da Estratégia de
 * compra vale também na ficha completa e nos totais de Encomendas): o
 * primeiro CBM cuja fonte não diz de quantas peças é a caixa, ou diz a mesma
 * quantidade de peças por caixa da conta. O CBM de uma caixa com outra
 * quantidade de peças fica de fora (`otherBox`, para o aviso): multiplicar
 * as caixas de 24 pelo m³ de uma caixa de 60 daria uma cubagem errada.
 */
export function cbmForBox(
  cbm: readonly CbmCandidate[],
  perBox: number | null,
): { hit: CbmCandidate | null; otherBox: CbmCandidate | null } {
  const hits = cbm.filter((c) => pos(c.value));
  const sameBox = (c: CbmCandidate) =>
    !pos(c.boxQty) || !perBox || c.boxQty === perBox;
  const hit = hits.find(sameBox) ?? null;
  return {
    hit,
    otherBox: hit ? null : (hits.find((c) => !sameBox(c)) ?? null),
  };
}

/**
 * A embalagem de uma solicitação. Pura (lê só o que recebe). `technical`:
 * usa o que está fora da solicitação (variação, pedido, negociação, Book e
 * ficha atual); sem ele, só o texto gravado na solicitação.
 */
export function resolvePacking(
  inputs: PackingInputs,
  technical: boolean,
  parsed?: ParsedSpec,
): RequestPacking {
  const { request, product } = inputs;
  const tech = technical;
  const view =
    tech && product ? productPurchaseView(product, inputs.master) : null;
  const master = view?.master ?? null;
  const variant = request.variant ?? null;
  const sheet = tech ? inputs.orderSheet : null;
  const spec =
    parsed ?? parseRequestSpec(request.specification, PORTAL_ORDER_LABELS);
  const candidates = packingCandidates(inputs, tech, spec, view);

  /* ---------- Quantidades ---------- */
  const schedule = request.schedule?.items.length ? request.schedule : null;
  const perBox = pick<number>(candidates.perBox);
  const boxUnit = isBoxUnit(request.unit);
  const countable = boxUnit || isPieceUnit(request.unit);
  const scheduled = schedule ? scheduleTotal(schedule) : null;
  /* Total de peças: a programação gravada manda (é o que será comprado);
     sem ela, a quantidade da solicitação. Em caixas, peças = caixas × peças
     por caixa master (calculado). */
  const piecesFrom = (qty: number): Picked<number> | null =>
    boxUnit
      ? perBox
        ? { value: qty * perBox.value, kind: "calculated" }
        : null
      : { value: qty, kind: scheduled !== null ? "schedule" : "request" };
  const pieces =
    scheduled !== null ? piecesFrom(scheduled) : piecesFrom(request.quantity);
  const roundPieces: number[] | null = !countable
    ? null
    : schedule
      ? boxUnit
        ? perBox
          ? schedule.items.map((i) => i.quantity * perBox.value)
          : null
        : schedule.items.map((i) => i.quantity)
      : pieces
        ? [pieces.value]
        : null;

  /* Caixas master: em caixas, o gravado; em peças, uma conta por
     programação (cada rodada em caixas inteiras, para cima, como o
     gerador), ou do total sem programação. */
  let boxes: RequestPacking["boxes"] = null;
  if (boxUnit) {
    const qty = scheduled ?? request.quantity;
    boxes = {
      value: qty,
      kind: scheduled !== null ? "schedule" : "request",
      perRound: schedule ? schedule.items.map((i) => i.quantity) : null,
      exact: true,
    };
  } else if (perBox && pieces) {
    if (schedule) {
      const per = schedule.items.map(
        (i) => cartonsFromPieces(i.quantity, perBox.value) ?? 0,
      );
      boxes = {
        value: per.reduce((s, n) => s + n, 0),
        kind: "calculated",
        perRound: per,
        exact: schedule.items.every((i) => i.quantity % perBox.value === 0),
      };
    } else {
      boxes = {
        value: cartonsFromPieces(pieces.value, perBox.value) ?? 0,
        kind: "calculated",
        perRound: null,
        exact: pieces.value % perBox.value === 0,
      };
    }
  }

  /* Caixa master: medidas e cubagem por caixa. */
  const boxDims = pick<Pick<SpecMeasure, "values">>([
    { value: spec.boxDims, kind: "request" },
    {
      value: sheet
        ? dimsMeasure(sheet.lengthCm, sheet.widthCm, sheet.heightCm)
        : null,
      kind: "order",
    },
    /* As medidas do Book (e da negociação, que as copia) são da PEÇA, não da
       caixa master (dono, 15/11/2026; docs/SUPPLIER_REQUESTS.md): não entram
       aqui; vão para "Medidas da peça". */
    {
      value:
        product && tech
          ? (dimsMeasure(
              product.boxLengthCm,
              product.boxWidthCm,
              product.boxHeightCm,
            ) ??
            (master
              ? dimsMeasure(master.lengthCm, master.widthCm, master.heightCm)
              : null))
          : null,
      kind: "current",
    },
  ]);
  /* CBM por caixa: o gravado na fonte; sem ele, das medidas da caixa da
     mesma fonte (Calculado). Só o da caixa contada (`cbmForBox`; dono,
     19/11/2026): o de uma caixa com outra quantidade de peças fica de fora,
     como na Estratégia de compra. */
  const { hit: cbmHit, otherBox: cbmOther } = cbmForBox(
    candidates.cbm,
    perBox?.value ?? null,
  );
  /* O m³ da caixa como foi gravado (sem arredondar): a conta preserva as
     casas decimais e só a tela formata (dono, 18/11/2026; antes, 0,1476375
     virava 0,1476 e as 200 caixas davam 29,52 m³ em vez de 29,5275). */
  const cbmPerBox: RequestPacking["cbmPerBox"] = cbmHit
    ? {
        value: cbmHit.value as number,
        kind: cbmHit.calc ? "calculated" : cbmHit.kind,
        from: cbmHit.kind,
        calculated: cbmHit.calc,
      }
    : null;
  const cbmTotal =
    cbmPerBox && boxes ? r4(cbmPerBox.value * boxes.value) : null;

  /* Caixa inner: peças por inner e quantas caixas inner (opcional). */
  const inner = pick<number>(candidates.inner);
  const innerPerRound =
    inner && roundPieces
      ? roundPieces.map((p) => cartonsFromPieces(p, inner.value) ?? 0)
      : null;
  const innerBoxes = innerPerRound
    ? {
        value: innerPerRound.reduce((s, n) => s + n, 0),
        perRound: innerPerRound,
      }
    : null;

  const moq = tech
    ? pick<number>([
        { value: variant?.moq, kind: "variant" },
        { value: inputs.master?.moq, kind: "current" },
        { value: product?.moq, kind: "current" },
      ])
    : null;

  return {
    spec,
    boxUnit,
    countable,
    schedule,
    scheduled,
    perBox,
    pieces,
    roundPieces,
    boxes,
    boxDims,
    cbmPerBox,
    cbmOtherBox:
      cbmOther && pos(cbmOther.boxQty)
        ? { boxQty: cbmOther.boxQty, kind: cbmOther.kind }
        : null,
    cbmTotal,
    inner,
    innerBoxes,
    moq,
  };
}

/* ------------------------------------------------------------------ */
/* Negociação e Book do produto (a mesma escolha da ficha completa)     */
/* ------------------------------------------------------------------ */

const LIVE_NEGOTIATION = new Set<SupplierRequest["status"]>([
  "open",
  "answered",
  "approved",
]);

/** A negociação do produto: a do pedido; senão a aprovada, a respondida, a aberta (a mais recente). */
export function pickNegotiation(
  list: readonly SupplierRequest[],
  request: Pick<Request, "productId" | "orderId">,
): SupplierRequest | null {
  const live = list.filter(
    (s) => s.productId === request.productId && LIVE_NEGOTIATION.has(s.status),
  );
  if (request.orderId) {
    const byOrder = live.find((s) => s.orderId === request.orderId);
    if (byOrder) return byOrder;
  }
  const rank = (s: SupplierRequest) =>
    s.status === "approved" ? 0 : s.status === "answered" ? 1 : 2;
  return (
    [...live].sort(
      (a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt),
    )[0] ?? null
  );
}

/** Book: o item da negociação escolhida; senão o mais recente do produto. */
export function pickBook(
  books: readonly BookingItem[],
  request: Pick<Request, "productId">,
  negotiation: SupplierRequest | null,
): BookingItem | null {
  const linked = negotiation?.bookingItemId
    ? books.find((b) => b.id === negotiation.bookingItemId)
    : null;
  if (linked) return linked;
  return (
    books
      .filter((b) => b.productId === request.productId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Carregador (listas: Encomendas, página da encomenda e CSV)           */
/* ------------------------------------------------------------------ */

type PackingRequest = Pick<
  Request,
  | "id"
  | "productId"
  | "orderId"
  | "quantity"
  | "unit"
  | "schedule"
  | "variant"
  | "specification"
>;

/**
 * A embalagem de cada solicitação (por id), com tudo o que a ficha completa
 * usa: cadastro, ficha mestre, ficha do pedido, negociação e Book. Lê só os
 * produtos e pedidos dessas solicitações. Para as listas da Wellmix e do
 * cliente (peças por caixa e caixas aparecem para todos que veem o pedido;
 * docs/ORDER_LEVEL_LISTS.md, seção 3).
 */
export async function loadRequestPacking(
  requests: readonly PackingRequest[],
): Promise<Map<string, RequestPacking>> {
  const out = new Map<string, RequestPacking>();
  if (!requests.length) return out;
  const store = getStore();
  const productIds = [
    ...new Set(
      requests.map((r) => r.productId).filter((v): v is string => !!v),
    ),
  ];
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter((v): v is string => !!v)),
  ];
  const [products, sheets, negotiations, books] = await Promise.all([
    // Sem a cópia do registro do ERP (pesa mais que o resto e não entra na conta).
    productIds.length
      ? listColumns(
          store,
          "products",
          columnsExcept("products", ["sankhyaRefs", "sankhyaImages"]),
          { filter: { id: productIds } },
        )
      : Promise.resolve([]),
    productIds.length || orderIds.length
      ? store.list("purchase_sheets", {
          filter: { orderId: [...productIds, ...orderIds] },
        })
      : Promise.resolve([] as PurchaseSheet[]),
    productIds.length
      ? store.list("supplier_requests", { filter: { productId: productIds } })
      : Promise.resolve([] as SupplierRequest[]),
    productIds.length
      ? store.list("booking_items", { filter: { productId: productIds } })
      : Promise.resolve([] as BookingItem[]),
  ]);
  const productById = new Map(products.map((p) => [p.id, p as Product]));
  const sheetByOwner = new Map(sheets.map((s) => [s.orderId, s]));
  for (const r of requests) {
    const negotiation = r.productId ? pickNegotiation(negotiations, r) : null;
    out.set(
      r.id,
      resolvePacking(
        {
          request: r,
          product: r.productId ? (productById.get(r.productId) ?? null) : null,
          master: r.productId ? (sheetByOwner.get(r.productId) ?? null) : null,
          orderSheet: r.orderId ? (sheetByOwner.get(r.orderId) ?? null) : null,
          negotiation,
          book: r.productId ? pickBook(books, r, negotiation) : null,
        },
        true,
      ),
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Totais e containers pela embalagem                                  */
/* ------------------------------------------------------------------ */

/**
 * A linha de um produto nos totais da encomenda (src/lib/request-totals.ts).
 * `name`: o nome como a tela mostra (para dizer quem ficou de fora).
 */
export function packingTotalsLine(
  request: Pick<Request, "productId" | "variantId" | "priceForecast">,
  packing: RequestPacking | undefined,
  name: string,
): TotalsLine {
  const p = packing ?? null;
  const countable = !!p?.countable;
  const forecast = request.priceForecast ?? null;
  return {
    name,
    productKey: request.productId
      ? `${request.productId}|${request.variantId ?? ""}`
      : null,
    countable,
    pieces: countable ? (p?.pieces?.value ?? null) : null,
    boxes: countable ? (p?.boxes?.value ?? null) : null,
    innerBoxes: countable ? (p?.innerBoxes?.value ?? null) : null,
    cbm: countable ? (p?.cbmTotal ?? null) : null,
    moq: p?.moq?.value ?? null,
    sale:
      forecast && Number.isFinite(forecast.total)
        ? { amount: forecast.total, currency: forecast.currency }
        : null,
  };
}

/** Caixas master, m³ e containers de cada programação de um produto. */
export interface RoundPacking {
  /** Caixas master de cada programação (nulo sem caixa ou sem como contar). */
  boxes: number[] | null;
  /** m³ de cada programação (caixas × m³ da caixa; nulo sem m³). */
  cbm: number[] | null;
  /** Containers de cada programação, no container de referência. */
  containers: number[] | null;
  totals: {
    boxes: number | null;
    cbm: number | null;
    containers: number | null;
  };
}

/**
 * A embalagem de um produto programação a programação (dono, 22/11/2026;
 * docs/ECONOMIC_GROUPS.md, "Caixas, cubagem e containers por programação"):
 * as mesmas caixas e o mesmo m³ da ficha e dos totais da encomenda, e os
 * containers pela regra de sempre (`packingRounds`), no maior container das
 * Configurações. Falta o dado: nulo ("—" na tela), nunca zero.
 */
export function roundPackingOf(
  row: Pick<Request, "id" | "productName" | "quantity" | "schedule">,
  packing: RequestPacking | undefined,
  capacityCbm: number | null,
): RoundPacking {
  const p = packing?.countable ? packing : null;
  const boxes = p?.boxes ? (p.boxes.perRound ?? [p.boxes.value]) : null;
  const perBox = p?.cbmPerBox?.value ?? null;
  const cbm =
    boxes && perBox !== null ? boxes.map((b) => r4(b * perBox)) : null;
  const containers = p
    ? packingRounds([row], new Map([[row.id, p]]), capacityCbm).containers
    : null;
  return {
    boxes,
    cbm,
    containers,
    totals: {
      boxes: p?.boxes?.value ?? null,
      cbm: p?.cbmTotal ?? null,
      containers: containers ? containers.reduce((a, b) => a + b, 0) : null,
    },
  };
}

/**
 * Programações e containers de cada programação pela embalagem (a mesma
 * caixa e o mesmo m³ dos totais e da ficha; dono, 18/11/2026, decisão 3).
 * Sem caixa ou m³ num produto (ou em outra unidade), os containers ficam
 * nulos ("—"), como antes.
 */
export function packingRounds(
  rows: readonly Pick<
    Request,
    "id" | "productName" | "quantity" | "schedule"
  >[],
  packing: ReadonlyMap<string, RequestPacking>,
  capacityCbm: number | null,
): RequestRounds {
  return requestRounds(
    rows.map((r) => {
      const p = packing.get(r.id);
      return {
        id: r.id,
        productName: r.productName,
        quantity: r.quantity,
        // As peças de cada programação (em caixas, já convertidas).
        schedule: p?.roundPieces
          ? { items: p.roundPieces.map((quantity) => ({ quantity })) }
          : (r.schedule ?? null),
        variant: null,
      };
    }),
    (r) => {
      const p = packing.get(r.id);
      if (!p?.countable) return null;
      return {
        masterBoxQty: p.perBox?.value ?? null,
        cbm: p.cbmPerBox?.value ?? null,
      };
    },
    capacityCbm,
  );
}
