import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import {
  sankhyaCustomerOrders,
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
});

/**
 * Histórico do cliente pelo Sankhya (Nova solicitação, dono, 15/11/2026;
 * docs/PURCHASE_HISTORY.md seção 9). Só a Wellmix. `?customer=` é o cliente
 * do portal (o código do Sankhya sai do cadastro, nunca do navegador);
 * `shown` = quantos pedidos a tela já tem; `nunota` = itens de um pedido.
 * Sem o Sankhya configurado ou sem código no cliente, a resposta diz
 * (`state`) e a tela mostra o histórico gravado no portal.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isWellmix(user) || !canOpen(user, "requests"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    customer: params.get("customer") ?? undefined,
    shown: params.get("shown") ?? undefined,
    nunota: params.get("nunota") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { customer, shown, nunota } = parsed.data;
  const result = nunota
    ? await sankhyaOrderItems(user, customer, nunota)
    : await sankhyaCustomerOrders(user, customer, shown ?? 0);
  if (result.state === "forbidden")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
