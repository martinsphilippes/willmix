import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { canSeeMoney } from "@/lib/auth/function-access";
import { getPriceForecastAdapter } from "@/lib/integrations/price-forecast";
import { CARRIER_CALLERS, WELLMIX_TIERS } from "@/lib/order-terms";
import { getSettings } from "@/lib/settings";
import { forecastQuery } from "@/lib/services/request-price-forecast";

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
  // "Containers/Entrega" da linha (dono, 18/11/2026) → QTD_CONTAINERS.
  containers: z
    .string()
    .regex(/^\d{1,4}$/)
    .transform(Number)
    .refine((n) => n > 0)
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
 * src/lib/integrations/price-forecast.ts, API de preço do Sankhya). Só a
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
    containers: params.get("containers") || undefined,
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
    containers,
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
  if (!product)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  // A mesma consulta que o envio grava (src/lib/services/request-price-forecast.ts).
  const query = forecastQuery({
    product,
    customer,
    quantity: quantity ?? null,
    containers: containers ?? null,
    saleFormat,
    tier,
    caller,
    freight: freight ?? null,
    defaultFreight: settings.deliveryFreightDefaultBrl ?? null,
  });
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
