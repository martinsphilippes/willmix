import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { canSeeMoney } from "@/lib/auth/function-access";
import { getPriceForecastAdapter } from "@/lib/integrations/price-forecast";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import {
  CARRIER_CALLERS,
  DELIVERY_ROUTE,
  WELLMIX_TIERS,
  saleVip,
} from "@/lib/order-terms";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const QUERY = z.object({
  productId: ID,
  customerId: ID.optional(),
  quantity: z
    .string()
    .regex(/^\d{1,9}$/)
    .transform(Number)
    .optional(),
  // Preço de venda desejado ao cliente final, por peça (R$).
  target: z
    .string()
    .regex(/^\d{1,9}([.,]\d{1,4})?$/)
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => n > 0)
    .optional(),
  // Condições do pedido (cotação V2, dono, 16/11/2026): formato, nível e
  // quem chama o transportador.
  saleFormat: z.enum(["wd", "wellmix"]).optional(),
  tier: z.enum(WELLMIX_TIERS).optional(),
  caller: z.enum(CARRIER_CALLERS).optional(),
  // Valor do transporte digitado no pedido (R$, total): no lugar do padrão.
  freight: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/)
    .transform(Number)
    .optional(),
});

/**
 * Previsão de preço ao cliente final de um produto (Nova solicitação;
 * src/lib/integrations/price-forecast.ts, SuperPlan do Sankhya). Só a
 * Wellmix. Sem `target`: os preços de venda previstos; com `target` (só com
 * "Ver valores e margem"): o preço máximo de compra para o preço de venda
 * desejado. Sem o Sankhya configurado: `{ mode: "manual" }` (nenhum preço).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Telas de nova solicitação (Encomendas, TS e Venda; docs/REQUEST_SCREENS.md).
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    productId: params.get("productId") ?? undefined,
    customerId: params.get("customerId") || undefined,
    quantity: params.get("quantity") || undefined,
    target: params.get("target") || undefined,
    saleFormat: params.get("saleFormat") || undefined,
    tier: params.get("tier") || undefined,
    caller: params.get("caller") || undefined,
    freight: params.get("freight") || undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const {
    productId,
    customerId,
    quantity,
    target,
    saleFormat,
    tier,
    caller,
    freight,
  } = parsed.data;
  const store = getStore();
  const [product, customer, settings] = await Promise.all([
    store.get("products", productId),
    customerId ? store.get("parties", customerId) : Promise.resolve(null),
    getSettings(),
  ]);
  const rca = customer?.type === "customer" ? customer.rcaCode : null;
  if (!product)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const query = {
    productId: product.id,
    sankhyaCode: product.sankhyaCode ?? null,
    sku: product.sku ?? null,
    quantity: quantity ?? null,
    customerId: customer?.type === "customer" ? customer.id : null,
    customerSankhyaCode:
      customer?.type === "customer" ? (customer.sankhyaCode ?? null) : null,
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
    // VIP pelo formato (WD = 5) e pelo nível do Wellmix; rota por quem chama o
    // transportador; frete de entrega das Configurações; o RCA do cliente
    // como vendedor; a data de hoje (Brasília).
    vip: saleVip(saleFormat, tier),
    route: caller ? DELIVERY_ROUTE[caller] : null,
    deliveryFreightBrl: freight ?? settings.deliveryFreightDefaultBrl ?? null,
    sellerCode:
      rca && /^\d{1,9}$/.test(String(rca).trim()) ? Number(rca) : null,
    dataRef: (brazilDay(new Date()) ?? "").replace(/-/g, "") || null,
  };
  const money = canSeeMoney(user);
  // O preço máximo de compra é custo do fornecedor: só com "Ver valores e
  // margem" (a mesma regra das listas).
  if (target && !money)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const adapter = getPriceForecastAdapter(money);
  const answer = target
    ? await adapter.solve({ ...query, targetFinalPriceBrl: target })
    : await adapter.forecast(query);
  return NextResponse.json(answer, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
