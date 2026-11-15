import "server-only";
import { getStore, type User } from "@/lib/db";
import { orderMilestoneText } from "@/lib/milestones";
import type {
  Order,
  OrderItem,
  Product,
  PurchaseRound,
  PurchaseSheet,
  VariantSnapshot,
} from "@/lib/db/schema";
import { listByIds, listColumns } from "@/lib/db/lookup";
import {
  ORDER_ACCESS_FIELDS,
  canSeeSellPrice,
  canViewOrder,
  isWellmix,
} from "@/lib/auth/permissions";
import { canSeeMoney } from "@/lib/auth/function-access";
import { boxesFor } from "@/lib/logistics/cbm";
import { realName } from "@/lib/placeholder-name";
import { formatAmount } from "@/lib/workflow/money";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Histórico de compras do cliente na Nova solicitação (dono, 14/11/2026;
 * docs/PURCHASE_HISTORY.md). Os pedidos do cliente, do mais recente para o
 * mais antigo, 10 por vez. A programação de compra entra uma vez: o pedido
 * pai é a compra, e os filhos (as rodadas) ficam no detalhe dele.
 *
 * Cada dado diz de onde veio: gravado no pedido (o próprio pedido, os itens,
 * a solicitação, a ficha de compra do pedido ou a cópia da variação) ou da
 * ficha atual do produto ("Ficha atual", `current`). Sem nenhum dos dois:
 * nulo ("—" na tela).
 *
 * Permissões de sempre: a Wellmix vê os pedidos de qualquer cliente; o login
 * do cliente, só os pedidos dele (`canViewOrder`). Valor de venda: na
 * Wellmix, só com "Ver valores e margem" (`canSeeMoney`, como nas listas e
 * no Histórico comercial); o cliente, a dos pedidos dele. Custo (FOB, preço
 * do fornecedor) nunca.
 * Código, caixa, medidas, cubagem e dados técnicos (a folha do fornecedor)
 * só para a Wellmix, como na lista de Pedidos: para os demais nada disso sai
 * do servidor.
 */

export const HISTORY_PAGE_SIZE = 10;

/** Um dado com a origem: gravado no pedido ou da ficha atual do produto. */
export interface Fact<T> {
  value: T;
  /** Da ficha atual do produto (o pedido não gravou). */
  current: boolean;
}

export interface Dims {
  length: number | null;
  width: number | null;
  height: number | null;
}

export interface Money {
  amount: number;
  currency: string;
}

export type TechKey =
  | "material"
  | "package"
  | "capacity"
  | "colors"
  | "innerQty"
  | "netWeight"
  | "grossWeight"
  | "ncm"
  | "ean";

/** Código, caixa, medidas, cubagem e dados técnicos: só a Wellmix. */
export interface HistoryItemSheet {
  sku: Fact<string> | null;
  erpCode: Fact<string> | null;
  factoryCode: Fact<string> | null;
  pieces: Fact<number> | null;
  perBox: Fact<number> | null;
  boxes: Fact<number> | null;
  productDims: Fact<Dims> | null;
  boxDims: Fact<Dims> | null;
  cbmPerBox: Fact<number> | null;
  cbmTotal: Fact<number> | null;
  technical: { key: TechKey; fact: Fact<string | number> }[];
}

export interface HistoryItem {
  /** Produto do catálogo do item (nulo fora do catálogo). */
  productId?: string | null;
  name: string;
  quantity: number;
  unit: string;
  description: Fact<string> | null;
  specification: Fact<string> | null;
  /** Nulo para quem não é da Wellmix (a folha do fornecedor não sai). */
  sheet: HistoryItemSheet | null;
  /**
   * Venda por produto: a gravada no item (`sellUnitPrice`); sem ela, a do
   * pedido de um produto (total ÷ quantidade).
   */
  unitSale: Money | null;
  subtotalSale: Money | null;
}

export interface HistoryRound {
  index: number;
  /** AAAA-MM-DD prevista na programação. */
  expectedAt: string | null;
  /** Peças previstas na rodada (todos os produtos). */
  pieces: number | null;
  /** A rodada já virou pedido (mesmo que este login não veja o filho). */
  created: boolean;
  /** Pedido filho da rodada; nulo enquanto não nasceu ou fora da vista. */
  order: {
    id: string;
    number: number;
    status: Order["status"];
    date: string | null;
    items: HistoryItem[];
  } | null;
}

