import { boxesFor } from "@/lib/logistics/cbm";
import { isPieceUnit } from "@/lib/moq";
import type { SaleFormat, WellmixTier } from "@/lib/order-terms";

/*
 * Preços WD e Wellmix do card "Venda ao cliente" do pedido (dono,
 * 24/11/2026; docs/ORDER_SALE.md, "Preços pela API"): o preço não é mais
 * digitado. Para cada produto, a cotação V2 do Sankhya devolve o preço WD
 * (VIP 5, PRECO_WD_COM_FRETE_REFERENCIA) e o preço Wellmix (VIP do nível do
 * pedido; sem nível, o padrão do Sankhya; PRECO_COM_FRETE_REFERENCIA), por
 * peça, em R$. A venda gravada é a do formato escolhido no card (WD ou
 * Wellmix).
 *
 * Funções puras (testáveis sem servidor): a chave das entradas da cotação, a
 * validade do dia, o preço por unidade do item e as caixas, a cubagem e os
 * containers do card.
 */

/** Cotação do dia de um item do pedido (`order_items.saleQuote`). */
export interface OrderItemSaleQuote {
  /** Dia de Brasília (AAAA-MM-DD) da cotação: vale só nesse dia. */
  day: string;
  /** Quando foi calculada (ISO). */
  at: string;
  /** As entradas da cotação (peças, cliente, nível, rota, frete, vendedor): mudou, recalcula. */
  key: string;
  /** Preço WD com frete, por peça (R$). Nulo = a cotação não devolveu. */
  wd: number | null;
  /** Preço Wellmix com frete, por peça (R$). Nulo = a cotação não devolveu. */
  wellmix: number | null;
  /** Nível usado no preço Wellmix; nulo = o padrão do Sankhya. */
  wellmixTier: WellmixTier | null;
  /** STATUS_COTACAO de cada cotação (PRONTA, FRETE_PENDENTE…). */
  wdStatus: string | null;
  wellmixStatus: string | null;
}

/** Os preços de um item como o card mostra (por peça, em R$). */
export interface ItemSalePrices {
  itemId: string;
  wd: number | null;
  wellmix: number | null;
  /** Mensagem da cotação quando um dos preços não veio. */
  wdError: string | null;
  wellmixError: string | null;
  /** Nível usado no preço Wellmix (nulo = padrão do Sankhya). */
  wellmixTier: WellmixTier | null;
  /** Peças da conta (nulo = unidade sem conversão para peças). */
  pieces: number | null;
  /** Peças por unidade do item (1 em peças; a caixa master em caixas). */
  perUnit: number | null;
}

const BOX_UNITS =
  /^(cx|cxs|caixa|caixas|ctn|ctns|carton|cartons|box|boxes|箱)\.?$/i;

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Peças do item para a cotação e quantas peças tem uma unidade dele: em
 * peças, a própria quantidade; em caixas, a quantidade × peças por caixa;
 * outra unidade (ou caixa sem peças por caixa), nulo.
 */
export function piecesOf(
  item: { quantity: number; unit: string },
  perBox: number | null,
): { pieces: number; perUnit: number } | null {
  if (!positive(item.quantity)) return null;
  if (isPieceUnit(item.unit))
    return { pieces: Math.round(item.quantity), perUnit: 1 };
  if (BOX_UNITS.test(item.unit.trim()) && positive(perBox))
    return { pieces: Math.round(item.quantity * perBox), perUnit: perBox };
  return null;
}

/** As entradas que mudam o preço; a cotação guardada vale com a mesma chave. */
export function saleQuoteKey(input: {
  pieces: number | null;
  productCode: string | null;
  customerId: string | null;
  sellerCode: number | null;
  tier: WellmixTier | null;
  route: string | null;
  freight: number | null;
}): string {
  return [
    input.pieces ?? "",
    input.productCode ?? "",
    input.customerId ?? "",
    input.sellerCode ?? "",
    input.tier ?? "",
    input.route ?? "",
    input.freight ?? "",
  ].join("|");
}

/** A cotação guardada vale hoje e com as mesmas entradas? */
export function isQuoteFresh(
  quote: OrderItemSaleQuote | null | undefined,
  day: string,
  key: string,
): quote is OrderItemSaleQuote {
  return !!quote && quote.day === day && quote.key === key;
}

/** O preço por peça do formato escolhido. */
export function quotePrice(
  prices: Pick<ItemSalePrices, "wd" | "wellmix">,
  format: SaleFormat,
): number | null {
  const value = format === "wd" ? prices.wd : prices.wellmix;
  return positive(value) ? value : null;
}

/** Preço por unidade do item (o que vai em `sellUnitPrice`): por peça × peças da unidade. */
export function unitSalePrice(
  perPiece: number | null,
  perUnit: number | null,
): number | null {
  if (!positive(perPiece) || !positive(perUnit)) return null;
  return Math.round(perPiece * perUnit * 10_000) / 10_000;
}

/** Caixas e cubagem de um item do card (a caixa master do item). */
export function itemCargo(input: {
  quantity: number;
  unit: string;
  perBox: number | null;
  cbmPerBox: number | null;
}): { boxes: number | null; cbm: number | null } {
  const isBox = BOX_UNITS.test(input.unit.trim());
  const boxes = isBox
    ? Math.ceil(input.quantity)
    : positive(input.perBox)
      ? boxesFor(input.quantity, input.perBox)
      : null;
  // 4 casas, como a tabela de itens (item-logistics.ts): os números batem.
  const cbm =
    boxes !== null && positive(input.cbmPerBox)
      ? Math.round(boxes * input.cbmPerBox * 10_000) / 10_000
      : null;
  return { boxes, cbm };
}

/** Containers do pedido: a cubagem total ÷ a capacidade do tipo (2 casas, como a ficha de compra). */
export function containersFor(
  totalCbm: number | null,
  capacityCbm: number | null,
): number | null {
  if (totalCbm === null || !positive(totalCbm) || !positive(capacityCbm))
    return null;
  return Math.round((totalCbm / capacityCbm) * 100) / 100;
}
