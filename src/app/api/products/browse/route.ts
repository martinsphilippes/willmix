import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { canSearchProducts } from "@/lib/services/product-search";
import { browseOrigin, type BrowseLevels } from "@/lib/services/product-origin";

export const dynamic = "force-dynamic";

const LEVEL = /^lv:[A-Z0-9_]{1,60}$/;
const level = (v: string | null) => (v && LEVEL.test(v) ? v : null);
const combo = z
  .tuple([
    z.string().regex(LEVEL).nullable(),
    z.string().regex(LEVEL).nullable(),
    z.string().regex(LEVEL).nullable(),
  ])
  .transform((c): BrowseLevels => c);

/**
 * Seletor de produtos da Nova solicitação (lupa ao lado da busca;
 * docs/ORDER_TERMS.md 11.5): os produtos do país e da família do pedido,
 * com os filtros Grupo, Sub grupo e Coleção do grupo, paginados. Vale para
 * quem busca no catálogo (canSearchProducts "catalog").
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canSearchProducts(user, "catalog", await getSettings()))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const family = params.get("family") ?? "";
  if (!/^(fm|sk|ln):[A-Za-z0-9_-]{1,64}$/.test(family))
    return NextResponse.json({ error: "family" }, { status: 400 });
  let seen: BrowseLevels[] = [];
  try {
    const parsed = z
      .array(combo)
      .max(300)
      .safeParse(JSON.parse(params.get("seen") || "[]"));
    seen = parsed.success ? parsed.data : [];
  } catch {
    seen = [];
  }
  const result = await browseOrigin({
    country: (params.get("country") ?? "").slice(0, 80),
    family,
    filters: [
      level(params.get("l1")),
      level(params.get("l2")),
      level(params.get("l3")),
    ],
    seen,
    page: Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    perPage: 12,
  });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
