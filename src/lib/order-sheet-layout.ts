import type {
  OrderSheet,
  OrderSheetHeader,
  OrderSheetItem,
} from "@/lib/services/order-sheet";

/*
 * Desenho da folha do pedido (o modelo de pedido da Wellmix), comum ao PDF e
 * à página: rótulos das colunas (em inglês, como vão ao fornecedor), largura
 * relativa de cada uma e o texto de cada célula. Campo sem dado fica em
 * branco: a coluna continua no lugar, como no modelo.
 */

/** Números como no modelo: vírgula decimal e ponto de milhar. */
export const orderSheetNum = (v: number | null | undefined, digits: number) =>
  v === null || v === undefined
    ? ""
    : v.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

/** Data e hora (Brasília) como "10/11/2026 10:20". */
export function orderSheetStamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

const dayOnly = (ymd: string | null) =>
  ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd)
    ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`
    : "";

/** Símbolo da moeda como no modelo ("Price - ¥"). */
export function orderSheetCurrencySign(currency: string): string {
  if (currency === "CNY" || currency === "RMB") return "¥";
  if (currency === "USD") return "US$";
  if (currency === "BRL") return "R$";
  if (currency === "EUR") return "€";
  return currency;
}

export type OrderSheetColumn = readonly [label: string, weight: number];

/** Primeira faixa do item: identificação. */
export const ORDER_SHEET_BAND_A: readonly OrderSheetColumn[] = [
  ["Item List Nº", 26],
  ["Supplier/ Factory Contact", 52],
  ["Picture", 52],
  ["Packing/Die Cut Artwork", 92],
  ["Pantone", 52],
  ["Supplier/ Factory Product Code", 38],
  ["Trading Code", 38],
  ["Wellmix Product Code", 38],
  ["EAN Code", 50],
  ["Dun Code Master Carton", 50],
  ["Dun Code Inner Box", 46],
  ["Product Description", 58],
  ["Portuguese Product Description", 96],
  ["Any batteries?", 40],
  ["NCM", 36],
  ["Import authorization before shipment - LI", 57],
];

/** Segunda faixa do item: embalagem, medidas, pesos, quantidades e valores. */
export const orderSheetBandB = (sign: string): readonly OrderSheetColumn[] => [
  ["Packing", 38],
  ["Product length per piece (meter)", 38],
  ["Product width per piece (meter)", 38],
  ["Product height per piece (meter)", 38],
  ["Product packing length (meter)", 38],
  ["Product packing width (meter)", 38],
  ["Product packing height (meter)", 38],
  ["CBM (Master Carton) (meter)", 38],
  ["Total CBM", 47],
  ["Product Net Weight (KG)", 38],
  ["Total Order Net Weight (KG)", 48],
  ["Product Gross Weight (KG)", 38],
  ["Total Order Gross Weight (KG)", 48],
  ["Pieces per inner box", 38],
  ["Pieces per Master Carton", 34],
  ["Total Quantity of Master Cartons", 47],
  ["Total quantity of pieces", 43],
  [`Price - ${sign}`, 43],
  [`Total Amount - ${sign}`, 64],
];

/**
 * Células da primeira faixa, na ordem de ORDER_SHEET_BAND_A. Foto, código da
 * trading, EAN, DUN e LI ainda não existem no portal: ficam em branco.
 */
export const orderSheetValuesA = (item: OrderSheetItem): string[] => [
  String(item.n),
  item.contact ?? "",
  "",
  item.artwork ?? "",
  item.pantone ?? "",
  item.factoryCode ?? "",
  "",
  item.wellmixCode ?? "",
  "",
  "",
  "",
  item.description,
  item.descriptionPt ?? "",
  item.batteries ?? "",
  item.ncm ?? "",
  "",
];

/**
 * Células da segunda faixa, na ordem de orderSheetBandB. A medida da
 * embalagem da peça ainda não existe no portal: fica em branco.
 */
export const orderSheetValuesB = (item: OrderSheetItem): string[] => [
  item.packing ?? "",
  orderSheetNum(item.lengthM, 3),
  orderSheetNum(item.widthM, 3),
  orderSheetNum(item.heightM, 3),
  "",
  "",
  "",
  orderSheetNum(item.cbmCarton, 5),
  orderSheetNum(item.totalCbm, 5),
  orderSheetNum(item.netKg, 3),
  orderSheetNum(item.totalNetKg, 3),
  orderSheetNum(item.grossKg, 3),
  orderSheetNum(item.totalGrossKg, 3),
  orderSheetNum(item.piecesPerInner, 0),
  orderSheetNum(item.piecesPerMaster, 0),
  orderSheetNum(item.masterCartons, 0),
  // Em peças, só o número (como no modelo); outra unidade vai junto.
  `${orderSheetNum(item.quantity, 0)}${item.pieces ? "" : ` ${item.unit}`}`,
  orderSheetNum(item.price, 4),
  orderSheetNum(item.total, 4),
];

/** As três colunas do cabeçalho: rótulo e valor de cada linha. */
export function orderSheetHeaderBlocks(
  header: OrderSheetHeader,
  printedBy: string | null,
  printedAt: string | null,
): Array<Array<[label: string, value: string]>> {
  return [
    [
      ["Order Issued by:", header.issuedBy ?? ""],
      ["Date of issuance:", orderSheetStamp(header.issuedAt)],
      ["On:", orderSheetStamp(printedAt)],
      ["Lote", header.lot],
    ],
    [
      ["Partner:", header.partner],
      ["Forwarding Agent:", header.forwardingAgent ?? ""],
      ["Incoterm:", header.incoterm ?? ""],
      ["Payment Condition:", header.paymentCondition ?? ""],
      ["Order print by:", printedBy ?? ""],
    ],
    [
      ["Date ETD:", dayOnly(header.etd)],
      ["Purchase Order:", header.purchaseOrder ?? ""],
      ["WELLMIX Number:", String(header.wellmixNumber)],
      ["Commission %:", ""],
      ["Sent to partner on:", orderSheetStamp(header.sentToPartnerAt)],
    ],
  ];
}

/** Totais de carga (CBM e pesos), como no rodapé do modelo. */
export const orderSheetCargoTotals = (
  sheet: OrderSheet,
): Array<[label: string, value: string]> => [
  ["TOTAL CBM", orderSheetNum(sheet.totals.cbm, 5)],
  ["Total Net Weight (KG)", orderSheetNum(sheet.totals.netKg, 3)],
  ["Total Gross Weight (KG)", orderSheetNum(sheet.totals.grossKg, 3)],
];

/** Totais de valor; a comissão ainda não existe no portal (em branco). */
export const orderSheetValueTotals = (
  sheet: OrderSheet,
): Array<[label: string, value: string]> => {
  const sign = orderSheetCurrencySign(sheet.currency);
  return [
    [`Total Value - ${sign}`, orderSheetNum(sheet.totals.value, 4)],
    ["Commission Value:", ""],
    [`Total Value + Commission Value - ${sign}`, ""],
  ];
};

/** Linhas do quadro geral "Comments /Specifications". */
export function orderSheetGeneralNotes(sheet: OrderSheet): string[] {
  return [
    `Generated by Portal ${sheet.header.company} - order ${sheet.header.wellmixNumber}`,
    sheet.moq ? `MOQ: ${orderSheetNum(sheet.moq, 0)} pcs` : "",
    sheet.leadTimeDays
      ? `Production lead time: ${sheet.leadTimeDays} days`
      : "",
  ].filter(Boolean);
}
