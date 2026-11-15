import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import {
  loadPurchaseHistory,
  purchaseHistoryView,
  withHistoryFamilies,
} from "@/lib/services/purchase-history";

export const dynamic = "force-dynamic";

const QUERY = z.object({
  customer: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
  before: z
    .string()
    .regex(/^\d{1,9}$/)
    .transform(Number)
    .optional(),
  // Quantas compras a tela já mostra: o tamanho da janela lida (até 2 mil;
  // passando disso, a janela cresce sozinha até achar a página).
  shown: z
    .string()
    .regex(/^\d{1,6}$/)
    .transform((v) => Math.min(Number(v), 2000))
    .optional(),
});

/**
 * Histórico de compras do cliente (Nova solicitação; docs/PURCHASE_HISTORY.md):
 * 10 compras por vez, do mais recente para o mais antigo (`before` = número
 * do último pedido já mostrado; `shown` = quantas a tela já tem). A Wellmix
 * escolhe o cliente (`customer`); o login do cliente vê só a empresa dele (o
 * `customer` é ignorado) e só os pedidos dele. Quem não abre Solicitações
 * não lê nada.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const wellmix = !!user && isWellmix(user);
  if (
    !user ||
    !canOpen(user, "requests") ||
    (!wellmix && user.role !== "customer")
  )
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const parsed = QUERY.safeParse({
    customer: params.get("customer") ?? undefined,
    before: params.get("before") ?? undefined,
    shown: params.get("shown") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const customerId = wellmix ? parsed.data.customer : user.partyId;
  if (!customerId)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const page = await loadPurchaseHistory(
    user,
    customerId,
    parsed.data.before ?? null,
    undefined,
    parsed.data.shown ?? 0,
  );
  const view = purchaseHistoryView(page, await getT());
  // A família de cada item: a Nova solicitação filtra por ela.
  return NextResponse.json(wellmix ? await withHistoryFamilies(view) : view, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
