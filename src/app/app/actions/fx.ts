"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/permissions";
import { getFxRates } from "@/lib/services/fx";
import { requireUser } from "./helpers";

/*
 * "Buscar agora" do câmbio em Configurações (só admin): busca na hora a PTAX do
 * Banco Central (ou a AwesomeAPI, se o BC não responder), grava como cotação do
 * dia e devolve as taxas para preencher os campos.
 */
export async function fetchFxNowAction(): Promise<
  | {
      ok: true;
      rates: Partial<Record<"USD" | "RMB" | "EUR", number>>;
      quotedAt: Partial<Record<"USD" | "RMB" | "EUR", string>>;
      source: "ptax" | "awesomeapi" | null;
    }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const fx = await getFxRates({ force: true });
  revalidatePath("/app/settings");
  if (fx.status !== "today") return { ok: false, error: "unavailable" };
  return {
    ok: true,
    rates: fx.rates as Partial<Record<"USD" | "RMB" | "EUR", number>>,
    quotedAt: fx.quotedAt,
    source: fx.source,
  };
}
