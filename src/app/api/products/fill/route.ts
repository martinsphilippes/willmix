import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { isHiddenByBooking } from "@/lib/services/booking-visibility";
import { canPickRequestProducts } from "@/lib/services/product-search";
import { requestProductFills } from "@/lib/services/request-product-fill";

export const dynamic = "force-dynamic";

const PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha do produto escolhido na nova solicitação (nome, descrição,
 * especificação, fotos, estoque, mínimo e variações; sem preço nem
 * fornecedor). Só para quem abre o formulário (Wellmix e cliente) e só
 * produto do catálogo: ativo e fora do Booking, como a lista antiga.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canPickRequestProducts(user, await getSettings()))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!PRODUCT_ID.test(id))
    return NextResponse.json({ error: "id" }, { status: 400 });
  const product = await getStore().get("products", id);
  if (!product || !product.active || (await isHiddenByBooking(product.id)))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [fill] = await requestProductFills(user, await getT(), [product]);
  return NextResponse.json(
    { fill },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
