import "server-only";
import { getStore, type User } from "@/lib/db";

/*
 * Distribuição padrão entre as entregas programadas (dono, 19/11/2026;
 * docs/ECONOMIC_GROUPS.md): por cliente e por número de entregas.
 */

const MAX_ROUNDS = 60;

/** Os percentuais gravados para o cliente com N entregas, ou nulo. */
export async function roundSharesOf(
  customerId: string,
  rounds: number,
): Promise<number[] | null> {
  if (!Number.isInteger(rounds) || rounds < 2 || rounds > MAX_ROUNDS)
    return null;
  const rows = await getStore().list("delivery_round_shares", {
    filter: { customerId },
  });
  const row = rows.find((r) => r.rounds === rounds);
  const p = row?.percents;
  return Array.isArray(p) && p.length === rounds ? p : null;
}

/** Grava (troca) o padrão do cliente para N entregas; somam 100. */
export async function saveRoundShares(
  user: User,
  customerId: string,
  percents: number[],
): Promise<number[]> {
  const rounds = percents.length;
  if (rounds < 2 || rounds > MAX_ROUNDS) throw new Error("invalid");
  if (percents.some((p) => !Number.isFinite(p) || p < 0 || p > 100))
    throw new Error("invalid");
  const total = percents.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.01) throw new Error("percent_total");
  const store = getStore();
  if (!(await store.get("parties", customerId))) throw new Error("invalid");
  const clean = percents.map((p) => Math.round(p * 100) / 100);
  const old = (
    await store.list("delivery_round_shares", { filter: { customerId } })
  ).filter((r) => r.rounds === rounds);
  for (const r of old) await store.remove("delivery_round_shares", r.id);
  await store.create("delivery_round_shares", {
    customerId,
    rounds,
    percents: clean,
    updatedByUserId: user.id,
  });
  return clean;
}
