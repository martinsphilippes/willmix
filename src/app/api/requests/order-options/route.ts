import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpenNewRequest } from "@/lib/auth/screens";
import { deliveryCarriers } from "@/lib/services/delivery-carriers";
import {
  originCountries,
  originGroups,
  originPorts,
} from "@/lib/services/product-origin";

export const dynamic = "force-dynamic";

/**
 * Opções das condições do pedido na Nova solicitação (docs/ORDER_TERMS.md),
 * só para a Wellmix que abre Solicitações:
 * - sem `country`: os países de origem do catálogo e as transportadoras
 *   (portal + Sankhya);
 * - `?country=<chave>` (vazio = "não informado"): os grupos de produto
 *   daquele país (com `&port=<código>`, só os do porto; vazio = sem porto);
 * - `ports`: as combinações País - Porto (dono, 21/11/2026).
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
    const port = params.has("port")
      ? (params.get("port") ?? "").slice(0, 20)
      : null;
    return NextResponse.json(
      { groups: await originGroups(country, port) },
      { headers },
    );
  }
  const [countries, ports, carriers] = await Promise.all([
    originCountries(),
    originPorts(),
    deliveryCarriers(),
  ]);
  return NextResponse.json({ countries, ports, ...carriers }, { headers });
}
