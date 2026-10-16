/*
 * Numeração das solicitações que nasceram sem número (antes da coluna
 * requests.number existir no banco). Função pura, sem banco: o script
 * scripts/appwrite-backfill-request-numbers.ts lê as linhas, chama esta função
 * e grava só o que ela devolve. Aditivo: quem já tem número fica com ele.
 */

export interface NumberingRow {
  id: string;
  createdAt: string;
  groupId?: string | null;
  number?: number | null;
}

export interface NumberingPlan {
  /** Solicitações a numerar (só as sem número). */
  updates: Array<{ id: string; number: number }>;
  /** Valor final do contador "request_number" (o maior número em uso). */
  counter: number;
}

/**
 * Regras:
 * - O lote (mesmo groupId) divide um número; produto do lote sem número herda
 *   o número que outro produto do mesmo lote já tem.
 * - Os demais recebem números na ordem de criação (o lote conta pela
 *   solicitação mais antiga dele), a partir do maior entre o contador e os
 *   números já em uso. Rodando logo depois de publicar a coluna (nenhuma
 *   numerada ainda), as antigas ficam com 1, 2, 3… na ordem em que chegaram.
 * - Rodar de novo não muda nada (nada sem número = nenhuma atualização).
 */
export function planRequestNumbers(
  rows: NumberingRow[],
  counter: number | null,
): NumberingPlan {
  const key = (r: NumberingRow) => (r.groupId ? `g:${r.groupId}` : `r:${r.id}`);
  const groups = new Map<string, NumberingRow[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);

  let next =
    Math.max(
      counter ?? 0,
      ...rows.map((r) => (typeof r.number === "number" ? r.number : 0)),
    ) + 1;
  const updates: NumberingPlan["updates"] = [];
  const oldest = (members: NumberingRow[]) =>
    members.reduce((a, b) =>
      a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id)
        ? a
        : b,
    );
  const pending = [...groups.values()]
    .filter((members) => members.some((r) => !r.number))
    .sort((a, b) => {
      const x = oldest(a);
      const y = oldest(b);
      return x.createdAt < y.createdAt
        ? -1
        : x.createdAt > y.createdAt
          ? 1
          : x.id < y.id
            ? -1
            : 1;
    });
  for (const members of pending) {
    // Lote com parte já numerada: o restante herda o menor número do lote.
    const existing = members
      .map((r) => r.number)
      .filter((n): n is number => typeof n === "number" && n > 0);
    const number = existing.length ? Math.min(...existing) : next++;
    for (const r of [...members].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    ))
      if (!r.number) updates.push({ id: r.id, number });
  }
  return { updates, counter: next - 1 };
}
