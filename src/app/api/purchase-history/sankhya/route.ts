import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import {
  sankhyaCustomerOrders,
  sankhyaCustomerProducts,
  sankhyaOrderItems,
} from "@/lib/services/sankhya-customer-history";

export const dynamic = "force-dynamic";

const QUERY = z.object({
  customer: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  shown: z
    .string()
    .regex(/^\d{1,6}$/)
    .transform(Number)
    .optional(),
  nunota: z
    .string()
    .regex(/^\d{1,10}$/)
    .transform(Number)
    .refine((n) => Number.isSafeInteger(n) && n > 0)
    .optional(),
  /** Visão Produto (dono, 15/11/2026): os produtos dos `shown` pedidos. */
  view: z.enum(["products", "analysis"]).optional(),
  /** Aba Análise (dono, 19/11/2026): o produto do portal da linha aberta. */
  product: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
});

/**
 * Histórico do cliente pelo Sankhya (Nova solicitação, dono, 15/11/2026;
 * docs/PURCHASE_HISTORY.md seção 9). Só a Wellmix. `?customer=` é o cliente
 * do portal (o código do Sankhya sai do cadastro, nunca do navegador);
 * `shown` = quantos pedidos a tela já tem; `nunota` = itens de um pedido;
 * `view=products` = os produtos dos `shown` pedidos, somados por código e data.
 * Sem o Sankhya configurado ou sem código no cliente, a resposta diz
 * (`state`) e a tela mostra o histórico gravado no portal.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Telas de nova solicitação (Encomendas, TS e Venda; docs/REQUEST_SCREENS.md).
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    customer: params.get("customer") ?? undefined,
    shown: params.get("shown") ?? undefined,
    nunota: params.get("nunota") ?? undefined,
    view: params.get("view") ?? undefined,
    product: params.get("product") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { customer, shown, nunota, view, product } = parsed.data;
  if (view === "analysis" && !product)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const result =
    view === "analysis"
      ? await (
          await import("@/lib/services/purchase-analysis")
        ).productPurchaseAnalysis(user, customer, product!)
      : view === "products"
        ? await sankhyaCustomerProducts(user, customer, shown)
        : nunota
          ? await sankhyaOrderItems(user, customer, nunota)
          : await sankhyaCustomerOrders(user, customer, shown ?? 0);
  if (result.state === "forbidden")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