export interface HistoryPurchase {
  orderId: string;
  number: number;
  status: Order["status"];
  /** Data da compra (nula: não gravada). */
  date: string | null;
  /** Pedido da carga do Sankhya (a data, quando há, é a do pedido lá). */
  imported: boolean;
  total: Money | null;
  items: HistoryItem[];
  /** Programação de compra (pedido pai): as rodadas e os pedidos filhos. */
  rounds: HistoryRound[];
}

export interface HistoryPage {
  purchases: HistoryPurchase[];
  /** Número do último pedido da página, para "Carregar mais" (nulo: acabou). */
  next: number | null;
}

const PIECE_UNITS = new Set([
  "un",
  "und",
  "unid",
  "unidade",
  "unidades",
  "pc",
  "pcs",
  "pç",
  "pçs",
  "peça",
  "peças",
  "pz",
  "ea",
  "piece",
  "pieces",
]);
const BOX_UNITS = new Set([
  "cx",
  "caixa",
  "caixas",
  "ctn",
  "ctns",
  "carton",
  "cartons",
  "box",
  "boxes",
]);
const unitKey = (unit: string) => unit.trim().toLowerCase();
export const isPieceUnit = (unit: string) => PIECE_UNITS.has(unitKey(unit));
export const isBoxUnit = (unit: string) => BOX_UNITS.has(unitKey(unit));

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function fact<T>(
  value: T | null | undefined,
  current: boolean,
): Fact<T> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return { value, current };
}
/**
 * Medida física (peso, medida, cubagem, peças por caixa): zero é "não
 * preenchido" (a carga do Sankhya grava 0 no campo vazio: 1.756 produtos com
 * peso 0 e 247 com uma medida 0 em 14/11/2026), não um valor.
 */
const measure = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
/** O primeiro que existe (o gravado no pedido vem antes da ficha atual). */
const first = <T>(...facts: (Fact<T> | null)[]): Fact<T> | null =>
  facts.find((f): f is Fact<T> => !!f) ?? null;

function dims(
  length: number | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
): Dims | null {
  const d = {
    length: measure(length),
    width: measure(width),
    height: measure(height),
  };
  return d.length === null && d.width === null && d.height === null ? null : d;
}

/** CBM das três medidas em cm (só com as três). */
const cbmOf = (d: Dims | null) =>
  d && d.length && d.width && d.height
    ? round((d.length * d.width * d.height) / 1_000_000, 4)
    : null;

type SheetRow = Pick<
  PurchaseSheet,
  | "orderId"
  | "productId"
  | "factoryItemCode"
  | "masterCartonQty"
  | "innerQty"
  | "cbmPerCarton"
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "capacityMl"
  | "packageType"
  | "colorAssortment"
  | "material"
  | "ncm"
  | "netWeightPcKg"
  | "grossWeightPcKg"
  | "ecommerceDescription"
>;
type ItemRow = Pick<
  OrderItem,
  | "orderId"
  | "productId"
  | "name"
  | "quantity"
  | "unit"
  | "variant"
  | "sankhyaRefs"
  | "sellUnitPrice"
>;

