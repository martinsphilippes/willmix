import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen, type Screen } from "@/lib/auth/screens";
import { PARTY_TYPES, type PartyType } from "@/lib/db";
import { STOCK_PARTY_ID } from "@/lib/services/stock-party";
import { QUOTE_PARTY_TYPES } from "@/lib/purchase-recipients";
import {
  formatTaxId,
  searchParties,
  type PartyOption,
} from "@/lib/services/party-search";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";

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
 * a lista inteira. Devolve id e nome, no máximo 20. A Wellmix busca também
 * pelo código do Sankhya e pelo CNPJ/CPF, que vão ao lado do nome (`hint`);
 * quem é de fora, só pelo nome (dono, 15/11/2026).
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
  // "quote": os tipos que recebem a cotação de compra (Estratégia de Compra;
  // dono, 18/11/2026), só para a Wellmix.
  const quote = type === "quote" && isWellmix(user!);
  if (!quote && !(PARTY_TYPES as readonly string[]).includes(type))
    return NextResponse.json({ error: "type" }, { status: 400 });
  const wellmix = isWellmix(user!);
  const options = await searchParties({
    type: quote ? QUOTE_PARTY_TYPES : (type as PartyType),
    q: params.get("q") ?? "",
    // O "estoque" é um cliente técnico (reservas): fica fora da busca, menos
    // onde a lista antiga o mostrava (`stock=1`, ex.: cliente do container).
    exclude: params.get("stock") === "1" ? [] : [STOCK_PARTY_ID],
    activeOnly: params.get("active") === "1",
    identifiers: wellmix,
  });
  const t = wellmix ? await getT() : null;
  return NextResponse.json(
    {
      options: options.map((o) => ({
        id: o.id,
        name: o.name,
        ...(t ? { hint: partyHint(t, o), code: o.code ?? null } : {}),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** "Cód. 4455 · CNPJ 12.345.678/0001-90" ao lado do nome (Wellmix). */
function partyHint(t: Translate, o: PartyOption): string | null {
  const parts: string[] = [];
  if (o.code) parts.push(t("partyPicker.code", { code: o.code }));
  const doc = formatTaxId(o.taxId);
  if (doc)
    parts.push(
      t(
        doc.kind === "cnpj"
          ? "partyPicker.cnpj"
          : doc.kind === "cpf"
            ? "partyPicker.cpf"
            : "partyPicker.doc",
        { n: doc.text },
      ),
    );
  return parts.length ? parts.join(" · ") : null;
}
