import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import {
  PRODUCT_SCOPES,
  canSearchProducts,
  productOptionLabel,
  searchProducts,
  type ProductScope,
} from "@/lib/services/product-search";

export const dynamic = "force-dynamic";

/**
 * Busca de produtos por nome ou código para os campos de produto
 * (src/components/product-picker.tsx). Cada escopo vale para quem abre a
 * tela que já mostrava aquela lista inteira (product-search.ts,
 * canSearchProducts). Devolve id e "Nome (SKU)", no máximo 20.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "";
  if (!(PRODUCT_SCOPES as readonly string[]).includes(scope))
    return NextResponse.json({ error: "scope" }, { status: 400 });
  if (
    !user ||
    !canSearchProducts(user, scope as ProductScope, await getSettings())
  )
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [t, hits] = await Promise.all([
    getT(),
    searchProducts({ q: params.get("q") ?? "", scope: scope as ProductScope }),
  ]);
  return NextResponse.json(
    {
      options: hits.map((p) => ({ id: p.id, name: productOptionLabel(t, p) })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
