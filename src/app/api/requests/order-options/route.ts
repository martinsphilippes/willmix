import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { deliveryCarriers } from "@/lib/services/delivery-carriers";
import { originCountries, originGroups } from "@/lib/services/product-origin";

export const dynamic = "force-dynamic";

/**
 * Opções das condições do pedido na Nova solicitação (docs/ORDER_TERMS.md),
 * só para a Wellmix que abre Solicitações:
 * - sem `country`: os países de origem do catálogo e as transportadoras
 *   (portal + Sankhya);
 * - `?country=<chave>` (vazio = "não informado"): os grupos de produto
 *   daquele país.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  // Telas de nova solicitação (Encomendas, TS e Venda; docs/REQUEST_SCREENS.md).
  if (!user || !isWellmix(user) || !canOpenNewRequest(user))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "private, no-store" };
  if (params.has("country")) {
    const country = (params.get("country") ?? "").slice(0, 80);
    return NextResponse.json(
      { groups: await originGroups(country) },
      { headers },
    );
  }
  const [countries, carriers] = await Promise.all([
    originCountries(),
    deliveryCarriers(),
  ]);
  return NextResponse.json({ countries, ...carriers }, { headers });
}