/** Folha do fornecedor do item: o gravado no pedido antes da ficha atual. */
export function itemSheet(input: {
  quantity: number;
  unit: string;
  sankhyaRefs?: Record<string, string | number> | null;
  variant?: VariantSnapshot | null;
  sheet?: SheetRow | null;
  product?: Product | null;
}): HistoryItemSheet {
  const v = input.variant ?? null;
  const s = input.sheet ?? null;
  const p = input.product ?? null;
  const perBox = first(
    fact(measure(s?.masterCartonQty), false),
    fact(measure(v?.masterBoxQty), false),
    fact(measure(p?.masterBoxQty), true),
  );
  const box = isBoxUnit(input.unit);
  const pieces = isPieceUnit(input.unit)
    ? fact(input.quantity, false)
    : box && perBox
      ? fact(input.quantity * perBox.value, perBox.current)
      : null;
  const boxes = box
    ? fact(input.quantity, false)
    : pieces && perBox && perBox.value > 0
      ? fact(
          boxesFor(pieces.value, perBox.value),
          pieces.current || perBox.current,
        )
      : null;
  const sheetBox = s ? dims(s.lengthCm, s.widthCm, s.heightCm) : null;
  const productBox = p
    ? dims(p.boxLengthCm, p.boxWidthCm, p.boxHeightCm)
    : null;
  const cbmPerBox = first(
    fact(measure(s?.cbmPerCarton), false),
    fact(cbmOf(sheetBox), false),
    fact(measure(v?.cbm), false),
    fact(measure(p?.cbm), true),
    fact(cbmOf(productBox), true),
  );
  const cbmTotal =
    cbmPerBox && boxes
      ? fact(
          round(cbmPerBox.value * boxes.value, 4),
          cbmPerBox.current || boxes.current,
        )
      : null;
  const erp = input.sankhyaRefs?.CODPROD;
  const technical: HistoryItemSheet["technical"] = [];
  const tech = (key: TechKey, value: Fact<string | number> | null) => {
    if (value) technical.push({ key, fact: value });
  };
  tech(
    "material",
    first(
      fact(s?.material, false),
      fact(v?.material, false),
      fact(p?.material, true),
    ),
  );
  tech(
    "package",
    first(fact(s?.packageType, false), fact(v?.packageType, false)),
  );
  tech("capacity", fact(measure(s?.capacityMl), false));
  tech(
    "colors",
    first(
      fact(s?.colorAssortment, false),
      fact(v?.colorAssortment, false),
      fact(p?.color, true),
    ),
  );
  tech(
    "innerQty",
    first(
      fact(measure(s?.innerQty), false),
      fact(measure(v?.innerBoxQty), false),
      fact(measure(p?.innerBoxQty), true),
    ),
  );
  tech(
    "netWeight",
    first(
      fact(measure(s?.netWeightPcKg), false),
      fact(measure(v?.netWeightKg), false),
      fact(measure(p?.netWeightKg), true),
    ),
  );
  tech(
    "grossWeight",
    first(
      fact(measure(s?.grossWeightPcKg), false),
      fact(measure(v?.grossWeightKg), false),
      fact(measure(p?.grossWeightKg), true),
    ),
  );
  tech("ncm", first(fact(s?.ncm, false), fact(p?.ncm, true)));
  tech("ean", fact(p?.ean, true));
  return {
    sku: fact(p?.sku, true),
    erpCode: fact(
      erp === undefined || erp === null ? null : String(erp),
      false,
    ),
    factoryCode: first(
      fact(s?.factoryItemCode, false),
      fact(v?.factoryItemCode, false),
      fact(p?.supplierSku, true),
    ),
    pieces,
    perBox,
    boxes,
    productDims: first(
      fact(v ? dims(v.lengthCm, v.widthCm, v.heightCm) : null, false),
      fact(p ? dims(p.lengthCm, p.widthCm, p.heightCm) : null, true),
    ),
    boxDims: first(fact(sheetBox, false), fact(productBox, true)),
    cbmPerBox,
    cbmTotal,
    technical,
  };
}

/** Pedido do fluxo de sempre (nem carga do Sankhya, nem pedido de compra): a solicitação descreve o produto. */
const describesProduct = (
  order: Pick<Order, "sankhyaCode" | "flow" | "parentOrderId">,
) => !order.sankhyaCode && order.flow !== "supplier_request";

/** Colunas para escolher a página: ordem, visibilidade, situação e pai. */
const WINDOW_COLUMNS = [
  ...ORDER_ACCESS_FIELDS,
  "number",
  "status",
  "parentOrderId",
] as const;

