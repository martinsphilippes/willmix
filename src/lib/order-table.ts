import type { Request } from "@/lib/db/schema";
import type { SaleFormat, WellmixTier } from "@/lib/order-terms";

/*
 * Tabelas padrão no nível do pedido e no nível do item (dono, 22/11/2026;
 * docs/ORDER_TABLES.md). Aqui, a ordem das colunas e a leitura das condições
 * do pedido a partir da solicitação. Regra pura: sem banco, sem tela.
 *
 * Dado que o portal não tem fica nulo (a tela mostra "—"); nada é inventado.
 */

/** Colunas da tabela de pedidos, na ordem do dono. */
export const ORDER_COLUMNS = [
  "number",
  "negotiationDate",
  "saleType",
  "paymentTerm",
  "paymentMethod",
  "billing",
  "vip",
  "group",
  "customerCode",
  "customerName",
  "status",
  "step",
  "sla",
  "items",
  "deliveries",
  "cbm",
  "value",
  "supplier",
] as const;
export type OrderColumn = (typeof ORDER_COLUMNS)[number];

/** Colunas da tabela de itens do pedido, na ordem do dono. */
export const ORDER_ITEM_COLUMNS = [
  "sequence",
  "photo",
  "step",
  "status",
  "sla",
  "code",
  "description",
  "priceNoIpi",
  "priceIpi",
  "priceIpiFreight",
  "perBox",
  "perInner",
  "boxes",
  "pieces",
  "cbm",
] as const;
export type OrderItemColumn = (typeof ORDER_ITEM_COLUMNS)[number];

/**
 * Colunas internas: nunca aparecem para quem é de fora (cliente, fornecedor
 * e parceiros). O valor do pedido depende ainda de "Ver valores e margem".
 */
export const INTERNAL_ORDER_COLUMNS: readonly OrderColumn[] = [
  "vip",
  "group",
  "customerCode",
  "customerName",
  "step",
  "value",
  "supplier",
];

/** Tipo de venda: Trading Sales (encomenda) ou Wellmix STK (estoque). */
export type SaleType = "trading" | "stock" | "sale";

export interface OrderTermsCells {
  saleType: SaleType | null;
  /** Número de parcelas da forma de pagamento escolhida. */
  installments: number | null;
  /** Nome da forma de pagamento escolhida no pedido. */
  paymentName: string | null;
  /** Tipo de faturamento: WX (Wellmix) ou WD (distribuidora). */
  billing: SaleFormat | null;
  vip: WellmixTier | null;
}

type TermsSource = Pick<Request, "orderTerms" | "origin">;

/**
 * As condições do pedido como a tabela mostra. `stock`: o cliente é o
 * estoque da Wellmix (compra para estoque ou reposição), que não tem
 * condições de venda.
 */
export function orderTermsCells(
  request: TermsSource,
  stock: boolean,
): OrderTermsCells {
  const terms = request.orderTerms ?? null;
  const plan = terms?.paymentPlan ?? null;
  return {
    saleType:
      stock || request.origin === "replenishment"
        ? "stock"
        : terms?.operationType === "sale"
          ? "sale"
          : terms?.operationType === "ts"
            ? "trading"
            : null,
    installments: plan?.installments?.length ? plan.installments.length : null,
    paymentName: plan?.name ?? null,
    billing: terms?.saleFormat ?? null,
    vip: terms?.saleFormat === "wellmix" ? (terms.wellmixTier ?? null) : null,
  };
}

/**
 * Os três valores do item (dono, 22/11/2026): sem IPI o portal não tem;
 * "com IPI" é o preço Wellmix (não WD) sem frete; "IPI com frete" é o preço
 * Wellmix com frete. Previsão gravada antes dos campos novos: só o "com
 * frete", e só quando o formato não era WD.
 */
export function itemPrices(
  forecast:
    | {
        unitPrice: number;
        basis: string;
        wellmixPrice?: number | null;
        wellmixWithFreight?: number | null;
      }
    | null
    | undefined,
): { noIpi: null; ipi: number | null; ipiFreight: number | null } {
  if (!forecast) return { noIpi: null, ipi: null, ipiFreight: null };
  return {
    noIpi: null,
    ipi: forecast.wellmixPrice ?? null,
    ipiFreight:
      forecast.wellmixWithFreight ??
      (forecast.basis === "with_freight" ? forecast.unitPrice : null),
  };
}
