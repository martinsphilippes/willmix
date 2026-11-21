import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFxRates } from "@/lib/services/fx";
import { getT } from "@/i18n/server";
import type { FxPayload } from "@/lib/fx-convert";

export const dynamic = "force-dynamic";

/**
 * Câmbio do dia para a conversão nos campos de valor (dono, 21/11/2026): ao
 * trocar a moeda, o campo converte o valor no navegador (`MoneyInput`,
 * `src/components/fx-conversion.tsx`). O mesmo câmbio do preço ao cliente
 * (`getFxRates`: PTAX do Banco Central, fontes de reserva, último obtido ou o
 * manual das Configurações), com os textos do aviso no idioma de quem usa.
 * Só com sessão (a Wellmix e os parceiros com login).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [fx, t] = await Promise.all([getFxRates(), getT()]);
  const payload: FxPayload = {
    rates: fx.rates,
    status: fx.status,
    day: fx.day,
    labels: {
      converted: t("moneyFx.converted"),
      convertedManual: t("moneyFx.convertedManual"),
      keep: t("moneyFx.keep"),
      keepAll: t("moneyFx.keepAll"),
      none: t("moneyFx.none"),
    },
  };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
