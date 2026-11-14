import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen, type Screen } from "@/lib/auth/screens";
import { PARTY_TYPES, type PartyType } from "@/lib/db";
import { STOCK_PARTY_ID } from "@/lib/services/stock-party";
import { searchParties } from "@/lib/services/party-search";

export const dynamic = "force-dynamic";

/** Telas com o campo de busca de parceiro (reservas, marketing, sourcing). */
const PICKER_SCREENS: Screen[] = ["products", "marketing", "sourcing"];

/**
 * Telas em que quem é de fora (Gestão de telas) busca só um tipo: o que a
 * lista antiga da tela mostrava. Containers: os clientes do novo container
 * (14/11/2026; antes, a tela trazia a lista dos clientes ativos).
 */
const PICKER_SCREEN_TYPES: ReadonlyArray<[Screen, PartyType]> = [
  ["containers", "customer"],
];

/**
 * Busca de parceiros por nome para os campos de cliente e fornecedor
 * (src/components/party-picker.tsx). Vale para a Wellmix e para quem abre
 * uma das telas que usam o campo (Gestão de telas): essas telas já mostravam
 * a lista inteira. Devolve id e nome, no máximo 20.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "";
  const allowed =
    !!user &&
    (isWellmix(user) ||
      PICKER_SCREENS.some((screen) => canOpen(user, screen)) ||
      PICKER_SCREEN_TYPES.some(
        ([screen, only]) => only === type && canOpen(user, screen),
      ));
  if (!allowed)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(PARTY_TYPES as readonly string[]).includes(type))
    return NextResponse.json({ error: "type" }, { status: 400 });
  const options = await searchParties({
    type: type as PartyType,
    q: params.get("q") ?? "",
    // O "estoque" é um cliente técnico (reservas): fica fora da busca, menos
    // onde a lista antiga o mostrava (`stock=1`, ex.: cliente do container).
    exclude: params.get("stock") === "1" ? [] : [STOCK_PARTY_ID],
    activeOnly: params.get("active") === "1",
  });
  return NextResponse.json(
    { options },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
