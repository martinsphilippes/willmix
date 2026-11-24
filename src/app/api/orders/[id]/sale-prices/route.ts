import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { OrderSaleError } from "@/lib/services/order-sale";
import {
  canSeeSaleQuotes,
  orderItemSalePrices,
} from "@/lib/services/order-sale-quote";

export const dynamic = "force-dynamic";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const ITEMS = z.array(ID).min(1).max(5);

/**
 * Preços WD e Wellmix de alguns itens do pedido (card "Venda ao cliente";
 * docs/ORDER_SALE.md, "Preços pela API"): a tela pede aos poucos, então o
 * pedido abre sem esperar o Sankhya. Só a Wellmix que vê valores ou grava a
 * venda. `?items=a,b` (até 5).
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/orders/[id]/sale-prices">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const order = await getStore().get("orders", id);
  if (!order || !canViewOrder(user, order) || !canSeeSaleQuotes(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const items = (new URL(request.url).searchParams.get("items") ?? "")
    .split(",")
    .filter(Boolean);
  const parsed = ITEMS.safeParse(items);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    return NextResponse.json(await orderItemSalePrices(user, id, parsed.data));
  } catch (error) {
    if (error instanceof OrderSaleError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
