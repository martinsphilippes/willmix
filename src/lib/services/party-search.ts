import "server-only";
import { getStore, type PartyType } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { searchText } from "@/lib/db/store";

/** Quantos parceiros a busca devolve por vez (o campo mostra os primeiros). */
export const PARTY_SEARCH_LIMIT = 20;

export interface PartyOption {
  id: string;
  name: string;
}

/**
 * Parceiros de um tipo cujo nome contém o texto (sem diferenciar caixa), em
 * ordem alfabética. Para os campos de cliente e fornecedor: com a carga do
 * Sankhya são ~26 mil clientes e ~5,7 mil fornecedores, que não cabem numa
 * lista de seleção.
 */
export async function searchParties(input: {
  type: PartyType;
  q: string;
  /** Ids que não entram (ex.: o "estoque" nas reservas). */
  exclude?: string[];
  /** Só os ativos. */
  activeOnly?: boolean;
}): Promise<PartyOption[]> {
  const text = searchText(input.q).slice(0, 80);
  if (text.length < 2) return [];
  const exclude = new Set(input.exclude ?? []);
  const rows = await listColumns(getStore(), "parties", ["name", "active"], {
    filter: {
      type: input.type,
      ...(input.activeOnly ? { active: true } : {}),
    },
    search: { column: "name", text },
    orderBy: "name",
    limit: PARTY_SEARCH_LIMIT + exclude.size,
  });
  return rows
    .filter((p) => !exclude.has(p.id))
    .slice(0, PARTY_SEARCH_LIMIT)
    .map((p) => ({ id: p.id, name: p.name }));
}