export async function loadPurchaseHistory(
  user: User,
  customerId: string,
  before: number | null = null,
  size = HISTORY_PAGE_SIZE,
  /** Quantas compras a tela já mostra (o tamanho da janela lida). */
  shown = 0,
): Promise<HistoryPage> {
  const wellmix = isWellmix(user);
  // A Wellmix vê qualquer cliente; o login do cliente, só a empresa dele.
  if (!wellmix && !(user.role === "customer" && user.partyId === customerId))
    return { purchases: [], next: null };
  const store = getStore();
  const visibleTo = (o: Pick<Order, (typeof WINDOW_COLUMNS)[number]>) =>
    // Pedido cancelado não é compra (a regra do Histórico comercial).
    o.status !== "CANCELLED" && (wellmix || canViewOrder(user, o));
  // A compra é o pedido sem pai: o filho da programação fica no detalhe do
  // pai, sem contar duas vezes. O login do cliente lê só os pedidos dele
  // (canViewOrder: o cliente e quem pediu) já no filtro.
  const filter = wellmix
    ? { customerId, parentOrderId: null }
    : { customerId, requestedByUserId: user.id, parentOrderId: null };
  // O número segue a ordem do pedido (na carga do Sankhya, a do NUNOTA),
  // então "mais recente primeiro" é o número maior primeiro. Lê só uma
  // janela do topo (o que a tela já mostra, a página e um a mais, para saber
  // se há "Carregar mais"), não todos os pedidos do cliente (um cliente tem
  // ~15,7 mil); a janela só cresce se faltar linha (cancelados, ou a tela
  // mostrando mais do que disse).
  let limit = Math.max(0, shown) + size + 1;
  let eligible: Pick<Order, (typeof WINDOW_COLUMNS)[number] | "id">[];
  for (;;) {
    const rows = await listColumns(store, "orders", WINDOW_COLUMNS, {
      filter,
      orderBy: "number",
      direction: "desc",
      limit,
    });
    eligible = rows.filter(
      (o) => visibleTo(o) && (before === null || o.number < before),
    );
    if (eligible.length > size || rows.length < limit) break;
    limit *= 2;
  }
  const pageRows = eligible.slice(0, size);
  if (!pageRows.length) return { purchases: [], next: null };
  const pageIds = new Set(pageRows.map((o) => o.id));
  // Os filhos (rodadas) dos pedidos da página, com a mesma visibilidade.
  const childRows = (
    await listColumns(store, "orders", WINDOW_COLUMNS, {
      filter: { parentOrderId: [...pageIds] },
    })
  ).filter(visibleTo);
  const ids = [...pageIds, ...childRows.map((o) => o.id)];
  const full = await listByIds(store, "orders", ids);
  const byId = new Map(full.map((o) => [o.id, o]));
  const imported = full.filter((o) => !!o.sankhyaCode).map((o) => o.id);
  const [items, stages, requests] = await Promise.all([
    listColumns(
      store,
      "order_items",
      [
        "orderId",
        "productId",
        "name",
        "quantity",
        "unit",
        "variant",
        "sankhyaRefs",
        "sellUnitPrice",
      ],
      { filter: { orderId: ids }, jsonKeys: { sankhyaRefs: ["CODPROD"] } },
    ),
    // A carga do Sankhya não grava a data do pedido lá (DTNEG) no pedido:
    // ela fica no fim da etapa "Pedido criado" quando a nota já passou dela.
    imported.length
      ? listColumns(
          store,
          "stages",
          ["orderId", "key", "status", "completedAt"],
          {
            filter: { orderId: imported, key: "ORDER_CREATED" },
          },
        )
      : Promise.resolve([]),
    listByIds(
      store,
      "requests",
      full.filter(describesProduct).map((o) => o.requestId),
    ),
  ]);
  const [sheets, products] = wellmix
    ? await Promise.all([
        listColumns(
          store,
          "purchase_sheets",
          [
            "orderId",
            "productId",
            "factoryItemCode",
            "masterCartonQty",
            "innerQty",
            "cbmPerCarton",
            "lengthCm",
            "widthCm",
            "heightCm",
            "capacityMl",
            "packageType",
            "colorAssortment",
            "material",
            "ncm",
            "netWeightPcKg",
            "grossWeightPcKg",
            "ecommerceDescription",
          ],
          { filter: { orderId: ids } },
        ),
        listByIds(
          store,
          "products",
          items.map((i) => i.productId),
        ),
      ])
    : [[], []];
  const productById = new Map(products.map((p) => [p.id, p]));
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const erpDate = new Map(
    stages
      .filter((s) => s.status === "done" && s.completedAt)
      .map((s) => [s.orderId, s.completedAt as string]),
  );
  const itemsOf = (orderId: string) =>
    items.filter((i) => i.orderId === orderId);
  // Venda: na Wellmix, só com "Ver valores e margem" (a regra das listas,
  // exportações e do Histórico comercial, canSeeMoney); o login do cliente
  // vê a venda dos pedidos dele.
  const seesSale = wellmix ? canSeeMoney(user) : canSeeSellPrice(user);

  const dateOf = (o: Order) =>
    o.sankhyaCode ? (erpDate.get(o.id) ?? null) : o.createdAt;
  const totalOf = (o: Order): Money | null =>
    seesSale && o.sellPrice !== null && o.sellPrice !== undefined
      ? { amount: o.sellPrice, currency: o.sellCurrency ?? "BRL" }
      : null;
  const sheetOf = (o: Order, item: ItemRow): SheetRow | null => {
    const own = (orderId: string) =>
      sheets.filter((s) => s.orderId === orderId);
    const match = (list: SheetRow[]) =>
      list.find((s) => s.productId && s.productId === item.productId) ??
      (list.length === 1 && itemsOf(list[0].orderId).length === 1
        ? list[0]
        : null);
    // A rodada usa a ficha do pai quando não tem a sua.
    return (
      match(own(o.id)) ??
      (o.parentOrderId ? match(own(o.parentOrderId)) : null) ??
      null
    );
  };
  const buildItems = (o: Order): HistoryItem[] => {
    const list = itemsOf(o.id);
    const total = totalOf(o);
    const request = describesProduct(o)
      ? (requestById.get(o.requestId) ?? null)
      : null;
    return list.map((item) => {
      const product = item.productId
        ? (productById.get(item.productId) ?? null)
        : null;
      const sheet = wellmix ? sheetOf(o, item) : null;
      const single = list.length === 1;
      return {
        productId: item.productId ?? null,
        name: realName(item.name) ?? "—",
        quantity: item.quantity,
        unit: item.unit,
        // Descrição e especificação: as da solicitação (o pedido de sempre
        // descreve um produto); na Wellmix, a da ficha de compra do pedido e,
        // por último, a ficha atual.
        description: first(
          fact(single ? request?.description : null, false),
          wellmix ? fact(sheet?.ecommerceDescription, false) : null,
          wellmix && product?.notesToEcommerce
            ? fact(product.notes, true)
            : null,
        ),
        specification: first(
          fact(single ? request?.specification : null, false),
          wellmix ? fact(product?.specification, true) : null,
        ),
        sheet: wellmix
          ? itemSheet({
              quantity: item.quantity,
              unit: item.unit,
              sankhyaRefs: item.sankhyaRefs,
              variant: item.variant ?? request?.variant ?? null,
              sheet,
              product,
            })
          : null,
        // Venda por produto gravada no item (docs/ORDER_SALE.md), na moeda
        // do pedido; sem ela, pedido de um produto: unitário = total ÷
        // quantidade (pedidos antigos, com a venda só no pedido inteiro).
        ...(() => {
          const recorded =
            seesSale && typeof item.sellUnitPrice === "number"
              ? item.sellUnitPrice
              : null;
          if (recorded !== null) {
            const currency = o.sellCurrency ?? "BRL";
            return {
              unitSale: { amount: recorded, currency },
              subtotalSale: {
                amount: round(recorded * item.quantity, 2),
                currency,
              },
            };
          }
          return {
            unitSale:
              single && total && item.quantity > 0
                ? {
                    amount: round(total.amount / item.quantity, 4),
                    currency: total.currency,
                  }
                : null,
            subtotalSale: single ? total : null,
          };
        })(),
      };
    });
  };
  const roundsOf = (parent: Order): HistoryRound[] => {
    const children = childRows
      .filter((c) => c.parentOrderId === parent.id)
      .map((c) => byId.get(c.id))
      .filter((c): c is Order => !!c);
    const used = new Set<string>();
    const child = (r: PurchaseRound) => {
      const found =
        children.find((c) => r.orderId && c.id === r.orderId) ??
        children.find((c) => !used.has(c.id) && c.roundIndex === r.index);
      if (found) used.add(found.id);
      return found ?? null;
    };
    const view = (c: Order | null) =>
      c
        ? {
            id: c.id,
            number: c.number,
            status: c.status,
            date: dateOf(c),
            items: buildItems(c),
          }
        : null;
    const planned = (parent.purchaseRounds ?? []).map((r) => {
      const c = child(r);
      return {
        index: r.index,
        expectedAt: r.expectedAt ?? null,
        pieces: r.items.reduce((s, x) => s + (x.quantity || 0), 0) || null,
        // O login do cliente não vê o filho (canViewOrder): a rodada aparece
        // como criada, sem o número.
        created: !!c || !!r.orderId,
        order: view(c),
      };
    });
    // Filho sem rodada na programação do pai (não deveria acontecer).
    const loose = children
      .filter((c) => !used.has(c.id))
      .map((c) => ({
        index: c.roundIndex ?? 0,
        expectedAt: null,
        pieces: null,
        created: true,
        order: view(c),
      }));
    return [...planned, ...loose].sort((a, b) => a.index - b.index);
  };

  const purchases = pageRows
    .map((row) => byId.get(row.id))
    .filter((o): o is Order => !!o)
    .map((o) => ({
      orderId: o.id,
      number: o.number,
      status: o.status,
      date: dateOf(o),
      imported: !!o.sankhyaCode,
      total: totalOf(o),
      items: buildItems(o),
      rounds: roundsOf(o),
    }));
  return {
    purchases,
    next: eligible.length > size ? pageRows[pageRows.length - 1].number : null,
  };
}

