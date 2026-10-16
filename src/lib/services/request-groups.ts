/*
 * Lista de solicitações agrupada por lote: os produtos pedidos juntos (mesmo
 * requests.groupId) viram uma linha só; abrir leva à página do lote, com os
 * produtos dentro. Cada produto continua com a própria cotação, fornecedor e
 * pedido. Sem banco: só organiza as linhas que a tela já carregou.
 */

export interface GroupableRow {
  id: string;
  groupId?: string | null;
  deadline: string | null;
}

export type RequestListEntry<T> =
  { kind: "single"; row: T } | { kind: "batch"; groupId: string; rows: T[] };

/**
 * Junta as linhas do mesmo lote na posição da primeira (a ordem da lista se
 * mantém). Lote com uma linha só nesta lista vira linha comum.
 */
export function groupRequestRows<T extends GroupableRow>(
  rows: T[],
): RequestListEntry<T>[] {
  const byGroup = new Map<string, T[]>();
  for (const r of rows)
    if (r.groupId)
      byGroup.set(r.groupId, [...(byGroup.get(r.groupId) ?? []), r]);
  const out: RequestListEntry<T>[] = [];
  const done = new Set<string>();
  for (const r of rows) {
    const members = r.groupId ? byGroup.get(r.groupId)! : [r];
    if (!r.groupId || members.length < 2) {
      out.push({ kind: "single", row: r });
      continue;
    }
    if (done.has(r.groupId)) continue;
    done.add(r.groupId);
    out.push({ kind: "batch", groupId: r.groupId, rows: members });
  }
  return out;
}

/** Prazo mais próximo entre os produtos do lote (sem prazo fica por último). */
export function earliestDeadline(rows: GroupableRow[]): string | null {
  const dates = rows
    .map((r) => r.deadline)
    .filter((d): d is string => !!d)
    .sort();
  return dates[0] ?? null;
}

/** Situações do lote na ordem em que aparecem, com quantos produtos em cada. */
export function statusCounts<S extends string>(
  statuses: S[],
): Array<{ status: S; count: number }> {
  const out: Array<{ status: S; count: number }> = [];
  for (const s of statuses) {
    const hit = out.find((x) => x.status === s);
    if (hit) hit.count++;
    else out.push({ status: s, count: 1 });
  }
  return out;
}
