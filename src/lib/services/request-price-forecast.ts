import "server-only";
import { after } from "next/server";
import { getStore, type Party, type Product, type Request } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import {
  getPriceForecastAdapter,
  type PriceForecastAdapter,
  type PriceForecastAnswer,
  type PriceForecastQuery,
} from "@/lib/integrations/price-forecast";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { isPieceUnit } from "@/lib/moq";
import {
  DELIVERY_ROUTE,
  saleVip,
  type CarrierCaller,
  type OrderTerms,
  type RequestPriceForecast,
  type SaleFormat,
  type WellmixTier,
} from "@/lib/order-terms";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { scheduleTotal } from "@/lib/workflow/request-schedule";
import { NO_RCA, rcaCodeOf } from "./rca";

/*
 * Previsão de venda gravada no envio (dono, 18/11/2026; totais de
 * Encomendas, decisão 1): o "Valor total" da Nova solicitação era só da
 * tela. Agora, depois do envio, o servidor refaz a mesma cotação V2 do
 * Sankhya de cada produto (as condições do pedido, a quantidade e o cliente
 * da solicitação) e grava em `requests.priceForecast`. O número que o
 * navegador mostrou não é aceito. Sem o Sankhya, ou se a cotação não
 * responder, a solicitação fica sem previsão (a lista mostra "—"), e o
 * envio nunca espera nem falha por isso (roda depois da resposta).
 */

/** A consulta da cotação V2 de um produto: a mesma da tela (/api/price-forecast). */
export function forecastQuery(input: {
  product: Product;
  customer: Party | null;
  /** Peças da linha (nulo sem quantidade). */
  quantity: number | null;
  saleFormat?: SaleFormat | null;
  tier?: WellmixTier | null;
  caller?: CarrierCaller | null;
  /** Valor do transporte digitado (R$, total); nulo = o padrão. */
  freight?: number | null;
  /** Frete de entrega padrão das Configurações. */
  defaultFreight: number | null;
  now?: Date;
}): PriceForecastQuery {
  const { product, customer } = input;
  const isCustomer = customer?.type === "customer";
  // O RCA do cliente como a tela mostra: o gravado no portal ou, sem ele,
  // o vendedor que veio do Sankhya (sankhyaRefs.CODVEND); 0 = sem vendedor.
  const rca = isCustomer && customer ? rcaCodeOf(customer) : null;
  return {
    productId: product.id,
    sankhyaCode: product.sankhyaCode ?? null,
    sku: product.sku ?? null,
    quantity: input.quantity ?? null,
    customerId: isCustomer && customer ? customer.id : null,
    customerSankhyaCode:
      isCustomer && customer ? (customer.sankhyaCode ?? null) : null,
    ncm: product.ncm,
    netWeightKg: product.netWeightKg,
    grossWeightKg: product.grossWeightKg,
    masterBoxQty: product.masterBoxQty,
    cbmPerCarton:
      product.cbm && product.cbm > 0
        ? product.cbm
        : cbmFromDimensions(
            product.boxLengthCm,
            product.boxWidthCm,
            product.boxHeightCm,
          ),
    price: product.price,
    currency: product.currency,
    // VIP pelo formato (WD = 5) e pelo nível do Wellmix; rota por quem chama
    // o transportador; frete de entrega digitado ou o das Configurações; o
    // RCA do cliente como vendedor; a data de hoje (Brasília).
    vip: saleVip(input.saleFormat ?? undefined, input.tier ?? undefined),
    route: input.caller ? DELIVERY_ROUTE[input.caller] : null,
    deliveryFreightBrl: input.freight ?? input.defaultFreight ?? null,
    sellerCode:
      rca && rca !== NO_RCA && /^\d{1,9}$/.test(rca) ? Number(rca) : null,
    dataRef:
      (brazilDay(input.now ?? new Date()) ?? "").replace(/-/g, "") || null,
  };
}

/**
 * O preço por peça que a tela mostra (sempre com frete; dono, 16/11/2026):
 * formato WD → PRECO_WD_COM_FRETE_REFERENCIA; os demais →
 * PRECO_COM_FRETE_REFERENCIA. Nulo sem previsão.
 */