/* ------------------------------------------------------------------------ */
/* Texto da tela (no idioma de quem vê)                                     */
/* ------------------------------------------------------------------------ */

export interface HistoryLineView {
  key: string;
  label: string;
  value: string;
  /** Da ficha atual do produto. */
  current: boolean;
}

export interface HistoryItemView {
  name: string;
  lines: HistoryLineView[];
  /**
   * Produto do catálogo e a família dele (Nova solicitação; dono,
   * 15/11/2026; docs/ORDER_TERMS.md seção 10): o histórico filtra pela
   * família escolhida e um clique leva o produto ao pedido.
   */
  productId?: string | null;
  family?: string | null;
}

export interface HistoryRoundView {
  label: string;
  orderId: string | null;
  items: HistoryItemView[];
}

export interface HistoryPurchaseView {
  id: string;
  number: number;
  label: string;
  date: string;
  /** Explica a data (do Sankhya, ou não gravada). */
  dateHint: string | null;
  status: string;
  total: string;
  items: HistoryItemView[];
  rounds: HistoryRoundView[];
}

export interface HistoryPageView {
  purchases: HistoryPurchaseView[];
  next: number | null;
}

const DASH = "—";

export function purchaseHistoryView(
  page: HistoryPage,
  t: Translate,
): HistoryPageView {
  const num = (n: number, digits = 2) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const date = (iso: string | null) => {
    if (!iso) return DASH;
    // "AAAA-MM-DD" (data prevista da rodada) é um dia do calendário, não um
    // instante: new Date() leria meia-noite UTC e, no fuso do Brasil, o dia
    // anterior. Formata em UTC para mostrar o mesmo dia gravado.
    const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const d = new Date(dayOnly ? `${iso}T00:00:00Z` : iso);
    return Number.isNaN(d.getTime())
      ? DASH
      : d.toLocaleDateString(t.intl, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          ...(dayOnly ? { timeZone: "UTC" } : {}),
        });
  };
  const money = (m: Money | null) =>
    m ? formatAmount(m.amount, m.currency, t.intl) : DASH;
  const dimsText = (d: Dims) =>
    t("purchaseHistory.u.cm", {
      dims: [d.length, d.width, d.height]
        .map((v) => (v === null ? DASH : num(v)))
        .join(" × "),
    });
  const line = (
    key: string,
    label: DictionaryKey,
    value: Fact<unknown> | null,
    text: (v: never) => string,
  ): HistoryLineView => ({
    key,
    label: t(label),
    value: value ? text(value.value as never) : DASH,
    current: !!value?.current,
  });
  const pieces = (n: number) => t("purchaseHistory.u.pieces", { n: num(n, 0) });
  const techText = (key: TechKey, v: string | number) =>
    typeof v === "number"
      ? key === "capacity"
        ? t("purchaseHistory.u.ml", { n: num(v) })
        : key === "innerQty"
          ? pieces(v)
          : key === "netWeight" || key === "grossWeight"
            ? t("purchaseHistory.u.kg", { n: num(v, 3) })
            : num(v)
      : v;
  const itemView = (item: HistoryItem): HistoryItemView => {
    const s = item.sheet;
    const lines: HistoryLineView[] = [];
    if (s) {
      lines.push(line("sku", "purchaseHistory.f.sku", s.sku, (v: string) => v));
      if (s.erpCode)
        lines.push(
          line(
            "erpCode",
            "purchaseHistory.f.erpCode",
            s.erpCode,
            (v: string) => v,
          ),
        );
      if (s.factoryCode)
        lines.push(
          line(
            "factoryCode",
            "purchaseHistory.f.factoryCode",
            s.factoryCode,
            (v: string) => v,
          ),
        );
    }
    lines.push({
      key: "quantity",
      label: t("purchaseHistory.f.quantity"),
      value: `${num(item.quantity, 4)} ${item.unit}`.trim(),
      current: false,
    });
    if (s) {
      lines.push(
        line("pieces", "purchaseHistory.f.pieces", s.pieces, pieces),
        line("perBox", "purchaseHistory.f.perBox", s.perBox, pieces),
        line("boxes", "purchaseHistory.f.boxes", s.boxes, (v: number) =>
          t("purchaseHistory.u.boxes", { n: num(v, 0) }),
        ),
        line(
          "productDims",
          "purchaseHistory.f.productDims",
          s.productDims,
          dimsText,
        ),
        line("boxDims", "purchaseHistory.f.boxDims", s.boxDims, dimsText),
        line("cbmBox", "purchaseHistory.f.cbmBox", s.cbmPerBox, (v: number) =>
          t("purchaseHistory.u.m3", { n: num(v, 4) }),
        ),
        line(
          "cbmTotal",
          "purchaseHistory.f.cbmTotal",
          s.cbmTotal,
          (v: number) => t("purchaseHistory.u.m3", { n: num(v, 4) }),
        ),
      );
    }
    lines.push(
      line(
        "description",
        "purchaseHistory.f.description",
        item.description,
        (v: string) => v,
      ),
      line(
        "specification",
        "purchaseHistory.f.specification",
        item.specification,
        (v: string) => v,
      ),
    );
    for (const tech of s?.technical ?? [])
      lines.push(
        line(
          tech.key,
          `purchaseHistory.f.${tech.key}` as DictionaryKey,
          tech.fact,
          (v: string | number) => techText(tech.key, v),
        ),
      );
    lines.push(
      {
        key: "unitSale",
        label: t("purchaseHistory.f.unitSale"),
        value: money(item.unitSale),
        current: false,
      },
      {
        key: "subtotalSale",
        label: t("purchaseHistory.f.subtotalSale"),
        value: money(item.subtotalSale),
        current: false,
      },
    );
    return { name: item.name, lines, productId: item.productId ?? null };
  };
  // Marco do pedido pela situação (docs/MILESTONES.md, fase 4a).
  const status = (s: string) => orderMilestoneText(t, s);
  return {
    next: page.next,
    purchases: page.purchases.map((p) => ({
      id: p.orderId,
      number: p.number,
      label: t("purchaseHistory.order", { n: p.number }),
      date: date(p.date),
      dateHint: p.imported
        ? t(p.date ? "purchaseHistory.dateErp" : "purchaseHistory.dateMissing")
        : null,
      status: status(p.status),
      total: money(p.total),
      items: p.items.map(itemView),
      rounds: p.rounds.map((r) => {
        const head = t("purchaseHistory.round", { n: r.index });
        const pieceText =
          r.pieces !== null
            ? t("purchaseHistory.roundPieces", { n: num(r.pieces, 0) })
            : null;
        const label = r.order
          ? [
              head,
              `#${r.order.number}`,
              date(r.order.date),
              status(r.order.status),
              pieceText,
            ]
              .filter(Boolean)
              .join(" · ")
          : [
              head,
              t(
                r.created
                  ? "purchaseHistory.roundCreated"
                  : "purchaseHistory.roundPlanned",
                { date: date(r.expectedAt) },
              ),
              pieceText,
            ]
              .filter(Boolean)
              .join(" · ");
        return {
          label,
          orderId: r.order?.id ?? null,
          items: (r.order?.items ?? []).map(itemView),
        };
      }),
    })),
  };
}

/** Acrescenta a família (do índice de origem) a cada item do histórico. */
export async function withHistoryFamilies(
  view: HistoryPageView,
): Promise<HistoryPageView> {
  const { productOrigin } = await import("./product-origin");
  const cache = new Map<string, string | null>();
  const familyOf = async (id: string | null | undefined) => {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, (await productOrigin(id))?.family ?? null);
    return cache.get(id) ?? null;
  };
  const items = async (list: HistoryItemView[]) =>
    Promise.all(
      list.map(async (i) => ({ ...i, family: await familyOf(i.productId) })),
    );
  return {
    ...view,
    purchases: await Promise.all(
      view.purchases.map(async (p) => ({
        ...p,
        items: await items(p.items),
        rounds: await Promise.all(
          p.rounds.map(async (r) => ({ ...r, items: await items(r.items) })),
        ),
      })),
    ),
  };
}
