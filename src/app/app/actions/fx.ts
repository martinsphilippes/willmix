"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/permissions";
import { getFxRates, type FxSource } from "@/lib/services/fx";
import { requireUser } from "./helpers";

/*
 * "Buscar" do câmbio em Configurações (só admin): consulta na hora as fontes
 * (PTAX, AwesomeAPI, Banco Central Europeu), grava como cotação do dia e
 * devolve as taxas para preencher os campos, ou o motivo da falha.
 */
export async function fetchFxNowAction(): Promise<
  | {
      ok: true;
      rates: Partial<Record<"USD" | "RMB" | "EUR", number>>;
      quotedAt: Partial<Record<"USD" | "RMB" | "EUR", string>>;
      source: FxSource | null;
    }
  | { ok: false; error: string; reason: string | null }
> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
  } catch {
    return { ok: false, error: "forbidden", reason: null };
  }
  const fx = await getFxRates({ force: true });
  revalidatePath("/app/settings");
  if (fx.status !== "today")
    return { ok: false, error: "unavailable", reason: fx.lastError };
  return {
    ok: true,
    rates: fx.rates as Partial<Record<"USD" | "RMB" | "EUR", number>>,
    quotedAt: fx.quotedAt,
    source: fx.source,
  };
}