export function forecastUnitPrice(
  answer: PriceForecastAnswer,
  saleFormat: SaleFormat | null | undefined,
): { price: number; basis: RequestPriceForecast["basis"] } | null {
  if (answer.mode !== "api" || answer.kind !== "forecast") return null;
  const wd = saleFormat === "wd";
  const price = wd ? answer.wdWithFreight : answer.withFreight;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? { price, basis: wd ? "wd_with_freight" : "with_freight" }
    : null;
}

/** Peças da solicitação para a cotação: a programação, senão a quantidade (só em peças). */
export function forecastPieces(
  request: Pick<Request, "quantity" | "unit" | "schedule">,
): number | null {
  if (!isPieceUnit(request.unit)) return null;
  const total = request.schedule?.items.length
    ? scheduleTotal(request.schedule)
    : request.quantity;
  const pieces = Math.floor(Number(total));
  return Number.isFinite(pieces) && pieces > 0 ? pieces : null;
}

/**
 * Calcula e grava a previsão de cada solicitação (as condições do pedido do
 * lote). Devolve quantas ficaram com previsão. Cada produto é independente:
 * um que falha não impede os outros.
 */
export async function recordPriceForecasts(
  requests: readonly Request[],
  terms: OrderTerms,
  options: { adapter?: PriceForecastAdapter; now?: Date } = {},
): Promise<number> {
  const rows = requests.filter((r) => r.productId);
  if (!rows.length) return 0;
  const store = getStore();
  const [products, customers, settings] = await Promise.all([
    listByIds(
      store,
      "products",
      rows.map((r) => r.productId),
    ),
    listByIds(
      store,
      "parties",
      rows.map((r) => r.customerId),
    ),
    getSettings(),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const customerById = new Map(customers.map((c) => [c.id, c]));
  // Só a venda (sem custo nem margem): a previsão não guarda custo.
  const adapter = options.adapter ?? getPriceForecastAdapter(false);
  const now = options.now ?? new Date();
  let saved = 0;
  for (const r of rows) {
    const product = productById.get(r.productId!);
    const pieces = forecastPieces(r);
    if (!product || pieces === null) continue;
    try {
      const freight = terms.deliveryFreightBrl ?? null;
      const defaultFreight = settings.deliveryFreightDefaultBrl ?? null;
      const answer = await adapter.forecast(
        forecastQuery({
          product,
          customer: customerById.get(r.customerId) ?? null,
          quantity: pieces,
          saleFormat: terms.saleFormat,
          tier: terms.wellmixTier,
          caller: terms.carrierCaller ?? null,
          freight,
          defaultFreight,
          now,
        }),
      );
      const unit = forecastUnitPrice(answer, terms.saleFormat);
      if (!unit) continue;
      const forecast: RequestPriceForecast = {
        unitPrice: unit.price,
        pieces,
        total: Math.round(unit.price * pieces * 100) / 100,
        currency: "BRL",
        basis: unit.basis,
        saleFormat: terms.saleFormat ?? null,
        wellmixTier: terms.wellmixTier ?? null,
        carrierCaller: terms.carrierCaller ?? null,
        deliveryFreightBrl: freight ?? defaultFreight,
        status:
          answer.mode === "api" && answer.kind === "forecast"
            ? (answer.status ?? null)
            : null,
        at: now.toISOString(),
      };
      await store.update("requests", r.id, { priceForecast: forecast });
      saved++;
    } catch (error) {
      // Sem previsão para este produto (a lista mostra "Total parcial").
      console.error(
        "[price-forecast] previsão não gravada",
        r.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return saved;
}

/**
 * Agenda a previsão para depois da resposta (o envio não espera o Sankhya).
 * Sem as condições do pedido (cliente pela vitrine, compra para estoque),
 * nada a fazer. Fora de uma requisição (testes, scripts), não agenda.
 */
export function schedulePriceForecasts(
  requests: readonly Request[],
  terms: OrderTerms | null | undefined,
): boolean {
  if (!terms || !requests.some((r) => r.productId)) return false;
  try {
    after(async () => {
      try {
        await recordPriceForecasts(requests, terms);
      } catch (error) {
        console.error(
          "[price-forecast] previsão do envio falhou",
          error instanceof Error ? error.message : String(error),
        );
      }
    });
    return true;
  } catch {
    // Sem requisição em andamento: sem previsão automática.
    return false;
  }
}
