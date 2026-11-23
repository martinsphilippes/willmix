import "server-only";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { portsOfCountry } from "@/lib/ports";

/*
 * Portos de embarque do país de um parceiro (dono, 23/11/2026): a lista
 * buscável da cotação do fornecedor. Lida do vínculo produto × fornecedor
 * (só a coluna dos portos) e guardada por alguns minutos: ela só muda na
 * carga do Sankhya.
 */

const TTL_MS = 10 * 60 * 1000;
let cache: {
  at: number;
  rows: Awaited<ReturnType<typeof load>>;
} | null = null;

const load = () =>
  listColumns(getStore(), "product_suppliers", ["sankhyaPorts"]).catch(
    () => [],
  );

export async function supplierPortOptions(
  country: string | null | undefined,
): Promise<string[]> {
  if (!country?.trim()) return [];
  if (!cache || Date.now() - cache.at > TTL_MS)
    cache = { at: Date.now(), rows: await load() };
  return portsOfCountry(cache.rows, country);
}
